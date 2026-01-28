// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {CohortRegistry} from "contracts/modules/CohortRegistry.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {Roles} from "contracts/libs/Roles.sol";

contract CohortRegistryTest is Test {
    AccessManager public accessManager;
    CohortRegistry public registry;

    address public governance = makeAddr("governance");
    address public recorder = makeAddr("recorder");
    address public router = makeAddr("router");

    uint256 public constant COMMUNITY_ID = 1;
    uint16 public constant TARGET_ROI = 15000; // 150%
    uint32 public constant PRIORITY = 1;
    bytes32 public constant TERMS_HASH = keccak256("terms");

    function setUp() public {
        accessManager = new AccessManager(governance);
        registry = new CohortRegistry(address(accessManager));

        vm.startPrank(governance);

        // Admin functions gated by AccessManager admin role
        bytes4[] memory adminSelectors = new bytes4[](2);
        adminSelectors[0] = registry.createCohort.selector;
        adminSelectors[1] = registry.setCohortActive.selector;
        accessManager.setTargetFunctionRole(address(registry), adminSelectors, accessManager.ADMIN_ROLE());

        // Investment recording restricted to recorder role
        bytes4[] memory recorderSelectors = new bytes4[](1);
        recorderSelectors[0] = registry.addInvestment.selector;
        accessManager.setTargetFunctionRole(address(registry), recorderSelectors, Roles.COHORT_INVESTMENT_RECORDER_ROLE);
        accessManager.grantRole(Roles.COHORT_INVESTMENT_RECORDER_ROLE, recorder, 0);

        // Revenue recovery restricted to router role
        bytes4[] memory routerSelectors = new bytes4[](1);
        routerSelectors[0] = registry.markRecovered.selector;
        accessManager.setTargetFunctionRole(address(registry), routerSelectors, Roles.COHORT_REVENUE_ROUTER_ROLE);
        accessManager.grantRole(Roles.COHORT_REVENUE_ROUTER_ROLE, router, 0);

        vm.stopPrank();
    }

    function testCreateCohortStoresState() public {
        vm.prank(governance);
        uint256 cohortId = registry.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        CohortRegistry.Cohort memory cohort = registry.getCohort(cohortId);
        assertEq(cohort.id, cohortId);
        assertEq(cohort.communityId, COMMUNITY_ID);
        assertEq(cohort.targetRoiBps, TARGET_ROI);
        assertEq(cohort.priorityWeight, PRIORITY);
        assertEq(cohort.termsHash, TERMS_HASH);
        assertTrue(cohort.active);

        uint256[] memory active = registry.getActiveCohorts(COMMUNITY_ID);
        assertEq(active.length, 1);
        assertEq(active[0], cohortId);
    }

    function testCreateCohortInvalidScheduleReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid schedule"));
        vm.prank(governance);
        registry.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 10, 5, true);
    }

    function testAddInvestmentRequiresAuthorizedRecorder() public {
        vm.prank(governance);
        uint256 cohortId = registry.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, address(this)));
        registry.addInvestment(cohortId, address(1), 100, 1);

        vm.prank(recorder);
        registry.addInvestment(cohortId, address(1), 100, 1);

        assertEq(registry.getInvestmentAmount(cohortId, address(1)), 100);
        assertEq(registry.getInvestmentAmountByToken(1), 100);
        assertEq(registry.tokenCohort(1), cohortId);
    }

    function testAddInvestmentInactiveCohortReverts() public {
        vm.prank(governance);
        uint256 cohortId = registry.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, false);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cohort is not active"));
        vm.prank(recorder);
        registry.addInvestment(cohortId, address(1), 1, 1);
    }

    function testMarkRecoveredCompletesCohort() public {
        vm.prank(governance);
        uint256 cohortId = registry.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.prank(recorder);
        registry.addInvestment(cohortId, address(1), 1000, 1);

        uint256[] memory activeBefore = registry.getActiveCohorts(COMMUNITY_ID);
        assertEq(activeBefore.length, 1);

        vm.expectEmit(true, true, true, true);
        emit CohortRegistry.CohortCompleted(cohortId, 1500);

        vm.prank(router);
        registry.markRecovered(cohortId, 1500);

        CohortRegistry.Cohort memory cohort = registry.getCohort(cohortId);
        assertFalse(cohort.active);
        assertEq(cohort.recoveredTotal, 1500);

        uint256[] memory activeAfter = registry.getActiveCohorts(COMMUNITY_ID);
        assertEq(activeAfter.length, 0);
    }

    function testMarkRecoveredUnauthorizedReverts() public {
        vm.prank(governance);
        uint256 cohortId = registry.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, address(this)));
        registry.markRecovered(cohortId, 1);
    }
}
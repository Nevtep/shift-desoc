// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {InvestmentCohortManager} from "contracts/modules/InvestmentCohortManager.sol";
import {CohortRegistry} from "contracts/modules/CohortRegistry.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {Roles} from "contracts/libs/Roles.sol";

contract CommunityRegistryMock is CommunityRegistry {
    constructor() CommunityRegistry(address(1), address(1)) {}
}

contract InvestmentCohortManagerTest is Test {
    CohortRegistry cohortRegistry;
    ValuableActionRegistry registry;
    ValuableActionSBT sbt;
    InvestmentCohortManager manager;
    AccessManager accessManager;
    CommunityRegistryMock communityRegistry;

    address governance = makeAddr("governance");
    address moderator = makeAddr("moderator");
    address investor = makeAddr("investor");

    uint256 constant COMMUNITY_ID = 1;
    uint16 constant TARGET_ROI = 15000;
    uint32 constant PRIORITY = 100;
    bytes32 constant TERMS_HASH = keccak256("ipfs://cohort-1");
    uint64 constant MOD_ROLE = 1;

    function setUp() public {
        accessManager = new AccessManager(governance);
        communityRegistry = new CommunityRegistryMock();
        cohortRegistry = new CohortRegistry(address(accessManager));
        registry = new ValuableActionRegistry(address(accessManager), address(communityRegistry), governance);
        sbt = new ValuableActionSBT(address(accessManager));
        manager = new InvestmentCohortManager(address(accessManager), address(cohortRegistry), address(registry), address(sbt));

        vm.startPrank(governance);
        // CohortRegistry admin and ops wiring
        bytes4[] memory cohortAdminSelectors = new bytes4[](2);
        cohortAdminSelectors[0] = cohortRegistry.createCohort.selector;
        cohortAdminSelectors[1] = cohortRegistry.setCohortActive.selector;
        accessManager.setTargetFunctionRole(address(cohortRegistry), cohortAdminSelectors, accessManager.ADMIN_ROLE());
        accessManager.grantRole(accessManager.ADMIN_ROLE(), address(manager), 0);

        // Investment recording restricted to recorder role
        bytes4[] memory cohortRecorderSelectors = new bytes4[](1);
        cohortRecorderSelectors[0] = cohortRegistry.addInvestment.selector;
        accessManager.setTargetFunctionRole(address(cohortRegistry), cohortRecorderSelectors, Roles.COHORT_INVESTMENT_RECORDER_ROLE);

        // Revenue recovery restricted to router role
        bytes4[] memory cohortRouterSelectors = new bytes4[](1);
        cohortRouterSelectors[0] = cohortRegistry.markRecovered.selector;
        accessManager.setTargetFunctionRole(address(cohortRegistry), cohortRouterSelectors, Roles.COHORT_REVENUE_ROUTER_ROLE);

        // Configure SBT manager selector and grant role
        bytes4[] memory sbtSelectors = new bytes4[](2);
        sbtSelectors[0] = sbt.mintInvestment.selector;
        sbtSelectors[1] = sbt.updateTokenURI.selector; // allow updates if used
        accessManager.setTargetFunctionRole(address(sbt), sbtSelectors, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);

        bytes4[] memory registryAdminSelectors = new bytes4[](2);
        registryAdminSelectors[0] = registry.setValuableActionSBT.selector;
        registryAdminSelectors[1] = registry.setIssuanceModule.selector;
        accessManager.setTargetFunctionRole(address(registry), registryAdminSelectors, accessManager.ADMIN_ROLE());

        registry.setValuableActionSBT(address(sbt));

        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(registry), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(manager), 0);
        registry.setIssuanceModule(address(manager), true);
        accessManager.grantRole(Roles.COHORT_INVESTMENT_RECORDER_ROLE, address(manager), 0);
        vm.stopPrank();

        vm.startPrank(governance);
        accessManager.grantRole(MOD_ROLE, moderator, 0);
        accessManager.grantRole(MOD_ROLE, governance, 0);
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = manager.createCohort.selector;
        selectors[1] = manager.setCohortActive.selector;
        selectors[2] = manager.issueInvestment.selector;
        accessManager.setTargetFunctionRole(address(manager), selectors, MOD_ROLE);
        vm.stopPrank();
    }

    function testCreateCohort() public {
        vm.prank(governance);
        uint256 cohortId = manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        CohortRegistry.Cohort memory cohort = cohortRegistry.getCohort(cohortId);
        assertEq(cohort.communityId, COMMUNITY_ID);
        assertEq(cohort.targetRoiBps, TARGET_ROI);
        assertEq(cohort.priorityWeight, PRIORITY);
        assertEq(cohort.termsHash, TERMS_HASH);
        assertTrue(cohort.active);
    }

    function testIssueInvestmentRecordsCohort() public {
        vm.prank(governance);
        uint256 cohortId = manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.prank(moderator);
        uint256 tokenId = manager.issueInvestment(investor, cohortId, 500, bytes("meta"));

        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.INVESTMENT));
        assertEq(data.communityId, COMMUNITY_ID);
        assertEq(data.cohortId, cohortId);
        assertEq(data.weight, 500);
        assertEq(data.endedAt, 0);
        assertGt(data.issuedAt, 0);

        assertEq(cohortRegistry.getInvestmentAmount(cohortId, investor), 500);
        assertEq(cohortRegistry.getInvestmentAmountByToken(tokenId), 500);
    }

    function testSetCohortActive() public {
        vm.prank(governance);
        uint256 cohortId = manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.prank(governance);
        manager.setCohortActive(cohortId, false);
        assertFalse(cohortRegistry.isCohortActive(cohortId));

        vm.prank(moderator);
        manager.setCohortActive(cohortId, true);
        assertTrue(cohortRegistry.isCohortActive(cohortId));
    }

    function testIssueInvestmentRespectsExpiry() public {
        uint64 endAt = uint64(block.timestamp + 1);

        vm.prank(governance);
        uint256 cohortId = manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, endAt, true);

        vm.warp(endAt + 1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cohort expired"));
        vm.prank(governance);
        manager.issueInvestment(investor, cohortId, 1, "");
    }

    function testIssueInvestmentRejectsInactiveCohort() public {
        vm.prank(governance);
        uint256 cohortId = manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, false);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cohort inactive"));
        vm.prank(governance);
        manager.issueInvestment(investor, cohortId, 1, "");
    }

    function testUnauthorizedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, investor));
        vm.prank(investor);
        manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.prank(governance);
        uint256 cohortId = manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, investor));
        vm.prank(investor);
        manager.issueInvestment(investor, cohortId, 1, "");
    }
}

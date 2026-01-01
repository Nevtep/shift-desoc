// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {InvestmentCohortManager} from "contracts/modules/InvestmentCohortManager.sol";
import {CohortRegistry} from "contracts/modules/CohortRegistry.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract CommunityRegistryMock is CommunityRegistry {
    constructor() CommunityRegistry(address(1), address(1)) {}
}

contract InvestmentCohortManagerTest is Test {
    CohortRegistry cohortRegistry;
    ValuableActionRegistry registry;
    ValuableActionSBT sbt;
    InvestmentCohortManager manager;
    CommunityRegistryMock communityRegistry;

    address governance = makeAddr("governance");
    address moderator = makeAddr("moderator");
    address investor = makeAddr("investor");

    uint256 constant COMMUNITY_ID = 1;
    uint16 constant TARGET_ROI = 15000;
    uint32 constant PRIORITY = 100;
    bytes32 constant TERMS_HASH = keccak256("ipfs://cohort-1");

    function setUp() public {
        communityRegistry = new CommunityRegistryMock();
        cohortRegistry = new CohortRegistry(governance);
        registry = new ValuableActionRegistry(governance, address(communityRegistry));
        sbt = new ValuableActionSBT(governance, governance, governance);
        manager = new InvestmentCohortManager(governance, address(cohortRegistry), address(registry), address(sbt));

        vm.startPrank(governance);
        cohortRegistry.setValuableActionSBT(address(sbt));
        cohortRegistry.setInvestmentManager(address(manager));

        registry.setValuableActionSBT(address(sbt));
        sbt.grantRole(sbt.MANAGER_ROLE(), address(registry));
        registry.setIssuanceModule(address(manager), true);
        manager.setModerator(moderator, true);
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
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, investor));
        vm.prank(investor);
        manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.prank(governance);
        uint256 cohortId = manager.createCohort(COMMUNITY_ID, TARGET_ROI, PRIORITY, TERMS_HASH, 0, 0, true);

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, investor));
        vm.prank(investor);
        manager.issueInvestment(investor, cohortId, 1, "");
    }
}

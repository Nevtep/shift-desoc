// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract CommunityRegistryMock {
    struct ModuleAddresses {
        address governor;
        address timelock;
        address requestHub;
        address draftsManager;
        address engagementsManager;
        address valuableActionRegistry;
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionSBT;
        address treasuryAdapter;
        address communityToken;
        address paramController;
    }

    mapping(uint256 => ModuleAddresses) internal modulesByCommunity;

    function setModuleAddresses(uint256 communityId, ModuleAddresses calldata modules) external {
        modulesByCommunity[communityId] = modules;
    }

    function getCommunityModules(uint256 communityId) external view returns (ModuleAddresses memory) {
        return modulesByCommunity[communityId];
    }
}

contract ValuableActionRegistryTest is Test {
    ValuableActionRegistry registry;
    CommunityRegistryMock communityRegistry;
    ValuableActionSBT sbt;
    
    address governance = makeAddr("governance");
    address moderator = makeAddr("moderator");
    address founder1 = makeAddr("founder1");
    address founder2 = makeAddr("founder2");
    address user = makeAddr("user");
    address requestHubModule = makeAddr("requestHub");
    
    uint256 constant COMMUNITY_ID = 1;
    bytes32 constant PROPOSAL_REF_1 = bytes32("proposal-1");
    bytes32 constant PROPOSAL_REF_2 = bytes32("proposal-2");
    bytes32 constant PROPOSAL_REF_3 = bytes32("proposal-3");
    bytes32 constant BAD_PROPOSAL_REF = bytes32("bad-proposal");
    
    // Sample ValuableAction parameters
    Types.ValuableAction sampleAction;
    
    function setUp() public {
        communityRegistry = new CommunityRegistryMock();
        registry = new ValuableActionRegistry(governance, address(communityRegistry));
        sbt = new ValuableActionSBT(governance, governance, governance);

        communityRegistry.setModuleAddresses(
            COMMUNITY_ID,
            CommunityRegistryMock.ModuleAddresses({
                governor: address(0xBEEF),
                timelock: governance,
                requestHub: address(0),
                draftsManager: address(0),
                engagementsManager: address(0),
                valuableActionRegistry: address(registry),
                verifierPowerToken: address(0),
                verifierElection: address(0),
                verifierManager: address(0),
                valuableActionSBT: address(0),
                treasuryAdapter: address(0),
                communityToken: address(0),
                paramController: address(0)
            })
        );

        vm.startPrank(governance);
        registry.setValuableActionSBT(address(sbt));
        sbt.grantRole(sbt.MANAGER_ROLE(), address(registry));
        registry.setIssuanceModule(requestHubModule, true);
        vm.stopPrank();
        
        // Setup sample valuable action
        sampleAction = Types.ValuableAction({
            membershipTokenReward: 100,
            communityTokenReward: 50,
            investorSBTReward: 0,
            category: Types.ActionCategory.ONE_SHOT_WORK_COMPLETION,
            verifierPolicy: Types.VerifierPolicy.JURY,
            metadataSchemaId: bytes32("schema:work:v1"),
            jurorsMin: 2,
            panelSize: 3,
            verifyWindow: 7 days,
            verifierRewardWeight: 10,
            slashVerifierBps: 1000,
            cooldownPeriod: 1 days,
            maxConcurrent: 5,
            revocable: true,
            evidenceTypes: 1,
            proposalThreshold: 1000,
            proposer: user,
            evidenceSpecCID: "QmTestEvidenceSpec",
            titleTemplate: "Test Action: {{description}}",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 30 days
        });
        
        // Setup moderators and founders
        vm.startPrank(governance);
        registry.setModerator(moderator, true);
        registry.addFounder(founder1, COMMUNITY_ID);
        registry.addFounder(founder2, COMMUNITY_ID);
        vm.stopPrank();
    }
    
    function testConstructor() public view {
        assertEq(registry.governance(), governance);
        assertTrue(registry.isModerator(governance)); // Governance is initial moderator
        assertEq(registry.lastId(), 0);
    }
    
    function testConstructorZeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new ValuableActionRegistry(address(0), address(communityRegistry));

        vm.expectRevert(Errors.ZeroAddress.selector);
        new ValuableActionRegistry(governance, address(0));
    }
    
    function testSetModerator() public {
        address newModerator = makeAddr("newModerator");
        
        vm.startPrank(governance);
        
        vm.expectEmit(true, true, false, true);
        emit ValuableActionRegistry.ModeratorUpdated(newModerator, true, governance);
        
        registry.setModerator(newModerator, true);
        assertTrue(registry.isModerator(newModerator));
        
        // Remove moderator status
        registry.setModerator(newModerator, false);
        assertFalse(registry.isModerator(newModerator));
        
        vm.stopPrank();
    }
    
    function testSetModeratorUnauthorized() public {
        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        registry.setModerator(moderator, true);
        vm.stopPrank();
    }
    
    function testSetModeratorZeroAddress() public {
        vm.startPrank(governance);
        vm.expectRevert(Errors.ZeroAddress.selector);
        registry.setModerator(address(0), true);
        vm.stopPrank();
    }
    
    function testAddFounder() public {
        address newFounder = makeAddr("newFounder");
        uint256 communityId = 2;
        
        vm.startPrank(governance);
        registry.addFounder(newFounder, communityId);
        
        // Check founder was added to whitelist and list
        assertTrue(registry.founderWhitelist(newFounder, communityId));
        address[] memory founders = registry.getCommunityFounders(communityId);
        assertEq(founders.length, 1);
        assertEq(founders[0], newFounder);
        
        vm.stopPrank();
    }
    
    function testAddFounderDuplicate() public {
        // Adding same founder twice should not duplicate
        vm.startPrank(governance);
        registry.addFounder(founder1, COMMUNITY_ID);
        
        address[] memory foundersBefore = registry.getCommunityFounders(COMMUNITY_ID);
        uint256 lengthBefore = foundersBefore.length;
        
        registry.addFounder(founder1, COMMUNITY_ID); // Add again
        
        address[] memory foundersAfter = registry.getCommunityFounders(COMMUNITY_ID);
        assertEq(foundersAfter.length, lengthBefore); // No increase
        
        vm.stopPrank();
    }
    
    function testProposeValuableActionDirect() public {
        vm.startPrank(governance);
        
        vm.expectEmit(true, false, false, true);
        emit ValuableActionRegistry.ValuableActionCreated(1, sampleAction, governance);
        
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            PROPOSAL_REF_1
        );
        
        assertEq(actionId, 1);
        assertEq(registry.lastId(), 1);
        assertFalse(registry.isValuableActionActive(actionId));
        
        vm.stopPrank();
    }
    
    function testProposeValuableActionFailsWhenProposalIdUsed() public {
        vm.startPrank(governance);
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Proposal ref already used"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testActivateFromGovernance() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            PROPOSAL_REF_1
        );
        vm.stopPrank();
        
        bytes32 proposalRef = registry.pendingValuableActions(actionId);
        
        vm.startPrank(governance);
        
        vm.expectEmit(true, true, false, true);
        emit ValuableActionRegistry.ValuableActionActivated(actionId, uint256(proposalRef));
        
        registry.activateFromGovernance(actionId, proposalRef);
        
        assertTrue(registry.isValuableActionActive(actionId));
        assertEq(registry.pendingValuableActions(actionId), bytes32(0)); // Cleared
        
        vm.stopPrank();
    }
    
    function testActivateFromGovernanceInvalidProposal() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            PROPOSAL_REF_1
        );
        vm.stopPrank();
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Proposal ref mismatch"));
        registry.activateFromGovernance(actionId, BAD_PROPOSAL_REF); // Wrong proposal ref
        vm.stopPrank();
    }
    
    function testUpdateValuableAction() public {
        // Create action first
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            PROPOSAL_REF_1
        );
        registry.activateFromGovernance(actionId, PROPOSAL_REF_1);
        vm.stopPrank();
        
        // Update as moderator
        sampleAction.membershipTokenReward = 200;
        
        vm.startPrank(moderator);
        
        vm.expectEmit(true, false, false, true);
        emit ValuableActionRegistry.ValuableActionUpdated(actionId, sampleAction, moderator);
        
        registry.update(actionId, sampleAction);
        
        Types.ValuableAction memory updated = registry.getValuableAction(actionId);
        assertEq(updated.membershipTokenReward, 200);
        
        vm.stopPrank();
    }
    
    function testUpdateValuableActionUnauthorized() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            PROPOSAL_REF_1
        );
        registry.activateFromGovernance(actionId, PROPOSAL_REF_1);
        vm.stopPrank();

        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        registry.update(actionId, sampleAction);
        vm.stopPrank();
    }
    
    function testDeactivateValuableAction() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            PROPOSAL_REF_1
        );
        registry.activateFromGovernance(actionId, PROPOSAL_REF_1);
        vm.stopPrank();
        
        vm.startPrank(moderator);
        
        vm.expectEmit(true, false, false, true);
        emit ValuableActionRegistry.ValuableActionDeactivated(actionId, moderator);
        
        registry.deactivate(actionId);
        
        assertFalse(registry.isValuableActionActive(actionId));
        
        vm.stopPrank();
    }
    
    function testGetActiveValuableActions() public {
        // Create multiple actions
        vm.startPrank(governance);
        uint256 action1 = registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        uint256 action2 = registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_2);
        uint256 action3 = registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_3);
        registry.activateFromGovernance(action1, PROPOSAL_REF_1);
        registry.activateFromGovernance(action2, PROPOSAL_REF_2);
        registry.activateFromGovernance(action3, PROPOSAL_REF_3);
        vm.stopPrank();
        
        // Deactivate one
        vm.startPrank(moderator);
        registry.deactivate(action2);
        vm.stopPrank();
        
        uint256[] memory activeActions = registry.getActiveValuableActions();
        assertEq(activeActions.length, 2);
        
        // Check correct actions are in the list
        bool found1 = false;
        bool found3 = false;
        for (uint i = 0; i < activeActions.length; i++) {
            if (activeActions[i] == action1) found1 = true;
            if (activeActions[i] == action3) found3 = true;
        }
        assertTrue(found1);
        assertTrue(found3);
    }
    
    function testValidationMembershipTokenRewardZero() public {
        sampleAction.membershipTokenReward = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "MembershipToken reward cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationJurorsMinZero() public {
        sampleAction.jurorsMin = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationPanelSizeZero() public {
        sampleAction.panelSize = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Panel size cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationJurorsMinExceedsPanelSize() public {
        sampleAction.jurorsMin = 5;
        sampleAction.panelSize = 3;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot exceed panel size"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationVerifyWindowZero() public {
        sampleAction.verifyWindow = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verify window cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationSlashRateExceeds100Percent() public {
        sampleAction.slashVerifierBps = 10001; // > 10000 (100%)
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Slash rate cannot exceed 100%"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationEmptyEvidenceSpecCID() public {
        sampleAction.evidenceSpecCID = "";
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence spec CID cannot be empty"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationCooldownPeriodZero() public {
        sampleAction.cooldownPeriod = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cooldown period cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }

    function testProposeValuableActionUnauthorized() public {
        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }

    function testIssueEngagementModuleOnly() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        registry.issueEngagement(COMMUNITY_ID, user, Types.EngagementSubtype.WORK, bytes32("actionType"), hex"01");
    }

    function testIssueEngagementMintsAndEmits() public {
        bytes32 actionTypeId = bytes32("actionType");
        bytes memory metadata = hex"1234";

        vm.expectEmit(true, true, true, true);
        emit ValuableActionRegistry.EngagementIssued(user, 1, Types.EngagementSubtype.WORK, actionTypeId);

        vm.prank(requestHubModule);
        uint256 tokenId = registry.issueEngagement(COMMUNITY_ID, user, Types.EngagementSubtype.WORK, actionTypeId, metadata);

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user);
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint8(data.kind), uint8(ValuableActionSBT.TokenKind.WORK));
    }

    function testIssuePositionMintsAndEmits() public {
        bytes32 positionTypeId = bytes32("roleType");
        bytes memory metadata = hex"cafebabe";

        vm.expectEmit(true, true, true, true);
        emit ValuableActionRegistry.PositionIssued(user, 1, positionTypeId, 10);

        vm.prank(requestHubModule);
        uint256 tokenId = registry.issuePosition(COMMUNITY_ID, user, positionTypeId, 10, metadata);

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user);
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint8(data.kind), uint8(ValuableActionSBT.TokenKind.POSITION));
        assertEq(data.points, 10);
    }

    function testIssueInvestmentMintsAndEmits() public {
        bytes32 cohortId = bytes32("cohort-1");
        bytes memory metadata = hex"deadbeef";
        vm.expectEmit(true, true, true, true);
        emit ValuableActionRegistry.InvestmentIssued(user, 1, cohortId, 5);

        vm.prank(requestHubModule);
        uint256 tokenId = registry.issueInvestment(COMMUNITY_ID, user, cohortId, 5, metadata);

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user);
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint8(data.kind), uint8(ValuableActionSBT.TokenKind.INVESTMENT));
        assertEq(data.weight, 5);
    }

    function testClosePositionSetsEndedAt() public {
        vm.prank(requestHubModule);
        uint256 tokenId = registry.issuePosition(COMMUNITY_ID, user, bytes32("pos"), 10, hex"00");

        vm.startPrank(governance);
        sbt.grantRole(sbt.MANAGER_ROLE(), governance);
        vm.stopPrank();

        vm.prank(governance);
        sbt.closePositionToken(tokenId, 1);

        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertTrue(data.endedAt > 0);
        assertEq(data.closeOutcome, 1);
    }

    function testCommunityNarrowingBlocksOtherCommunities() public {
        // Enable narrowing and allow module only for COMMUNITY_ID
        vm.prank(governance);
        registry.setCommunityNarrowing(COMMUNITY_ID, true);
        vm.prank(governance);
        registry.setCommunityIssuanceModule(COMMUNITY_ID, requestHubModule, true);

        // Using different community should revert
        uint256 otherCommunity = COMMUNITY_ID + 1;
        vm.prank(governance);
        registry.setCommunityNarrowing(otherCommunity, true);

        vm.prank(requestHubModule);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, requestHubModule));
        registry.issueEngagement(otherCommunity, user, Types.EngagementSubtype.WORK, bytes32("actionType"), hex"01");
    }

    function testCommunityNarrowingAllowsAuthorizedCommunity() public {
        vm.prank(governance);
        registry.setCommunityNarrowing(COMMUNITY_ID, true);
        vm.prank(governance);
        registry.setCommunityIssuanceModule(COMMUNITY_ID, requestHubModule, true);

        vm.prank(requestHubModule);
        uint256 tokenId = registry.issuePosition(COMMUNITY_ID, user, bytes32("pos"), 1, hex"00");
        assertEq(tokenId, 1);

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user);
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint8(data.kind), uint8(ValuableActionSBT.TokenKind.POSITION));
        assertEq(data.points, 1);
    }
    
    function testUpdateGovernance() public {
        address newGovernance = makeAddr("newGovernance");
        
        vm.startPrank(governance);
        registry.updateGovernance(newGovernance);
        assertEq(registry.governance(), newGovernance);
        vm.stopPrank();
    }
    
    function testUpdateGovernanceZeroAddress() public {
        vm.startPrank(governance);
        vm.expectRevert(Errors.ZeroAddress.selector);
        registry.updateGovernance(address(0));
        vm.stopPrank();
    }
    
    function testGetValuableActionNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidValuableAction.selector, 999));
        registry.getValuableAction(999);
    }
}
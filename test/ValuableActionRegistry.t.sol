// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract CommunityRegistryMock {
    struct ModuleAddresses {
        address governor;
        address timelock;
        address requestHub;
        address draftsManager;
        address claimsManager;
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
    
    address governance = makeAddr("governance");
    address moderator = makeAddr("moderator");
    address founder1 = makeAddr("founder1");
    address founder2 = makeAddr("founder2");
    address user = makeAddr("user");
    
    uint256 constant COMMUNITY_ID = 1;
    
    // Sample ValuableAction parameters
    Types.ValuableAction sampleAction;
    
    function setUp() public {
        communityRegistry = new CommunityRegistryMock();
        registry = new ValuableActionRegistry(governance, address(communityRegistry));

        communityRegistry.setModuleAddresses(
            COMMUNITY_ID,
            CommunityRegistryMock.ModuleAddresses({
                governor: address(0xBEEF),
                timelock: governance,
                requestHub: address(0),
                draftsManager: address(0),
                claimsManager: address(0),
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
        
        // Setup sample valuable action
        sampleAction = Types.ValuableAction({
            membershipTokenReward: 100,
            communityTokenReward: 50,
            investorSBTReward: 0,
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
            1
        );
        
        assertEq(actionId, 1);
        assertEq(registry.lastId(), 1);
        assertFalse(registry.isValuableActionActive(actionId));
        
        vm.stopPrank();
    }
    
    function testProposeValuableActionFailsWhenProposalIdUsed() public {
        vm.startPrank(governance);
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "ProposalId already used"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testActivateFromGovernance() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            1
        );
        vm.stopPrank();
        
        uint256 proposalId = registry.pendingValuableActions(actionId);
        
        vm.startPrank(governance);
        
        vm.expectEmit(true, true, false, true);
        emit ValuableActionRegistry.ValuableActionActivated(actionId, proposalId);
        
        registry.activateFromGovernance(actionId, proposalId);
        
        assertTrue(registry.isValuableActionActive(actionId));
        assertEq(registry.pendingValuableActions(actionId), 0); // Cleared
        
        vm.stopPrank();
    }
    
    function testActivateFromGovernanceInvalidProposal() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            1
        );
        vm.stopPrank();
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Proposal ID mismatch"));
        registry.activateFromGovernance(actionId, 999); // Wrong proposal ID
        vm.stopPrank();
    }
    
    function testUpdateValuableAction() public {
        // Create action first
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(
            COMMUNITY_ID,
            sampleAction,
            1
        );
        registry.activateFromGovernance(actionId, 1);
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
            1
        );
        registry.activateFromGovernance(actionId, 1);
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
            1
        );
        registry.activateFromGovernance(actionId, 1);
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
        uint256 action1 = registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        uint256 action2 = registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 2);
        uint256 action3 = registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 3);
        registry.activateFromGovernance(action1, 1);
        registry.activateFromGovernance(action2, 2);
        registry.activateFromGovernance(action3, 3);
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
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testValidationJurorsMinZero() public {
        sampleAction.jurorsMin = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testValidationPanelSizeZero() public {
        sampleAction.panelSize = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Panel size cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testValidationJurorsMinExceedsPanelSize() public {
        sampleAction.jurorsMin = 5;
        sampleAction.panelSize = 3;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot exceed panel size"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testValidationVerifyWindowZero() public {
        sampleAction.verifyWindow = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verify window cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testValidationSlashRateExceeds100Percent() public {
        sampleAction.slashVerifierBps = 10001; // > 10000 (100%)
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Slash rate cannot exceed 100%"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testValidationEmptyEvidenceSpecCID() public {
        sampleAction.evidenceSpecCID = "";
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence spec CID cannot be empty"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }
    
    function testValidationCooldownPeriodZero() public {
        sampleAction.cooldownPeriod = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cooldown period cannot be zero"));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
    }

    function testProposeValuableActionUnauthorized() public {
        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        registry.proposeValuableAction(COMMUNITY_ID, sampleAction, 1);
        vm.stopPrank();
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
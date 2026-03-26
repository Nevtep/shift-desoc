// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {Roles} from "contracts/libs/Roles.sol";

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
        address treasuryVault;
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
    AccessManager accessManager;
    
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
        accessManager = new AccessManager(governance);
        registry = new ValuableActionRegistry(
            address(accessManager),
            address(communityRegistry),
            governance,
            COMMUNITY_ID
        );
        sbt = new ValuableActionSBT(address(accessManager), COMMUNITY_ID);

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
                treasuryVault: address(0),
                treasuryAdapter: address(0),
                communityToken: address(0),
                paramController: address(0)
            })
        );

        vm.startPrank(governance);
        bytes4[] memory registryAdminSelectors = new bytes4[](7);
        registryAdminSelectors[0] = registry.setValuableActionSBT.selector;
        registryAdminSelectors[1] = registry.setIssuancePaused.selector;
        registryAdminSelectors[2] = registry.setIssuanceModule.selector;
        registryAdminSelectors[3] = registry.setCommunityNarrowing.selector;
        registryAdminSelectors[4] = registry.setCommunityIssuanceModule.selector;
        registryAdminSelectors[5] = registry.addFounder.selector;
        registryAdminSelectors[6] = registry.proposeValuableAction.selector;
        accessManager.setTargetFunctionRole(address(registry), registryAdminSelectors, accessManager.ADMIN_ROLE());

        bytes4[] memory registryModeratorSelectors = new bytes4[](1);
        registryModeratorSelectors[0] = registry.setModerator.selector;
        accessManager.setTargetFunctionRole(address(registry), registryModeratorSelectors, Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE);

        bytes4[] memory registryIssuerSelectors = new bytes4[](5);
        registryIssuerSelectors[0] = registry.issueEngagement.selector;
        registryIssuerSelectors[1] = registry.issuePosition.selector;
        registryIssuerSelectors[2] = registry.issueInvestment.selector;
        registryIssuerSelectors[3] = registry.closePositionToken.selector;
        registryIssuerSelectors[4] = registry.issueRoleFromPosition.selector;
        accessManager.setTargetFunctionRole(address(registry), registryIssuerSelectors, Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE);

        bytes4[] memory sbtSelectors = new bytes4[](6);
        sbtSelectors[0] = sbt.mintEngagement.selector;
        sbtSelectors[1] = sbt.mintPosition.selector;
        sbtSelectors[2] = sbt.mintInvestment.selector;
        sbtSelectors[3] = sbt.setEndedAt.selector;
        sbtSelectors[4] = sbt.closePositionToken.selector;
        sbtSelectors[5] = sbt.updateTokenURI.selector;
        accessManager.setTargetFunctionRole(address(sbt), sbtSelectors, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);
        registry.setValuableActionSBT(address(sbt));
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE, governance, 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(registry), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, requestHubModule, 0);
        registry.setIssuanceModule(requestHubModule, true);
        vm.stopPrank();
        
        // Setup sample valuable action
        sampleAction = Types.ValuableAction({
            membershipTokenReward: 100,
            communityTokenReward: 50,
            investorSBTReward: 0,
            category: Types.ActionCategory.ENGAGEMENT_ONE_SHOT,
            roleTypeId: bytes32(0),
            positionPoints: 0,
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
        registry.addFounder(founder1);
        registry.addFounder(founder2);
        vm.stopPrank();
    }
    
    function testConstructor() public view {
        assertTrue(registry.isModerator(governance)); // Governance is initial moderator
        assertEq(registry.lastId(), 0);
    }
    
    function testConstructorZeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new ValuableActionRegistry(address(0), address(communityRegistry), governance, COMMUNITY_ID);

        vm.expectRevert(Errors.ZeroAddress.selector);
        new ValuableActionRegistry(address(accessManager), address(0), governance, COMMUNITY_ID);

        vm.expectRevert(Errors.ZeroAddress.selector);
        new ValuableActionRegistry(address(accessManager), address(communityRegistry), address(0), COMMUNITY_ID);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid communityId"));
        new ValuableActionRegistry(address(accessManager), address(communityRegistry), governance, 0);
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
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user));
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
        uint256 communityId = COMMUNITY_ID;

        address[] memory foundersBefore = registry.getCommunityFounders();
        uint256 lengthBefore = foundersBefore.length;
        
        vm.startPrank(governance);
        registry.addFounder(newFounder);
        
        // Check founder was added to whitelist and list
        assertTrue(registry.founderWhitelist(newFounder));
        address[] memory founders = registry.getCommunityFounders();
        assertEq(founders.length, lengthBefore + 1);
        assertEq(founders[founders.length - 1], newFounder);
        
        vm.stopPrank();
    }
    
    function testAddFounderDuplicate() public {
        // Adding same founder twice should not duplicate
        vm.startPrank(governance);
        registry.addFounder(founder1);
        
        address[] memory foundersBefore = registry.getCommunityFounders();
        uint256 lengthBefore = foundersBefore.length;
        
        registry.addFounder(founder1); // Add again
        
        address[] memory foundersAfter = registry.getCommunityFounders();
        assertEq(foundersAfter.length, lengthBefore); // No increase
        
        vm.stopPrank();
    }
    
    function testProposeValuableActionDirect() public {
        vm.startPrank(governance);
        
        vm.expectEmit(true, false, false, true);
        emit ValuableActionRegistry.ValuableActionCreated(1, sampleAction, governance);
        
        uint256 actionId = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1
        );
        
        assertEq(actionId, 1);
        assertEq(registry.lastId(), 1);
        assertFalse(registry.isValuableActionActive(actionId));
        
        vm.stopPrank();
    }
    
    function testProposeValuableActionFailsWhenProposalIdUsed() public {
        vm.startPrank(governance);
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Proposal ref already used"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testActivateFromGovernance() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1
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
        uint256 actionId = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1
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
        uint256 actionId = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1
        );
        registry.activateFromGovernance(actionId, PROPOSAL_REF_1);
        vm.stopPrank();
        
        // Update as governance/timelock authority
        sampleAction.membershipTokenReward = 200;
        
        vm.startPrank(governance);
        
        vm.expectEmit(true, false, false, true);
        emit ValuableActionRegistry.ValuableActionUpdated(actionId, sampleAction, governance);
        
        registry.update(actionId, sampleAction);
        
        Types.ValuableAction memory updated = registry.getValuableAction(actionId);
        assertEq(updated.membershipTokenReward, 200);
        
        vm.stopPrank();
    }
    
    function testUpdateValuableActionUnauthorized() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1
        );
        registry.activateFromGovernance(actionId, PROPOSAL_REF_1);
        vm.stopPrank();

        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user));
        registry.update(actionId, sampleAction);
        vm.stopPrank();
    }

    function testUpdateValuableActionModeratorUnauthorized() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1
        );
        registry.activateFromGovernance(actionId, PROPOSAL_REF_1);
        vm.stopPrank();

        vm.startPrank(moderator);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, moderator));
        registry.update(actionId, sampleAction);
        vm.stopPrank();
    }
    
    function testDeactivateValuableAction() public {
        vm.startPrank(governance);
        uint256 actionId = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1
        );
        registry.activateFromGovernance(actionId, PROPOSAL_REF_1);
        vm.stopPrank();
        
        vm.startPrank(governance);
        
        vm.expectEmit(true, false, false, true);
        emit ValuableActionRegistry.ValuableActionDeactivated(actionId, governance);
        
        registry.deactivate(actionId);
        
        assertFalse(registry.isValuableActionActive(actionId));
        
        vm.stopPrank();
    }
    
    function testGetActiveValuableActions() public {
        // Create multiple actions
        vm.startPrank(governance);
        uint256 action1 = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        uint256 action2 = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_2);
        uint256 action3 = registry.proposeValuableAction(sampleAction, PROPOSAL_REF_3);
        registry.activateFromGovernance(action1, PROPOSAL_REF_1);
        registry.activateFromGovernance(action2, PROPOSAL_REF_2);
        registry.activateFromGovernance(action3, PROPOSAL_REF_3);
        vm.stopPrank();
        
        // Deactivate one
        vm.startPrank(governance);
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
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationJurorsMinZero() public {
        sampleAction.jurorsMin = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot be zero"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationPanelSizeZero() public {
        sampleAction.panelSize = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Panel size cannot be zero"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationJurorsMinExceedsPanelSize() public {
        sampleAction.jurorsMin = 5;
        sampleAction.panelSize = 3;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot exceed panel size"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationVerifyWindowZero() public {
        sampleAction.verifyWindow = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verify window cannot be zero"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationSlashRateExceeds100Percent() public {
        sampleAction.slashVerifierBps = 10001; // > 10000 (100%)
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Slash rate cannot exceed 100%"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationEmptyEvidenceSpecCID() public {
        sampleAction.evidenceSpecCID = "";
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence spec CID cannot be empty"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }
    
    function testValidationCooldownPeriodZero() public {
        sampleAction.cooldownPeriod = 0;
        
        vm.startPrank(governance);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Cooldown period cannot be zero"));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }

    function testProposeValuableActionUnauthorized() public {
        vm.startPrank(user);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user));
        registry.proposeValuableAction(sampleAction, PROPOSAL_REF_1);
        vm.stopPrank();
    }

    function testIssueEngagementModuleOnly() public {
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user));
        registry.issueEngagement(user, Types.EngagementSubtype.WORK, bytes32("actionType"), hex"01");
    }

    function testIssueEngagementMintsAndEmits() public {
        bytes32 actionTypeId = bytes32("actionType");
        bytes memory metadata = hex"1234";

        vm.expectEmit(true, true, true, true);
        emit ValuableActionRegistry.EngagementIssued(user, 1, Types.EngagementSubtype.WORK, actionTypeId);

        vm.prank(requestHubModule);
        uint256 tokenId = registry.issueEngagement(user, Types.EngagementSubtype.WORK, actionTypeId, metadata);

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
        uint256 tokenId = registry.issuePosition(user, positionTypeId, 10, metadata);

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user);
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint8(data.kind), uint8(ValuableActionSBT.TokenKind.POSITION));
        assertEq(data.points, 10);
    }

    function testIssueInvestmentMintsAndEmits() public {
        uint256 cohortId = 1;
        bytes memory metadata = hex"deadbeef";
        vm.expectEmit(true, true, true, true);
        emit ValuableActionRegistry.InvestmentIssued(user, 1, cohortId, 5);

        vm.prank(requestHubModule);
        uint256 tokenId = registry.issueInvestment(user, cohortId, 5, metadata);

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user);
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint8(data.kind), uint8(ValuableActionSBT.TokenKind.INVESTMENT));
        assertEq(data.weight, 5);
    }

    function testClosePositionSetsEndedAt() public {
        vm.prank(requestHubModule);
        uint256 tokenId = registry.issuePosition(user, bytes32("pos"), 10, hex"00");

        vm.startPrank(governance);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, governance, 0);
        vm.stopPrank();

        vm.prank(governance);
        sbt.closePositionToken(tokenId, 1);

        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertTrue(data.endedAt > 0);
        assertEq(data.closeOutcome, 1);
    }

    function testCommunityNarrowingBlocksUnlistedModule() public {
        address unlistedModule = makeAddr("unlistedModule");

        vm.prank(governance);
        registry.setCommunityNarrowing(true);

        vm.prank(unlistedModule);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, unlistedModule));
        registry.issueEngagement(user, Types.EngagementSubtype.WORK, bytes32("actionType"), hex"01");
    }

    function testProposeValuableActionUsesImmutableCommunityScope() public {
        vm.prank(governance);
        uint256 actionId = registry.proposeValuableAction(sampleAction, bytes32("proposal-other"));

        assertEq(registry.communityByActionId(actionId), COMMUNITY_ID);
    }

    function testCommunityNarrowingAllowsAuthorizedCommunity() public {
        vm.prank(governance);
        registry.setCommunityNarrowing(true);
        vm.prank(governance);
        registry.setCommunityIssuanceModule(requestHubModule, true);

        vm.prank(requestHubModule);
        uint256 tokenId = registry.issuePosition(user, bytes32("pos"), 1, hex"00");
        assertEq(tokenId, 1);

        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user);
        ValuableActionSBT.TokenData memory data = sbt.getTokenData(tokenId);
        assertEq(uint8(data.kind), uint8(ValuableActionSBT.TokenKind.POSITION));
        assertEq(data.points, 1);
    }
    
    function testGetValuableActionNonexistent() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidValuableAction.selector, 999));
        registry.getValuableAction(999);
    }
}
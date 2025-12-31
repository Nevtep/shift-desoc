// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Engagements} from "../contracts/modules/Engagements.sol";
import {VerifierManager} from "../contracts/modules/VerifierManager.sol";
import {VerifierElection} from "../contracts/modules/VerifierElection.sol";
import {VerifierPowerToken1155} from "../contracts/modules/VerifierPowerToken1155.sol";
import {ParamController} from "../contracts/modules/ParamController.sol";
import {ValuableActionRegistry} from "../contracts/modules/ValuableActionRegistry.sol";
import {MembershipTokenERC20Votes} from "../contracts/tokens/MembershipTokenERC20Votes.sol";
import {Types} from "../contracts/libs/Types.sol";
import {Errors} from "../contracts/libs/Errors.sol";

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

contract MockValuableActionSBT {
    event TokenMinted(address indexed to, Types.EngagementSubtype subtype, bytes32 refId, bytes metadata);

    function mintEngagement(
        address to,
        uint256,
        Types.EngagementSubtype subtype,
        bytes32 actionTypeId,
        bytes calldata metadata
    ) external returns (uint256 tokenId) {
        tokenId = 1;
        emit TokenMinted(to, subtype, actionTypeId, metadata);
    }

    function mintPosition(
        address to,
        uint256,
        bytes32 positionTypeId,
        uint32,
        bytes calldata metadata
    ) external returns (uint256 tokenId) {
        tokenId = 1;
        emit TokenMinted(to, Types.EngagementSubtype.ROLE, positionTypeId, metadata);
    }

    function mintInvestment(
        address to,
        uint256,
        bytes32 cohortId,
        uint32,
        bytes calldata metadata
    ) external returns (uint256 tokenId) {
        tokenId = 1;
        emit TokenMinted(to, Types.EngagementSubtype.WORK, cohortId, metadata);
    }
}

/// @title Engagements Test Suite - VPT Integration
/// @notice Tests Engagements contract with VerifierManager and ValuableActionRegistry wiring
contract EngagementsTest is Test {
    Engagements public engagements;
    VerifierManager public verifierManager;
    VerifierElection public verifierElection;
    VerifierPowerToken1155 public vpt;
    ParamController public paramController;
    ValuableActionRegistry public actionRegistry;
    MembershipTokenERC20Votes public membershipToken;
    MockValuableActionSBT public valuableActionSBT;
    CommunityRegistryMock public communityRegistry;

    address public governance = makeAddr("governance");
    address public timelock = makeAddr("timelock");

    address public worker1 = makeAddr("worker1");
    address public worker2 = makeAddr("worker2");

    address public verifier1 = makeAddr("verifier1");
    address public verifier2 = makeAddr("verifier2");
    address public verifier3 = makeAddr("verifier3");
    address public verifier4 = makeAddr("verifier4");
    address public verifier5 = makeAddr("verifier5");

    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant ACTION_TYPE_1 = 1;
    uint256 public constant ACTION_TYPE_2 = 2;
    string public constant BASE_URI = "https://api.shift.com/metadata/";
    string public constant EVIDENCE_CID = "QmTestEvidenceHash";
    string public constant REASON_CID = "QmTestReasonHash";
    bytes32 public constant PROPOSAL_REF_1 = bytes32("proposal-1");
    bytes32 public constant PROPOSAL_REF_2 = bytes32("proposal-2");

    event EngagementSubmitted(uint256 indexed engagementId, uint256 indexed typeId, address indexed participant, string evidenceCID);
    event JurorsAssigned(uint256 indexed engagementId, address[] jurors);
    event EngagementVerified(uint256 indexed engagementId, address indexed verifier, bool approve);
    event EngagementResolved(
        uint256 indexed engagementId,
        Types.EngagementStatus status,
        uint32 finalApprovals,
        uint32 finalRejections
    );
    event CooldownUpdated(address indexed participant, uint256 indexed typeId, uint64 nextAllowed);

    function setUp() public {
        // Deploy core VPT infrastructure
        vpt = new VerifierPowerToken1155(governance, BASE_URI);
        verifierElection = new VerifierElection(governance, address(vpt));
        paramController = new ParamController(governance);
        verifierManager = new VerifierManager(
            address(verifierElection),
            address(paramController),
            governance
        );

        // Deploy action registry and membership token
        communityRegistry = new CommunityRegistryMock();
        actionRegistry = new ValuableActionRegistry(governance, address(communityRegistry));
        membershipToken = new MembershipTokenERC20Votes("Test Community Token", "TCT", COMMUNITY_ID, governance);
        valuableActionSBT = new MockValuableActionSBT();

        // Deploy Engagements contract
        engagements = new Engagements(
            governance,
            address(actionRegistry),
            address(verifierManager),
            address(valuableActionSBT),
            address(membershipToken),
            COMMUNITY_ID
        );

        communityRegistry.setModuleAddresses(
            COMMUNITY_ID,
            CommunityRegistryMock.ModuleAddresses({
                governor: address(0xBEEF),
                timelock: governance,
                requestHub: address(0),
                draftsManager: address(0),
                engagementsManager: address(engagements),
                valuableActionRegistry: address(actionRegistry),
                verifierPowerToken: address(vpt),
                verifierElection: address(verifierElection),
                verifierManager: address(verifierManager),
                valuableActionSBT: address(valuableActionSBT),
                treasuryAdapter: address(0),
                communityToken: address(0),
                paramController: address(paramController)
            })
        );

        // Initialize VPT system
        vm.startPrank(governance);
        vpt.initializeCommunity(COMMUNITY_ID, "metadata");
        vpt.grantRole(vpt.TIMELOCK_ROLE(), address(verifierElection));

        // Set up verifiers with power tokens
        address[] memory verifiers = new address[](5);
        verifiers[0] = verifier1;
        verifiers[1] = verifier2;
        verifiers[2] = verifier3;
        verifiers[3] = verifier4;
        verifiers[4] = verifier5;

        uint256[] memory weights = new uint256[](5);
        weights[0] = 100;
        weights[1] = 200;
        weights[2] = 300;
        weights[3] = 150;
        weights[4] = 250;

        verifierElection.setVerifierSet(COMMUNITY_ID, verifiers, weights, REASON_CID);

        // Wire Engagements into VerifierManager
        verifierManager.setEngagementsContract(address(engagements));

        // Configure verification params
        paramController.setUint256(COMMUNITY_ID, verifierManager.VERIFIER_PANEL_SIZE(), 3);
        paramController.setUint256(COMMUNITY_ID, verifierManager.VERIFIER_MIN(), 2);
        paramController.setBool(COMMUNITY_ID, verifierManager.USE_VPT_WEIGHTING(), false);

        // Initialize membership token minter role
        membershipToken.grantRole(membershipToken.MINTER_ROLE(), address(engagements));

        // Create test ValuableActions
        Types.ValuableAction memory action1 = Types.ValuableAction({
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
            verifyWindow: 86400, // 1 day
            verifierRewardWeight: 10,
            slashVerifierBps: 500, // 5%
            cooldownPeriod: 3600, // 1 hour
            maxConcurrent: 2,
            revocable: true,
            evidenceTypes: 1,
            proposalThreshold: 1000,
            proposer: governance,
            evidenceSpecCID: "QmCodeReviewSpec",
            titleTemplate: "Code Review #{engagementId}",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 0
        });

        uint256 actionId1 = actionRegistry.proposeValuableAction(COMMUNITY_ID, action1, PROPOSAL_REF_1);
        actionRegistry.activateFromGovernance(actionId1, PROPOSAL_REF_1);

        Types.ValuableAction memory action2 = Types.ValuableAction({
            membershipTokenReward: 200,
            communityTokenReward: 100,
            investorSBTReward: 10,
            category: Types.ActionCategory.ENGAGEMENT_ONE_SHOT,
            roleTypeId: bytes32(0),
            positionPoints: 0,
            verifierPolicy: Types.VerifierPolicy.JURY,
            metadataSchemaId: bytes32("schema:work:v1"),
            jurorsMin: 3,
            panelSize: 5,
            verifyWindow: 172800, // 2 days
            verifierRewardWeight: 15,
            slashVerifierBps: 1000, // 10%
            cooldownPeriod: 86400, // 1 day
            maxConcurrent: 1,
            revocable: false,
            evidenceTypes: 3,
            proposalThreshold: 2000,
            proposer: governance,
            evidenceSpecCID: "QmDocumentationSpec",
            titleTemplate: "Documentation #{engagementId}",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 604800
        });
        actionRegistry.proposeValuableAction(COMMUNITY_ID, action2, PROPOSAL_REF_2);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testConstructor() public view {
        assertEq(address(engagements.actionRegistry()), address(actionRegistry));
        assertEq(engagements.verifierManager(), address(verifierManager));
        assertEq(engagements.valuableActionSBT(), address(valuableActionSBT));
        assertEq(engagements.governance(), governance);
        assertEq(engagements.membershipToken(), address(membershipToken));
        assertEq(engagements.getCommunityId(), COMMUNITY_ID);
    }

    function testConstructorZeroAddressesRevert() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Engagements(address(0), address(actionRegistry), address(verifierManager), address(valuableActionSBT), address(membershipToken), COMMUNITY_ID);

        vm.expectRevert(Errors.ZeroAddress.selector);
        new Engagements(governance, address(0), address(verifierManager), address(valuableActionSBT), address(membershipToken), COMMUNITY_ID);

        vm.expectRevert(Errors.ZeroAddress.selector);
        new Engagements(governance, address(actionRegistry), address(0), address(valuableActionSBT), address(membershipToken), COMMUNITY_ID);

        vm.expectRevert(Errors.ZeroAddress.selector);
        new Engagements(governance, address(actionRegistry), address(verifierManager), address(0), address(membershipToken), COMMUNITY_ID);

        vm.expectRevert(Errors.ZeroAddress.selector);
        new Engagements(governance, address(actionRegistry), address(verifierManager), address(valuableActionSBT), address(0), COMMUNITY_ID);
    }

    /*//////////////////////////////////////////////////////////////
                        ENGAGEMENT SUBMISSION
    //////////////////////////////////////////////////////////////*/

    function testSubmitEngagementAssignsJurors() public {
        vm.expectEmit(true, true, true, true);
        emit EngagementSubmitted(1, ACTION_TYPE_1, worker1, EVIDENCE_CID);

        vm.prank(worker1);
        uint256 engagementId = engagements.submit(ACTION_TYPE_1, EVIDENCE_CID);

        assertEq(engagementId, 1);

        (
            uint256 typeId,
            address worker,
            string memory evidenceCID,
            Types.EngagementStatus status,
            uint64 createdAt,
            uint64 verifyDeadline,
            address[] memory jurors,
            uint32 approvalsCount,
            uint32 rejectionsCount,
            bool resolved
        ) = engagements.getEngagement(engagementId);

        assertEq(typeId, ACTION_TYPE_1);
        assertEq(worker, worker1);
        assertEq(evidenceCID, EVIDENCE_CID);
        assertEq(uint8(status), uint8(Types.EngagementStatus.Pending));
        assertTrue(createdAt > 0);
        assertTrue(verifyDeadline > createdAt);
        assertEq(jurors.length, 3);
        assertEq(approvalsCount, 0);
        assertEq(rejectionsCount, 0);
        assertFalse(resolved);

        for (uint256 i = 0; i < jurors.length; i++) {
            assertTrue(verifierManager.hasVerifierPower(jurors[i], COMMUNITY_ID));
        }
    }

    function testSubmitEngagementInactiveActionReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Action type is not active"));
        vm.prank(worker1);
        engagements.submit(ACTION_TYPE_2, EVIDENCE_CID);
    }

    function testSubmitEngagementEmptyEvidenceReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence CID cannot be empty"));
        vm.prank(worker1);
        engagements.submit(ACTION_TYPE_1, "");
    }

    /*//////////////////////////////////////////////////////////////
                        VERIFICATION WORKFLOW
    //////////////////////////////////////////////////////////////*/

    function testVerifyEngagementMajorityApproves() public {
        vm.prank(worker1);
        uint256 engagementId = engagements.submit(ACTION_TYPE_1, EVIDENCE_CID);

        address[] memory jurors = engagements.getEngagementJurors(engagementId);

        vm.expectEmit(true, true, false, true);
        emit EngagementVerified(engagementId, jurors[0], true);
        vm.prank(jurors[0]);
        engagements.verify(engagementId, true);

        vm.expectEmit(true, false, false, true);
        emit EngagementResolved(engagementId, Types.EngagementStatus.Approved, 2, 0);
        vm.prank(jurors[1]);
        engagements.verify(engagementId, true);

        (, , , Types.EngagementStatus status, , , , uint32 approvals, uint32 rejections, bool resolved) = engagements.getEngagement(engagementId);
        assertEq(uint8(status), uint8(Types.EngagementStatus.Approved));
        assertEq(approvals, 2);
        assertEq(rejections, 0);
        assertTrue(resolved);
    }

    function testVerifyEngagementRejectsWithMajority() public {
        vm.prank(worker1);
        uint256 engagementId = engagements.submit(ACTION_TYPE_1, EVIDENCE_CID);

        address[] memory jurors = engagements.getEngagementJurors(engagementId);

        vm.prank(jurors[0]);
        engagements.verify(engagementId, false);

        vm.expectEmit(true, false, false, true);
        emit EngagementResolved(engagementId, Types.EngagementStatus.Rejected, 0, 2);
        vm.prank(jurors[1]);
        engagements.verify(engagementId, false);

        (, , , Types.EngagementStatus status, , , , uint32 approvals, uint32 rejections, bool resolved) = engagements.getEngagement(engagementId);
        assertEq(uint8(status), uint8(Types.EngagementStatus.Rejected));
        assertEq(approvals, 0);
        assertEq(rejections, 2);
        assertTrue(resolved);
    }

    function testNonJurorCannotVerify() public {
        vm.prank(worker1);
        uint256 engagementId = engagements.submit(ACTION_TYPE_1, EVIDENCE_CID);

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, worker2));
        vm.prank(worker2);
        engagements.verify(engagementId, true);
    }

    function testJurorCannotDoubleVote() public {
        vm.prank(worker1);
        uint256 engagementId = engagements.submit(ACTION_TYPE_1, EVIDENCE_CID);

        address[] memory jurors = engagements.getEngagementJurors(engagementId);

        vm.prank(jurors[0]);
        engagements.verify(engagementId, true);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Juror already voted"));
        vm.prank(jurors[0]);
        engagements.verify(engagementId, true);
    }

    function testCooldownEnforced() public {
        vm.prank(worker1);
        uint256 engagementId = engagements.submit(ACTION_TYPE_1, EVIDENCE_CID);

        address[] memory jurors = engagements.getEngagementJurors(engagementId);
        vm.prank(jurors[0]);
        engagements.verify(engagementId, true);
        vm.prank(jurors[1]);
        engagements.verify(engagementId, true);

        // Attempt another submission immediately should revert due to cooldown
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Participant is in cooldown period"));
        vm.prank(worker1);
        engagements.submit(ACTION_TYPE_1, "QmSecondEvidence");

        vm.warp(block.timestamp + 3601);
        vm.prank(worker1);
        uint256 secondId = engagements.submit(ACTION_TYPE_1, "QmSecondEvidence");
        assertEq(secondId, 2);
    }
}

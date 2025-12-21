// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Claims} from "../contracts/modules/Claims.sol";
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

contract MockValuableActionSBT {
    event TokenMinted(address indexed to, uint256 points, string metadataURI);
    
    function mintAndAwardPoints(address to, uint256 points, string memory metadataURI) external {
        emit TokenMinted(to, points, metadataURI);
    }
}

/// @title Claims Test Suite - VPT Integration
/// @notice Comprehensive tests for Claims contract with VerifierManager integration
contract ClaimsTest is Test {
    Claims public claims;
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
    address public worker3 = makeAddr("worker3");
    
    address public verifier1 = makeAddr("verifier1");
    address public verifier2 = makeAddr("verifier2");
    address public verifier3 = makeAddr("verifier3");
    address public verifier4 = makeAddr("verifier4");
    address public verifier5 = makeAddr("verifier5");
    
    address public unauthorizedUser = makeAddr("unauthorized");
    
    uint256 public constant COMMUNITY_ID = 1;
    uint256 public constant ACTION_TYPE_1 = 1;
    uint256 public constant ACTION_TYPE_2 = 2;
    string public constant BASE_URI = "https://api.shift.com/metadata/";
    string public constant EVIDENCE_CID = "QmTestEvidenceHash";
    string public constant REASON_CID = "QmTestReasonHash";
    
    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string evidenceCID);
    event JurorsAssigned(uint256 indexed claimId, address[] jurors);
    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);
    event ClaimResolved(
        uint256 indexed claimId, 
        Types.ClaimStatus status, 
        uint32 finalApprovals, 
        uint32 finalRejections
    );
    event AppealSubmitted(uint256 indexed appealId, uint256 indexed claimId, address indexed appellant, string reason);
    event CooldownUpdated(address indexed worker, uint256 indexed typeId, uint64 nextAllowed);
    
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
        
        // Deploy Claims contract
        claims = new Claims(
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
                claimsManager: address(claims),
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
        
        // Grant TIMELOCK_ROLE to VerifierElection so it can mint VPT tokens
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
        vm.stopPrank();
        
        // Set up VerifierManager and governance parameters 
        vm.startPrank(governance);
        verifierManager.setClaimsContract(address(claims));
        
        // Set governance parameters for verification
        paramController.setUint256(COMMUNITY_ID, verifierManager.VERIFIER_PANEL_SIZE(), 3);
        paramController.setUint256(COMMUNITY_ID, verifierManager.VERIFIER_MIN(), 2);
        paramController.setBool(COMMUNITY_ID, verifierManager.USE_VPT_WEIGHTING(), false);
        
        // Initialize membership token minter role
        membershipToken.grantRole(membershipToken.MINTER_ROLE(), address(claims));
        
        // Create test ValuableActions
        
        // Action Type 1: Standard work verification
        Types.ValuableAction memory action1 = Types.ValuableAction({
            membershipTokenReward: 100,
            communityTokenReward: 50,
            investorSBTReward: 0,
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
            titleTemplate: "Code Review #{claimId}",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 0
        });
        
        uint256 actionId1 = actionRegistry.proposeValuableAction(COMMUNITY_ID, action1, 1);
        actionRegistry.activateFromGovernance(actionId1, 1);
        
        // Action Type 2: High-value work with strict requirements  
        Types.ValuableAction memory action2 = Types.ValuableAction({
            membershipTokenReward: 200,
            communityTokenReward: 100,
            investorSBTReward: 10,
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
            titleTemplate: "Documentation #{claimId}",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 604800
        });
        uint256 actionId2 = actionRegistry.proposeValuableAction(COMMUNITY_ID, action2, 2);
        
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        assertEq(address(claims.actionRegistry()), address(actionRegistry));
        assertEq(claims.verifierManager(), address(verifierManager));
        assertEq(claims.valuableActionSBT(), address(valuableActionSBT));
        assertEq(claims.governance(), governance);
        assertEq(claims.membershipToken(), address(membershipToken));
        assertEq(claims.communityId(), COMMUNITY_ID);
    }
    
    function testConstructorZeroAddressesRevert() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(address(0), address(actionRegistry), address(verifierManager), address(valuableActionSBT), address(membershipToken), COMMUNITY_ID);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(governance, address(0), address(verifierManager), address(valuableActionSBT), address(membershipToken), COMMUNITY_ID);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(governance, address(actionRegistry), address(0), address(valuableActionSBT), address(membershipToken), COMMUNITY_ID);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(governance, address(actionRegistry), address(verifierManager), address(0), address(membershipToken), COMMUNITY_ID);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(governance, address(actionRegistry), address(verifierManager), address(valuableActionSBT), address(0), COMMUNITY_ID);
    }
    
    /*//////////////////////////////////////////////////////////////
                        VPT INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSubmitClaimWithVPTJurorSelection() public {
        vm.expectEmit(true, true, true, true);
        emit ClaimSubmitted(1, ACTION_TYPE_1, worker1, EVIDENCE_CID);
        
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        assertEq(claimId, 1);
        
        // Verify claim details
        (
            uint256 typeId,
            address worker,
            string memory evidenceCID,
            Types.ClaimStatus status,
            uint64 createdAt,
            uint64 verifyDeadline,
            address[] memory jurors,
            uint32 approvalsCount,
            uint32 rejectionsCount,
            bool resolved
        ) = claims.getClaim(claimId);
        
        assertEq(typeId, ACTION_TYPE_1);
        assertEq(worker, worker1);
        assertEq(evidenceCID, EVIDENCE_CID);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Pending));
        assertTrue(createdAt > 0);
        assertTrue(verifyDeadline > createdAt);
        assertEq(jurors.length, 3); // Panel size from ValuableAction config
        assertEq(approvalsCount, 0);
        assertEq(rejectionsCount, 0);
        assertFalse(resolved);
        
        // Verify all assigned jurors have verifier power
        for (uint256 i = 0; i < jurors.length; i++) {
            assertTrue(verifierManager.hasVerifierPower(jurors[i], COMMUNITY_ID));
        }
    }
    
    function testVerifyClaimWithVPTJurors() public {
        // Submit claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        // Get assigned VPT jurors
        address[] memory jurors = claims.getClaimJurors(claimId);
        
        // First juror approves
        vm.expectEmit(true, true, false, true);
        emit ClaimVerified(claimId, jurors[0], true);
        
        vm.prank(jurors[0]);
        claims.verify(claimId, true);
        
        // Second juror approves (should resolve with majority)
        vm.expectEmit(true, false, false, true);
        emit ClaimResolved(claimId, Types.ClaimStatus.Approved, 2, 0);
        
        vm.prank(jurors[1]);
        claims.verify(claimId, true);
        
        // Check claim is resolved
        (, , , Types.ClaimStatus status, , , , uint32 approvals, uint32 rejections, bool resolved) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Approved));
        assertEq(approvals, 2);
        assertEq(rejections, 0);
        assertTrue(resolved);
    }
    
    function testFraudReportingToVerifierManager() public {
        // Submit claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        address[] memory jurors = claims.getClaimJurors(claimId);
        
        // Create a scenario where some jurors vote incorrectly
        // Two jurors approve (correct decision)
        vm.prank(jurors[0]);
        claims.verify(claimId, true);
        
        vm.prank(jurors[1]);
        claims.verify(claimId, true); // This resolves as approved
        
        // The system should internally detect that any dissenting votes would be incorrect
        // This is handled in the _reportVerificationResults function
        
        (, , , Types.ClaimStatus status, , , , , , ) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Approved));
    }
    
    /*//////////////////////////////////////////////////////////////
                         STANDARD CLAIM TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSubmitClaimEmptyEvidenceReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence CID cannot be empty"));
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_1, "");
    }
    
    function testSubmitClaimInactiveActionReverts() public {
        // ACTION_TYPE_2 requires governance approval and is not activated yet
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Action type is not active"));
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_2, EVIDENCE_CID);
    }
    
    function testSubmitClaimCooldownPeriod() public {
        // Submit first claim
        vm.prank(worker1);
        uint256 claimId1 = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        // Approve the claim to trigger cooldown
        _approveClaimByMajority(claimId1);
        
        // Try to submit another claim immediately - should fail due to cooldown
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Worker is in cooldown period"));
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_1, "QmSecondEvidence");
        
        // Fast forward past cooldown period
        vm.warp(block.timestamp + 3601); // 1 hour + 1 second
        
        // Now should be able to submit
        vm.prank(worker1);
        uint256 claimId2 = claims.submit(ACTION_TYPE_1, "QmSecondEvidence");
        assertEq(claimId2, 2);
    }
    
    function testSubmitClaimMaxConcurrentLimit() public {
        // Submit maximum concurrent claims (2 for ACTION_TYPE_1)
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_1, "QmEvidence2");
        
        // Third claim should fail
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Too many concurrent claims for this action type"));
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_1, "QmEvidence3");
    }
    
    /*//////////////////////////////////////////////////////////////
                         VERIFICATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testVerifyClaimUnauthorizedReverts() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        claims.verify(claimId, true);
    }
    
    function testVerifyClaimAlreadyVotedReverts() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        address[] memory jurors = claims.getClaimJurors(claimId);
        
        // First vote
        vm.prank(jurors[0]);
        claims.verify(claimId, true);
        
        // Second vote from same juror should fail
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Juror already voted"));
        vm.prank(jurors[0]);
        claims.verify(claimId, false);
    }
    
    function testVerifyClaimAfterDeadlineReverts() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        address[] memory jurors = claims.getClaimJurors(claimId);
        
        // Fast forward past deadline
        vm.warp(block.timestamp + 86401); // 1 day + 1 second
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verification deadline passed"));
        vm.prank(jurors[0]);
        claims.verify(claimId, true);
    }
    
    function testVerifyClaimRejection() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        address[] memory jurors = claims.getClaimJurors(claimId);
        
        // Majority rejects
        vm.prank(jurors[0]);
        claims.verify(claimId, false);
        
        vm.expectEmit(true, false, false, true);
        emit ClaimResolved(claimId, Types.ClaimStatus.Rejected, 0, 2);
        
        vm.prank(jurors[1]);
        claims.verify(claimId, false);
        
        // Check claim is rejected
        (, , , Types.ClaimStatus status, , , , , , ) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Rejected));
    }
    
    /*//////////////////////////////////////////////////////////////
                            REWARDS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testClaimApprovalRewards() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        _approveClaimByMajority(claimId);
        
        // Check cooldown was set
        uint64 nextAllowed = claims.getWorkerCooldown(worker1, ACTION_TYPE_1);
        assertTrue(nextAllowed > block.timestamp);
    }
    
    /*//////////////////////////////////////////////////////////////
                           APPEALS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSubmitAppeal() public {
        // Submit and reject a claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        _rejectClaimByMajority(claimId);
        
        // Submit appeal
        string memory appealReason = "Evidence was misunderstood";
        
        vm.expectEmit(true, true, true, true);
        emit AppealSubmitted(1, claimId, worker1, appealReason);
        
        vm.prank(worker1);
        uint256 appealId = claims.submitAppeal(claimId, appealReason);
        
        assertEq(appealId, 1);
    }
    
    /*//////////////////////////////////////////////////////////////
                           GOVERNANCE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testUpdateContracts() public {
        address newVerifierManager = makeAddr("newVerifierManager");
        address newValuableActionSBT = makeAddr("newValuableActionSBT");
        
        vm.prank(governance);
        claims.updateContracts(newVerifierManager, newValuableActionSBT);
        
        assertEq(claims.verifierManager(), newVerifierManager);
        assertEq(claims.valuableActionSBT(), newValuableActionSBT);
    }
    
    function testUpdateGovernance() public {
        address newGovernance = makeAddr("newGovernance");
        
        vm.prank(governance);
        claims.updateGovernance(newGovernance);
        
        assertEq(claims.governance(), newGovernance);
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetCommunityId() public view {
        assertEq(claims.getCommunityId(), COMMUNITY_ID);
    }
    
    function testGetPendingClaims() public {
        // Submit claims
        vm.prank(worker1);
        uint256 claimId1 = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        vm.prank(worker2);
        uint256 claimId2 = claims.submit(ACTION_TYPE_1, "QmEvidence2");
        
        uint256[] memory pending = claims.getPendingClaims(ACTION_TYPE_1);
        assertEq(pending.length, 2);
        assertEq(pending[0], claimId1);
        assertEq(pending[1], claimId2);
        
        // Approve one claim
        _approveClaimByMajority(claimId1);
        
        // Should only have one pending now
        pending = claims.getPendingClaims(ACTION_TYPE_1);
        assertEq(pending.length, 1);
        assertEq(pending[0], claimId2);
    }
    
    function testGetClaimsByWorker() public {
        vm.prank(worker1);
        uint256 claimId1 = claims.submit(ACTION_TYPE_1, EVIDENCE_CID);
        
        vm.prank(worker1);
        uint256 claimId2 = claims.submit(ACTION_TYPE_1, "QmEvidence2");
        
        uint256[] memory workerClaims = claims.getClaimsByWorker(worker1);
        assertEq(workerClaims.length, 2);
        assertEq(workerClaims[0], claimId1);
        assertEq(workerClaims[1], claimId2);
        
        // Other worker should have no claims
        uint256[] memory otherClaims = claims.getClaimsByWorker(worker2);
        assertEq(otherClaims.length, 0);
    }
    
    /*//////////////////////////////////////////////////////////////
                            HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _approveClaimByMajority(uint256 claimId) internal {
        address[] memory jurors = claims.getClaimJurors(claimId);
        
        // Get majority (2 out of 3)
        vm.prank(jurors[0]);
        claims.verify(claimId, true);
        
        vm.prank(jurors[1]);
        claims.verify(claimId, true);
    }
    
    function _rejectClaimByMajority(uint256 claimId) internal {
        address[] memory jurors = claims.getClaimJurors(claimId);
        
        // Get majority (2 out of 3)
        vm.prank(jurors[0]);
        claims.verify(claimId, false);
        
        vm.prank(jurors[1]);
        claims.verify(claimId, false);
    }
    
    /*//////////////////////////////////////////////////////////////
                              FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzzSubmitClaim(string calldata evidenceCID) public {
        vm.assume(bytes(evidenceCID).length > 0);
        vm.assume(bytes(evidenceCID).length <= 100);
        
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, evidenceCID);
        
        assertEq(claimId, 1);
        
        (, , string memory storedCID, , , , , , , ) = claims.getClaim(claimId);
        assertEq(storedCID, evidenceCID);
    }
}
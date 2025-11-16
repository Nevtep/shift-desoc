// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Claims} from "contracts/modules/Claims.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {IVerifierPool} from "contracts/core/interfaces/IVerifierPool.sol";
import {IWorkerSBT} from "contracts/core/interfaces/IWorkerSBT.sol";

contract MockVerifierPool {
    function selectJurors(uint256, uint256 panelSize, uint256) external pure returns (address[] memory) {
        address[] memory jurors = new address[](panelSize);
        jurors[0] = address(0x1001);
        jurors[1] = address(0x1002);
        if (panelSize > 2) jurors[2] = address(0x1003);

        jurors[0] = address(0x1001);            weight: 10,

        jurors[1] = address(0x1002);            jurorsMin: 2,

        if (panelSize > 2) jurors[2] = address(0x1003);            panelSize: 3,

        return jurors;            verifyWindow: 24 hours,

    }            cooldown: 1 hours,

}            rewardVerify: 5,

            slashVerifierBps: 1000,

contract MockWorkerSBT {            revocable: true,

    function mintAndAwardPoints(address, uint256, string memory) external pure {            evidenceSpecCID: "QmSpec123"

        // Mock implementation        });

    }    }

}    

    function getActionType(uint256 typeId) external view returns (Types.ActionType memory) {

/// @title Claims Contract Test Suite        return actionTypes[typeId];

/// @notice Comprehensive tests for Claims contract with ValuableActionRegistry integration    }

contract ClaimsTest is Test {}

    Claims public claims;

    ValuableActionRegistry public registry;contract MockVerifierPool {

    MembershipTokenERC20Votes public membershipToken;    function updateReputations(

    MockVerifierPool public verifierPool;        uint256,

    MockWorkerSBT public workerSBT;        address[] calldata,

            bool[] calldata

    address public governance = makeAddr("governance");    ) external {

    address public founder = makeAddr("founder");        // Mock implementation - do nothing

    address public moderator = makeAddr("moderator");    }

    address public worker1 = makeAddr("worker1");}

    address public worker2 = makeAddr("worker2");

    address public juror1 = address(0x1001);contract MockWorkerSBT {

    address public juror2 = address(0x1002);    event SBTMinted(address indexed worker, uint256 points, string metadataURI);

    address public juror3 = address(0x1003);    

        function mintAndAwardPoints(address worker, uint256 points, string calldata metadataURI) external {

    uint256 public constant ACTION_TYPE_1 = 1;        emit SBTMinted(worker, points, metadataURI);

    uint256 public constant ACTION_TYPE_2 = 2;    }

}

    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string evidenceCID);

    event JurorsAssigned(uint256 indexed claimId, address[] jurors);/// @title ClaimsTest

    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);/// @notice Comprehensive tests for Claims contract verification system

    event ClaimResolved(uint256 indexed claimId, Types.ClaimStatus status, uint32 finalApprovals, uint32 finalRejections);contract ClaimsTest is Test {

    Claims public claims;

    function setUp() public {    MockActionRegistry public mockActionRegistry;

        // Deploy contracts    MockVerifierPool public mockVerifierPool;

        membershipToken = new MembershipTokenERC20Votes("TestDAO", "TDAO");    MockWorkerSBT public mockWorkerSBT;

        verifierPool = new MockVerifierPool();    

        workerSBT = new MockWorkerSBT();    address public governance = address(0x1);

            address public worker1 = address(0x10);

        // Deploy ValuableActionRegistry    address public worker2 = address(0x11);

        registry = new ValuableActionRegistry(governance);    address public juror1 = address(0x20);

            address public juror2 = address(0x21);

        // Deploy Claims contract    address public juror3 = address(0x22);

        claims = new Claims(    address public unauthorizedUser = address(0x99);

            governance,    

            address(registry),    uint256 constant ACTION_TYPE_ID = 1;

            address(verifierPool),    string constant EVIDENCE_CID = "QmTestEvidence123";

            address(workerSBT),    string constant APPEAL_REASON = "Evidence was misinterpreted";

            address(membershipToken)

        );    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string evidenceCID);

            event JurorsAssigned(uint256 indexed claimId, address[] jurors);

        // Set up registry with moderator and founder    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);

        vm.startPrank(governance);    event ClaimResolved(uint256 indexed claimId, Types.ClaimStatus status, uint32 finalApprovals, uint32 finalRejections);

        registry.grantModerator(moderator);    event ClaimRevoked(uint256 indexed claimId, address indexed revoker);

        registry.grantFounder(founder);    event AppealSubmitted(uint256 indexed appealId, uint256 indexed claimId, address indexed appellant, string reason);

        vm.stopPrank();    event CooldownUpdated(address indexed worker, uint256 indexed typeId, uint64 nextAllowed);

        

        // Create test ValuableActions    function setUp() public {

        _createTestActions();        // Deploy mock contracts

    }        mockActionRegistry = new MockActionRegistry();

        mockVerifierPool = new MockVerifierPool();

    function _createTestActions() internal {        mockWorkerSBT = new MockWorkerSBT();

        vm.startPrank(founder);        

                // Deploy claims contract

        // Action 1: Standard action with moderate rewards        vm.prank(governance);

        Types.ValuableAction memory action1 = Types.ValuableAction({        claims = new Claims(governance, address(mockActionRegistry), address(mockVerifierPool), address(mockWorkerSBT));

            membershipTokenReward: 100,    }

            communityTokenReward: 50,

            investorSBTReward: 0,    /// @notice Test basic approval workflow

            jurorsMin: 2,    function test_verify_approval() public {

            panelSize: 3,        vm.prank(worker1);

            verifyWindow: 24 hours,        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);

            verifierRewardWeight: 5,        

            slashVerifierBps: 1000,        address[] memory jurors = new address[](3);

            cooldownPeriod: 1 hours,        jurors[0] = juror1;

            maxConcurrent: 2,        jurors[1] = juror2;

            revocable: true,        jurors[2] = juror3;

            evidenceTypes: 1,        

            proposalThreshold: 1000,        vm.prank(address(mockVerifierPool));

            proposer: founder,        claims.assignJurors(claimId, jurors);

            requiresGovernanceApproval: false,        

            evidenceSpecCID: "QmTest1",        // First approval

            titleTemplate: "Standard Work",        vm.expectEmit(true, true, false, true);

            automationRules: new bytes32[](0),        emit ClaimVerified(claimId, juror1, true);

            activationDelay: 0,        vm.prank(juror1);

            deprecationWarning: 30 days,        claims.verify(claimId, true);

            founderVerified: true        

        });        // Check claim is still pending (need 2 out of 3)

                assertTrue(claims.hasJurorVoted(claimId, juror1));

        registry.proposeValuableAction("Standard Action", "QmDesc1", action1);        (, , , Types.ClaimStatus status, , , , uint32 approvalsCount, uint32 rejectionsCount, bool resolved) = claims.getClaim(claimId);

                assertEq(uint8(status), uint8(Types.ClaimStatus.Pending));

        // Action 2: High-reward action with longer cooldown        assertEq(approvalsCount, 1);

        Types.ValuableAction memory action2 = Types.ValuableAction({        assertEq(rejectionsCount, 0);

            membershipTokenReward: 500,        assertFalse(resolved);

            communityTokenReward: 250,        

            investorSBTReward: 0,        // Second approval should resolve the claim

            jurorsMin: 3,        vm.expectEmit(true, false, false, true);

            panelSize: 5,        emit ClaimResolved(claimId, Types.ClaimStatus.Approved, 2, 0);

            verifyWindow: 48 hours,        vm.prank(juror2);

            verifierRewardWeight: 10,        claims.verify(claimId, true);

            slashVerifierBps: 1500,        

            cooldownPeriod: 7 days,        // Check claim is resolved

            maxConcurrent: 1,        (, , , Types.ClaimStatus finalStatus, , , , , , bool finalResolved) = claims.getClaim(claimId);

            revocable: false,        assertEq(uint8(finalStatus), uint8(Types.ClaimStatus.Approved));

            evidenceTypes: 3,        assertTrue(finalResolved);

            proposalThreshold: 5000,    }

            proposer: founder,

            requiresGovernanceApproval: false,    /// @notice Test mixed voting scenario

            evidenceSpecCID: "QmTest2",    function test_mixedVoting() public {

            titleTemplate: "High Value Work",        vm.prank(worker1);

            automationRules: new bytes32[](0),        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);

            activationDelay: 0,        

            deprecationWarning: 60 days,        address[] memory jurors = new address[](5);

            founderVerified: true        jurors[0] = juror1;

        });        jurors[1] = juror2;

                jurors[2] = juror3;

        registry.proposeValuableAction("High Value Action", "QmDesc2", action2);        jurors[3] = address(0x23);

                jurors[4] = address(0x24);

        vm.stopPrank();        

    }        vm.prank(address(mockVerifierPool));

        claims.assignJurors(claimId, jurors);

    /*//////////////////////////////////////////////////////////////        

                             CONSTRUCTOR TESTS        // Mixed votes: 2 approve, 1 reject, need 3 for majority

    //////////////////////////////////////////////////////////////*/        vm.prank(juror1);

        claims.verify(claimId, true);

    function testConstructor() public {        

        Claims testClaims = new Claims(        vm.prank(juror2);

            governance,        claims.verify(claimId, false);

            address(registry),        

            address(verifierPool),        vm.prank(juror3);

            address(workerSBT),        claims.verify(claimId, true);

            address(membershipToken)        

        );        // Should still be pending (2 approvals, need 3)

                (, , , Types.ClaimStatus status, , , , uint32 approvals, uint32 rejections, bool resolved) = claims.getClaim(claimId);

        assertEq(address(testClaims.actionRegistry()), address(registry));        assertEq(uint8(status), uint8(Types.ClaimStatus.Pending));

        assertEq(testClaims.verifierPool(), address(verifierPool));        assertEq(approvals, 2);

        assertEq(testClaims.workerSBT(), address(workerSBT));        assertEq(rejections, 1);

        assertEq(testClaims.governance(), governance);        assertFalse(resolved);

        assertEq(testClaims.membershipToken(), address(membershipToken));        

    }        // Third approval should resolve

        vm.prank(address(0x23));

    function testConstructorZeroAddressReverts() public {        claims.verify(claimId, true);

        vm.expectRevert(Errors.ZeroAddress.selector);        

        new Claims(address(0), address(registry), address(verifierPool), address(workerSBT), address(membershipToken));        (, , , Types.ClaimStatus finalStatus, , , , , , bool finalResolved) = claims.getClaim(claimId);

                assertEq(uint8(finalStatus), uint8(Types.ClaimStatus.Approved));

        vm.expectRevert(Errors.ZeroAddress.selector);        assertTrue(finalResolved);

        new Claims(governance, address(0), address(verifierPool), address(workerSBT), address(membershipToken));    }

        

        vm.expectRevert(Errors.ZeroAddress.selector);    /// @notice Test revoke success

        new Claims(governance, address(registry), address(0), address(workerSBT), address(membershipToken));    function test_revoke_success() public {

                vm.prank(worker1);

        vm.expectRevert(Errors.ZeroAddress.selector);        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);

        new Claims(governance, address(registry), address(verifierPool), address(0), address(membershipToken));        

                address[] memory jurors = new address[](3);

        vm.expectRevert(Errors.ZeroAddress.selector);        jurors[0] = juror1;

        new Claims(governance, address(registry), address(verifierPool), address(workerSBT), address(0));        jurors[1] = juror2;

    }        jurors[2] = juror3;

        

    /*//////////////////////////////////////////////////////////////        vm.prank(address(mockVerifierPool));

                             CLAIM SUBMISSION TESTS        claims.assignJurors(claimId, jurors);

    //////////////////////////////////////////////////////////////*/        

        // Approve the claim first

    function testSubmitClaim() public {        vm.prank(juror1);

        vm.expectEmit(true, true, true, true);        claims.verify(claimId, true);

        emit ClaimSubmitted(1, ACTION_TYPE_1, worker1, "QmEvidence1");        vm.prank(juror2);

                claims.verify(claimId, true);

        vm.prank(worker1);        

        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");        // Now revoke it

                vm.expectEmit(true, false, false, false);

        assertEq(claimId, 1);        emit ClaimRevoked(claimId, governance);

                

        (        vm.prank(governance);

            uint256 typeId,        claims.revoke(claimId);

            address worker,        

            string memory evidenceCID,        (, , , Types.ClaimStatus status, , , , , , bool resolved) = claims.getClaim(claimId);

            Types.ClaimStatus status,        assertEq(uint8(status), uint8(Types.ClaimStatus.Revoked));

            uint64 createdAt,        assertTrue(resolved);

            uint64 verifyDeadline,    }

            address[] memory jurors,

            uint32 approvalsCount,    /// @notice Test submit with cooldown

            uint32 rejectionsCount    function test_submit_cooldown() public {

        ) = claims.claims(claimId);        // Submit first claim

                vm.prank(worker1);

        assertEq(typeId, ACTION_TYPE_1);        uint256 claimId1 = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);

        assertEq(worker, worker1);        

        assertEq(evidenceCID, "QmEvidence1");        // Assign jurors and approve to trigger cooldown

        assertEq(uint256(status), uint256(Types.ClaimStatus.Pending));        address[] memory jurors = new address[](3);

        assertEq(createdAt, block.timestamp);        jurors[0] = juror1;

        assertEq(verifyDeadline, block.timestamp + 24 hours);        jurors[1] = juror2;

        assertEq(jurors.length, 3); // From mock verifier pool        jurors[2] = juror3;

        assertEq(approvalsCount, 0);        

        assertEq(rejectionsCount, 0);        vm.prank(address(mockVerifierPool));

    }        claims.assignJurors(claimId1, jurors);

        

    function testSubmitClaimEmptyEvidenceFails() public {        // All jurors approve (majority resolves)

        vm.prank(worker1);        vm.prank(juror1);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence CID cannot be empty"));        claims.verify(claimId1, true);

        claims.submit(ACTION_TYPE_1, "");        vm.prank(juror2);

    }        claims.verify(claimId1, true); // This should resolve and set cooldown

        

    function testSubmitClaimInactiveActionFails() public {        // Check that cooldown is set

        // Deactivate the action        uint256 cooldownTime = claims.getWorkerCooldown(worker1, ACTION_TYPE_ID);

        vm.prank(governance);        assertGt(cooldownTime, block.timestamp);

        registry.deactivateValuableAction(ACTION_TYPE_1);        

                // Try to submit another claim during cooldown

        vm.prank(worker1);        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Worker is in cooldown period"));

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Action type is not active"));        vm.prank(worker1);

        claims.submit(ACTION_TYPE_1, "QmEvidence1");        claims.submit(ACTION_TYPE_ID, "QmNewEvidence456");

    }        

        // Fast forward past cooldown and try again

    function testSubmitClaimDuringCooldown() public {        vm.warp(cooldownTime + 1);

        // Submit first claim        

        vm.prank(worker1);        vm.prank(worker1);

        claims.submit(ACTION_TYPE_1, "QmEvidence1");        uint256 claimId2 = claims.submit(ACTION_TYPE_ID, "QmNewEvidence456");

                assertGt(claimId2, claimId1);

        // Approve the claim to trigger cooldown    }

        vm.prank(juror1);

        claims.verify(1, true, "Good work");    /// @notice Test verify already resolved

        vm.prank(juror2);    function test_verify_alreadyResolved() public {

        claims.verify(1, true, "Approved");        vm.prank(worker1);

                uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);

        // Try to submit another claim during cooldown        

        vm.prank(worker1);        address[] memory jurors = new address[](3);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Worker is in cooldown period"));        jurors[0] = juror1;

        claims.submit(ACTION_TYPE_1, "QmEvidence2");        jurors[1] = juror2;

    }        jurors[2] = juror3;

        

    function testSubmitClaimMaxConcurrentReached() public {        vm.prank(address(mockVerifierPool));

        // Submit first claim (Action 1 allows 2 concurrent)        claims.assignJurors(claimId, jurors);

        vm.prank(worker1);        

        claims.submit(ACTION_TYPE_1, "QmEvidence1");        // Approve the claim (resolve it)

                vm.prank(juror1);

        // Submit second claim (should work)        claims.verify(claimId, true);

        vm.prank(worker1);        vm.prank(juror2);

        claims.submit(ACTION_TYPE_1, "QmEvidence2");        claims.verify(claimId, true); // This resolves it

                

        // Try third claim (should fail)        // Try to vote again on resolved claim

        vm.prank(worker1);        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Claim already resolved"));

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Too many concurrent claims for this action type"));        vm.prank(juror3);

        claims.submit(ACTION_TYPE_1, "QmEvidence3");        claims.verify(claimId, true);

    }    }



    /*//////////////////////////////////////////////////////////////    /// @notice Test deployment

                             VERIFICATION TESTS    function test_deployment() public {

    //////////////////////////////////////////////////////////////*/        assertEq(claims.governance(), governance);

        assertEq(claims.actionRegistry(), address(mockActionRegistry));

    function testVerifyClaim() public {        assertEq(claims.verifierPool(), address(mockVerifierPool));

        // Submit claim        assertEq(claims.workerSBT(), address(mockWorkerSBT));

        vm.prank(worker1);        assertEq(claims.lastClaimId(), 0);

        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");        assertEq(claims.lastAppealId(), 0);

            }

        // First verification

        vm.expectEmit(true, true, true, true);    /// @notice Test successful claim submission

        emit ClaimVerified(claimId, juror1, true);    function test_submit_success() public {

                vm.expectEmit(true, true, true, true);

        vm.prank(juror1);        emit ClaimSubmitted(1, ACTION_TYPE_ID, worker1, EVIDENCE_CID);

        claims.verify(claimId, true, "Good work");        

                vm.prank(worker1);

        // Check vote recorded        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);

        (, , , , , , , uint32 approvals, ) = claims.claims(claimId);        

        assertEq(approvals, 1);        assertEq(claimId, 1);

    }        assertEq(claims.lastClaimId(), 1);

        

    function testVerifyClaimResolution() public {        (

        // Submit claim              uint256 typeId,

        vm.prank(worker1);            address worker,

        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");            string memory evidenceCID,

                    Types.ClaimStatus status,

        // Get initial membership token balance            uint64 createdAt,

        uint256 initialBalance = membershipToken.balanceOf(worker1);            uint64 verifyDeadline,

                    address[] memory jurors,

        vm.expectEmit(true, true, true, true);            uint32 approvalsCount,

        emit ClaimResolved(claimId, Types.ClaimStatus.Approved, 2, 0);            uint32 rejectionsCount,

                    bool resolved

        // Two approvals should resolve the claim (jurorsMin = 2)        ) = claims.getClaim(claimId);

        vm.prank(juror1);        

        claims.verify(claimId, true, "Approved");        assertEq(typeId, ACTION_TYPE_ID);

        vm.prank(juror2);        assertEq(worker, worker1);

        claims.verify(claimId, true, "Approved");        assertEq(evidenceCID, EVIDENCE_CID);

                assertEq(uint8(status), uint8(Types.ClaimStatus.Pending));

        // Check claim status        assertEq(createdAt, block.timestamp);

        (, , , Types.ClaimStatus status, , , , , ) = claims.claims(claimId);        assertEq(verifyDeadline, block.timestamp + 24 hours);

        assertEq(uint256(status), uint256(Types.ClaimStatus.Approved));        assertEq(jurors.length, 0);

                assertEq(approvalsCount, 0);

        // Check membership tokens were minted        assertEq(rejectionsCount, 0);

        assertEq(membershipToken.balanceOf(worker1), initialBalance + 100);        assertFalse(resolved);

            }

        // Check cooldown was set

        assertEq(claims.workerCooldowns(worker1, ACTION_TYPE_1), block.timestamp + 1 hours);    /// @notice Test submit fails with empty evidence CID

    }    function test_submit_emptyEvidence() public {

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence CID cannot be empty"));

    function testVerifyClaimRejection() public {        vm.prank(worker1);

        // Submit claim        claims.submit(ACTION_TYPE_ID, "");

        vm.prank(worker1);      }

        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");}
        
        vm.expectEmit(true, true, true, true);
        emit ClaimResolved(claimId, Types.ClaimStatus.Rejected, 0, 2);
        
        // Two rejections should resolve the claim
        vm.prank(juror1);
        claims.verify(claimId, false, "Poor quality");
        vm.prank(juror2);
        claims.verify(claimId, false, "Insufficient evidence");
        
        // Check claim status
        (, , , Types.ClaimStatus status, , , , , ) = claims.claims(claimId);
        assertEq(uint256(status), uint256(Types.ClaimStatus.Rejected));
    }

    function testVerifyUnauthorizedJurorFails() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        vm.prank(worker2); // Not a juror
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, worker2));
        claims.verify(claimId, true, "Not authorized");
    }

    function testVerifyTwiceFails() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        vm.prank(juror1);
        claims.verify(claimId, true, "First vote");
        
        vm.prank(juror1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Already voted"));
        claims.verify(claimId, false, "Second vote");
    }

    function testVerifyExpiredClaimFails() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        // Fast forward past verification deadline
        vm.warp(block.timestamp + 25 hours);
        
        vm.prank(juror1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verification period expired"));
        claims.verify(claimId, true, "Too late");
    }

    /*//////////////////////////////////////////////////////////////
                             JUROR ASSIGNMENT TESTS
    //////////////////////////////////////////////////////////////*/

    function testAssignJurors() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        address[] memory newJurors = new address[](2);
        newJurors[0] = makeAddr("newJuror1");
        newJurors[1] = makeAddr("newJuror2");
        
        vm.expectEmit(true, true, true, true);
        emit JurorsAssigned(claimId, newJurors);
        
        vm.prank(address(verifierPool));
        claims.assignJurors(claimId, newJurors);
        
        (, , , , , , address[] memory jurors, , ) = claims.claims(claimId);
        assertEq(jurors.length, 2);
        assertEq(jurors[0], newJurors[0]);
        assertEq(jurors[1], newJurors[1]);
    }

    function testAssignJurorsUnauthorizedFails() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        address[] memory newJurors = new address[](1);
        newJurors[0] = makeAddr("newJuror1");
        
        vm.prank(worker2); // Not verifier pool
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, worker2));
        claims.assignJurors(claimId, newJurors);
    }

    /*//////////////////////////////////////////////////////////////
                             ADMIN FUNCTIONS TESTS
    //////////////////////////////////////////////////////////////*/

    function testRevokeClaimByGovernance() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        vm.prank(governance);
        claims.revokeClaimByGovernance(claimId);
        
        (, , , Types.ClaimStatus status, , , , , ) = claims.claims(claimId);
        assertEq(uint256(status), uint256(Types.ClaimStatus.Revoked));
    }

    function testUpdateContracts() public {
        address newVerifierPool = makeAddr("newVerifierPool");
        address newWorkerSBT = makeAddr("newWorkerSBT");
        
        vm.prank(governance);
        claims.updateContracts(newVerifierPool, newWorkerSBT);
        
        assertEq(claims.verifierPool(), newVerifierPool);
        assertEq(claims.workerSBT(), newWorkerSBT);
    }

    function testUpdateGovernance() public {
        address newGovernance = makeAddr("newGovernance");
        
        vm.prank(governance);
        claims.updateGovernance(newGovernance);
        
        assertEq(claims.governance(), newGovernance);
    }

    /*//////////////////////////////////////////////////////////////
                             INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testEndToEndClaimWorkflow() public {
        // 1. Submit claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        // 2. Verify it's pending
        (, , , Types.ClaimStatus status, , , , , ) = claims.claims(claimId);
        assertEq(uint256(status), uint256(Types.ClaimStatus.Pending));
        
        // 3. Jurors vote to approve
        vm.prank(juror1);
        claims.verify(claimId, true, "Quality work");
        vm.prank(juror2);
        claims.verify(claimId, true, "Meets requirements");
        
        // 4. Check final state
        (, , , status, , , , uint32 approvals, uint32 rejections) = claims.claims(claimId);
        assertEq(uint256(status), uint256(Types.ClaimStatus.Approved));
        assertEq(approvals, 2);
        assertEq(rejections, 0);
        
        // 5. Check rewards were distributed
        assertEq(membershipToken.balanceOf(worker1), 100);
        
        // 6. Check cooldown is active
        assertEq(claims.workerCooldowns(worker1, ACTION_TYPE_1), block.timestamp + 1 hours);
    }

    function testMultipleClaimsWithDifferentOutcomes() public {
        // Submit two claims
        vm.prank(worker1);
        uint256 claimId1 = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        vm.prank(worker2); 
        uint256 claimId2 = claims.submit(ACTION_TYPE_1, "QmEvidence2");
        
        // Approve first claim
        vm.prank(juror1);
        claims.verify(claimId1, true, "Good");
        vm.prank(juror2);
        claims.verify(claimId1, true, "Approved");
        
        // Check first claim approved
        (, , , Types.ClaimStatus status1, , , , , ) = claims.claims(claimId1);
        assertEq(uint256(status1), uint256(Types.ClaimStatus.Approved));
        
        // Reject second claim  
        vm.prank(juror1);
        claims.verify(claimId2, false, "Poor quality");
        vm.prank(juror2);
        claims.verify(claimId2, false, "Rejected");
        
        // Check second claim rejected
        (, , , Types.ClaimStatus status2, , , , , ) = claims.claims(claimId2);
        assertEq(uint256(status2), uint256(Types.ClaimStatus.Rejected));
        
        // Check only worker1 got tokens
        assertEq(membershipToken.balanceOf(worker1), 100);
        assertEq(membershipToken.balanceOf(worker2), 0);
    }

    /*//////////////////////////////////////////////////////////////
                             EDGE CASE TESTS
    //////////////////////////////////////////////////////////////*/

    function testHighValueActionParameters() public {
        // Test Action 2 with different parameters
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_2, "QmHighValueEvidence");
        
        // Check verification deadline is 48 hours
        (, , , , , uint64 verifyDeadline, , , ) = claims.claims(claimId);
        assertEq(verifyDeadline, block.timestamp + 48 hours);
        
        // Need 3 approvals for this action type (jurorsMin = 3)
        vm.prank(juror1);
        claims.verify(claimId, true, "Approved 1");
        vm.prank(juror2);
        claims.verify(claimId, true, "Approved 2");
        
        // Should still be pending after 2 approvals
        (, , , Types.ClaimStatus status, , , , , ) = claims.claims(claimId);
        assertEq(uint256(status), uint256(Types.ClaimStatus.Pending));
        
        // Third approval should resolve it
        vm.prank(juror3);
        claims.verify(claimId, true, "Approved 3");
        
        (, , , status, , , , , ) = claims.claims(claimId);
        assertEq(uint256(status), uint256(Types.ClaimStatus.Approved));
        
        // Check higher reward was minted (500 tokens)
        assertEq(membershipToken.balanceOf(worker1), 500);
        
        // Check longer cooldown (7 days)
        assertEq(claims.workerCooldowns(worker1, ACTION_TYPE_2), block.timestamp + 7 days);
    }

    function testCountActiveClaimsHelper() public {
        vm.startPrank(worker1);
        
        // Submit 2 claims for action type 1
        claims.submit(ACTION_TYPE_1, "Evidence1");
        claims.submit(ACTION_TYPE_1, "Evidence2");
        
        // Should have 2 active claims now (can't test the private function directly,
        // but we can test the behavior by trying to submit a third)
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Too many concurrent claims for this action type"));
        claims.submit(ACTION_TYPE_1, "Evidence3");
        
        vm.stopPrank();
    }
}
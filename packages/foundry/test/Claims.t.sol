// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Claims} from "contracts/modules/Claims.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title ClaimsTest
/// @notice Comprehensive tests for Claims contract verification system
contract ClaimsTest is Test {
    Claims public claims;
    
    address public governance = address(0x1);
    address public actionRegistry = address(0x2);
    address public verifierPool = address(0x3);
    address public workerSBT = address(0x4);
    
    address public worker1 = address(0x10);
    address public worker2 = address(0x11);
    address public juror1 = address(0x20);
    address public juror2 = address(0x21);
    address public juror3 = address(0x22);
    address public unauthorizedUser = address(0x99);
    
    uint256 constant ACTION_TYPE_ID = 1;
    string constant EVIDENCE_CID = "QmTestEvidence123";
    string constant APPEAL_REASON = "Evidence was misinterpreted";

    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string evidenceCID);
    event JurorsAssigned(uint256 indexed claimId, address[] jurors);
    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);
    event ClaimResolved(uint256 indexed claimId, Types.ClaimStatus status, uint32 finalApprovals, uint32 finalRejections);
    event ClaimRevoked(uint256 indexed claimId, address indexed revoker);
    event AppealSubmitted(uint256 indexed appealId, uint256 indexed claimId, address indexed appellant, string reason);
    event CooldownUpdated(address indexed worker, uint256 indexed typeId, uint64 nextAllowed);

    function setUp() public {
        // Deploy claims contract
        vm.prank(governance);
        claims = new Claims(governance, actionRegistry, verifierPool, workerSBT);
    }

    /// @notice Test deployment
    function test_deployment() public {
        assertEq(claims.governance(), governance);
        assertEq(claims.actionRegistry(), actionRegistry);
        assertEq(claims.verifierPool(), verifierPool);
        assertEq(claims.workerSBT(), workerSBT);
        assertEq(claims.lastClaimId(), 0);
        assertEq(claims.lastAppealId(), 0);
    }

    /// @notice Test deployment with zero addresses fails
    function test_deployment_zeroAddresses() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(address(0), actionRegistry, verifierPool, workerSBT);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(governance, address(0), verifierPool, workerSBT);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(governance, actionRegistry, address(0), workerSBT);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(governance, actionRegistry, verifierPool, address(0));
    }

    /// @notice Test submitting a claim
    function test_submit_success() public {
        vm.expectEmit(true, true, true, true);
        emit ClaimSubmitted(1, ACTION_TYPE_ID, worker1, EVIDENCE_CID);
        
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        assertEq(claimId, 1);
        assertEq(claims.lastClaimId(), 1);
        
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
        
        assertEq(typeId, ACTION_TYPE_ID);
        assertEq(worker, worker1);
        assertEq(evidenceCID, EVIDENCE_CID);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Pending));
        assertEq(createdAt, block.timestamp);
        assertEq(verifyDeadline, block.timestamp + 24 hours);
        assertEq(jurors.length, 0); // No jurors assigned yet
        assertEq(approvalsCount, 0);
        assertEq(rejectionsCount, 0);
        assertFalse(resolved);
        
        // Check pending claims tracking
        uint256[] memory pendingClaims = claims.getPendingClaims(ACTION_TYPE_ID);
        assertEq(pendingClaims.length, 1);
        assertEq(pendingClaims[0], claimId);
        
        // Check worker claims tracking  
        uint256[] memory workerClaims = claims.getClaimsByWorker(worker1);
        assertEq(workerClaims.length, 1);
        assertEq(workerClaims[0], claimId);
    }

    /// @notice Test submit fails with empty evidence CID
    function test_submit_emptyEvidence() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence CID cannot be empty"));
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_ID, "");
    }

    /// @notice Test submit fails during cooldown
    function test_submit_cooldown() public {
        // Submit first claim
        vm.prank(worker1);
        uint256 claimId1 = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        // Assign jurors and approve to trigger cooldown
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId1, jurors);
        
        // All jurors approve
        vm.prank(juror1);
        claims.verify(claimId1, true);
        vm.prank(juror2);
        claims.verify(claimId1, true); // This should resolve as approved and set cooldown
        
        // Try to submit another claim during cooldown
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Worker is in cooldown period"));
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_ID, "QmNewEvidence456");
        
        // Fast forward past cooldown and try again
        vm.warp(block.timestamp + 2 hours);
        
        vm.prank(worker1);
        uint256 claimId2 = claims.submit(ACTION_TYPE_ID, "QmNewEvidence456");
        assertEq(claimId2, 2);
    }

    /// @notice Test assigning jurors
    function test_assignJurors_success() public {
        // Submit claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.expectEmit(true, false, false, true);
        emit JurorsAssigned(claimId, jurors);
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        (, , , , , , address[] memory assignedJurors, , , ) = claims.getClaim(claimId);
        assertEq(assignedJurors.length, 3);
        assertEq(assignedJurors[0], juror1);
        assertEq(assignedJurors[1], juror2);
        assertEq(assignedJurors[2], juror3);
    }

    /// @notice Test assign jurors fails for unauthorized caller
    function test_assignJurors_unauthorized() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](1);
        jurors[0] = juror1;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        claims.assignJurors(claimId, jurors);
    }

    /// @notice Test assign jurors fails for invalid claim
    function test_assignJurors_invalidClaim() public {
        address[] memory jurors = new address[](1);
        jurors[0] = juror1;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid claim ID"));
        vm.prank(verifierPool);
        claims.assignJurors(999, jurors);
    }

    /// @notice Test assign jurors fails with empty array
    function test_assignJurors_emptyArray() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "No jurors provided"));
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
    }

    /// @notice Test verification voting - approval path
    function test_verify_approval() public {
        // Setup claim with jurors
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        // First juror approves
        vm.expectEmit(true, true, false, true);
        emit ClaimVerified(claimId, juror1, true);
        
        vm.prank(juror1);
        claims.verify(claimId, true);
        
        assertTrue(claims.hasJurorVoted(claimId, juror1));
        (, , , , , , , uint32 approvalsCount, uint32 rejectionsCount, bool resolved) = claims.getClaim(claimId);
        assertEq(approvalsCount, 1);
        assertEq(rejectionsCount, 0);
        assertFalse(resolved);
        
        // Second juror approves - should resolve as approved (majority reached)
        vm.expectEmit(true, false, false, true);
        emit ClaimResolved(claimId, Types.ClaimStatus.Approved, 2, 0);
        
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        (, , , Types.ClaimStatus status, , , , uint32 finalApprovals, , bool finalResolved) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Approved));
        assertEq(finalApprovals, 2);
        assertTrue(finalResolved);
        
        // Check cooldown was set
        uint64 cooldownEnd = claims.getWorkerCooldown(worker1, ACTION_TYPE_ID);
        assertGt(cooldownEnd, block.timestamp);
        
        // Check removed from pending
        uint256[] memory pendingClaims = claims.getPendingClaims(ACTION_TYPE_ID);
        assertEq(pendingClaims.length, 0);
    }

    /// @notice Test verification voting - rejection path
    function test_verify_rejection() public {
        // Setup claim with jurors
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        // First juror rejects
        vm.prank(juror1);
        claims.verify(claimId, false);
        
        // Second juror rejects - should resolve as rejected
        vm.expectEmit(true, false, false, true);
        emit ClaimResolved(claimId, Types.ClaimStatus.Rejected, 0, 2);
        
        vm.prank(juror2);
        claims.verify(claimId, false);
        
        (, , , Types.ClaimStatus status, , , , , uint32 finalRejections, bool resolved) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Rejected));
        assertEq(finalRejections, 2);
        assertTrue(resolved);
        
        // Check no cooldown was set for rejected claim
        uint64 cooldownEnd = claims.getWorkerCooldown(worker1, ACTION_TYPE_ID);
        assertEq(cooldownEnd, 0);
    }

    /// @notice Test verify fails for unauthorized juror
    function test_verify_unauthorized() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](1);
        jurors[0] = juror1;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        claims.verify(claimId, true);
    }

    /// @notice Test verify fails for already resolved claim
    function test_verify_alreadyResolved() public {
        // Setup and resolve claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        // Resolve with majority approvals
        vm.prank(juror1);
        claims.verify(claimId, true);
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        // Try to vote again
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Claim already resolved"));
        vm.prank(juror3);
        claims.verify(claimId, true);
    }

    /// @notice Test verify fails after deadline
    function test_verify_pastDeadline() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](1);
        jurors[0] = juror1;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        // Fast forward past deadline
        vm.warp(block.timestamp + 25 hours);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verification deadline passed"));
        vm.prank(juror1);
        claims.verify(claimId, true);
    }

    /// @notice Test verify fails for double voting
    function test_verify_doubleVote() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        // Use 3 jurors so single vote doesn't resolve claim
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        vm.prank(juror1);
        claims.verify(claimId, true);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Juror already voted"));
        vm.prank(juror1);
        claims.verify(claimId, false);
    }

    /// @notice Test submitting appeal
    function test_submitAppeal_success() public {
        // Create and reject claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        // Reject claim
        vm.prank(juror1);
        claims.verify(claimId, false);
        vm.prank(juror2);
        claims.verify(claimId, false);
        
        // Submit appeal
        vm.expectEmit(true, true, true, true);
        emit AppealSubmitted(1, claimId, worker1, APPEAL_REASON);
        
        vm.prank(worker1);
        uint256 appealId = claims.submitAppeal(claimId, APPEAL_REASON);
        
        assertEq(appealId, 1);
        assertEq(claims.lastAppealId(), 1);
    }

    /// @notice Test appeal fails for invalid claim
    function test_submitAppeal_invalidClaim() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid claim ID"));
        vm.prank(worker1);
        claims.submitAppeal(999, APPEAL_REASON);
    }

    /// @notice Test appeal fails for unauthorized worker
    function test_submitAppeal_unauthorized() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](1);
        jurors[0] = juror1;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        vm.prank(juror1);
        claims.verify(claimId, false);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, worker2));
        vm.prank(worker2);
        claims.submitAppeal(claimId, APPEAL_REASON);
    }

    /// @notice Test appeal fails for non-rejected claim
    function test_submitAppeal_notRejected() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Can only appeal rejected claims"));
        vm.prank(worker1);
        claims.submitAppeal(claimId, APPEAL_REASON);
    }

    /// @notice Test appeal fails with empty reason
    function test_submitAppeal_emptyReason() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](1);
        jurors[0] = juror1;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        vm.prank(juror1);
        claims.verify(claimId, false);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Appeal reason cannot be empty"));
        vm.prank(worker1);
        claims.submitAppeal(claimId, "");
    }

    /// @notice Test revoking approved claim
    function test_revoke_success() public {
        // Create and approve claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        vm.prank(juror1);
        claims.verify(claimId, true);
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        // Revoke claim
        vm.expectEmit(true, true, false, false);
        emit ClaimRevoked(claimId, governance);
        
        vm.prank(governance);
        claims.revoke(claimId);
        
        (, , , Types.ClaimStatus status, , , , , , ) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Revoked));
    }

    /// @notice Test revoke fails for unauthorized caller
    function test_revoke_unauthorized() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        claims.revoke(claimId);
    }

    /// @notice Test revoke fails for invalid claim
    function test_revoke_invalidClaim() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid claim ID"));
        vm.prank(governance);
        claims.revoke(999);
    }

    /// @notice Test getClaim fails for invalid claim
    function test_getClaim_invalidClaim() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid claim ID"));
        claims.getClaim(999);
    }

    /// @notice Test multiple claims by same worker
    function test_multipleClaims() public {
        // Submit first claim
        vm.prank(worker1);
        uint256 claimId1 = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        // Approve it to clear cooldown setup
        address[] memory jurors = new address[](1);
        jurors[0] = juror1;
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId1, jurors);
        
        vm.prank(juror1);
        claims.verify(claimId1, false); // Reject to avoid cooldown
        
        // Submit second claim
        vm.prank(worker1);
        uint256 claimId2 = claims.submit(ACTION_TYPE_ID, "QmAnotherEvidence456");
        
        // Check worker claims tracking
        uint256[] memory workerClaims = claims.getClaimsByWorker(worker1);
        assertEq(workerClaims.length, 2);
        assertEq(workerClaims[0], claimId1);
        assertEq(workerClaims[1], claimId2);
    }

    /// @notice Test updating contract addresses
    function test_updateContracts_success() public {
        address newActionRegistry = address(0x100);
        address newVerifierPool = address(0x101);
        address newWorkerSBT = address(0x102);
        
        vm.prank(governance);
        claims.updateContracts(newActionRegistry, newVerifierPool, newWorkerSBT);
        
        assertEq(claims.actionRegistry(), newActionRegistry);
        assertEq(claims.verifierPool(), newVerifierPool);
        assertEq(claims.workerSBT(), newWorkerSBT);
    }

    /// @notice Test update contracts fails for unauthorized caller
    function test_updateContracts_unauthorized() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        claims.updateContracts(address(0x100), address(0x101), address(0x102));
    }

    /// @notice Test updating governance
    function test_updateGovernance_success() public {
        address newGovernance = address(0x999);
        
        vm.prank(governance);
        claims.updateGovernance(newGovernance);
        
        assertEq(claims.governance(), newGovernance);
    }

    /// @notice Test update governance fails for unauthorized caller
    function test_updateGovernance_unauthorized() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        claims.updateGovernance(address(0x999));
    }

    /// @notice Test update governance with zero address fails
    function test_updateGovernance_zeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(governance);
        claims.updateGovernance(address(0));
    }

    /// @notice Test mixed voting scenario
    function test_mixedVoting() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](5);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        jurors[3] = address(0x23);
        jurors[4] = address(0x24);
        
        vm.prank(verifierPool);
        claims.assignJurors(claimId, jurors);
        
        // Mixed votes: 2 approve, 1 reject, need 3 for majority
        vm.prank(juror1);
        claims.verify(claimId, true);
        
        vm.prank(juror2);
        claims.verify(claimId, false);
        
        vm.prank(juror3);
        claims.verify(claimId, true);
        
        // Should still be pending (2 approvals, need 3)
        (, , , Types.ClaimStatus status, , , , uint32 approvals, uint32 rejections, bool resolved) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Pending));
        assertEq(approvals, 2);
        assertEq(rejections, 1);
        assertFalse(resolved);
        
        // Third approval should resolve
        vm.prank(address(0x23));
        claims.verify(claimId, true);
        
        (, , , Types.ClaimStatus finalStatus, , , , , , bool finalResolved) = claims.getClaim(claimId);
        assertEq(uint8(finalStatus), uint8(Types.ClaimStatus.Approved));
        assertTrue(finalResolved);
    }
}
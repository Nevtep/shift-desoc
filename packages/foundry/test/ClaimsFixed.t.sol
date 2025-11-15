// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Claims} from "contracts/modules/Claims.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title Mock contracts for testing
contract MockActionRegistry {
    mapping(uint256 => Types.ActionType) public actionTypes;
    
    constructor() {
        // Set up default action type for testing
        actionTypes[1] = Types.ActionType({
            weight: 10,
            jurorsMin: 2,
            panelSize: 3,
            verifyWindow: 24 hours,
            cooldown: 1 hours,
            rewardVerify: 5,
            slashVerifierBps: 1000,
            revocable: true,
            evidenceSpecCID: "QmSpec123"
        });
    }
    
    function getActionType(uint256 typeId) external view returns (Types.ActionType memory) {
        return actionTypes[typeId];
    }
}

contract MockVerifierPool {
    function updateReputations(
        uint256,
        address[] calldata,
        bool[] calldata
    ) external {
        // Mock implementation - do nothing
    }
}

contract MockWorkerSBT {
    event SBTMinted(address indexed worker, uint256 points, string metadataURI);
    
    function mintAndAwardPoints(address worker, uint256 points, string calldata metadataURI) external {
        emit SBTMinted(worker, points, metadataURI);
    }
}

/// @title ClaimsFixedTest
/// @notice Fixed tests for Claims contract verification system
contract ClaimsFixedTest is Test {
    Claims public claims;
    MockActionRegistry public mockActionRegistry;
    MockVerifierPool public mockVerifierPool;
    MockWorkerSBT public mockWorkerSBT;
    
    address public governance = address(0x1);
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
        // Deploy mock contracts
        mockActionRegistry = new MockActionRegistry();
        mockVerifierPool = new MockVerifierPool();
        mockWorkerSBT = new MockWorkerSBT();
        
        // Deploy claims contract
        vm.prank(governance);
        claims = new Claims(governance, address(mockActionRegistry), address(mockVerifierPool), address(mockWorkerSBT));
    }

    /// @notice Test basic approval workflow
    function test_verify_approval() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(address(mockVerifierPool));
        claims.assignJurors(claimId, jurors);
        
        // First approval
        vm.expectEmit(true, true, false, true);
        emit ClaimVerified(claimId, juror1, true);
        vm.prank(juror1);
        claims.verify(claimId, true);
        
        // Check claim is still pending (need 2 out of 3)
        assertTrue(claims.hasJurorVoted(claimId, juror1));
        (, , , Types.ClaimStatus status, , , , uint32 approvalsCount, uint32 rejectionsCount, bool resolved) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Pending));
        assertEq(approvalsCount, 1);
        assertEq(rejectionsCount, 0);
        assertFalse(resolved);
        
        // Second approval should resolve the claim
        vm.expectEmit(true, false, false, true);
        emit ClaimResolved(claimId, Types.ClaimStatus.Approved, 2, 0);
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        // Check claim is resolved
        (, , , Types.ClaimStatus finalStatus, , , , , , bool finalResolved) = claims.getClaim(claimId);
        assertEq(uint8(finalStatus), uint8(Types.ClaimStatus.Approved));
        assertTrue(finalResolved);
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
        
        vm.prank(address(mockVerifierPool));
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

    /// @notice Test revoke success
    function test_revoke_success() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(address(mockVerifierPool));
        claims.assignJurors(claimId, jurors);
        
        // Approve the claim first
        vm.prank(juror1);
        claims.verify(claimId, true);
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        // Now revoke it
        vm.expectEmit(true, false, false, false);
        emit ClaimRevoked(claimId, governance);
        
        vm.prank(governance);
        claims.revoke(claimId);
        
        (, , , Types.ClaimStatus status, , , , , , bool resolved) = claims.getClaim(claimId);
        assertEq(uint8(status), uint8(Types.ClaimStatus.Revoked));
        assertTrue(resolved);
    }

    /// @notice Test submit with cooldown
    function test_submit_cooldown() public {
        // Submit first claim
        vm.prank(worker1);
        uint256 claimId1 = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        // Assign jurors and approve to trigger cooldown
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(address(mockVerifierPool));
        claims.assignJurors(claimId1, jurors);
        
        // All jurors approve (majority resolves)
        vm.prank(juror1);
        claims.verify(claimId1, true);
        vm.prank(juror2);
        claims.verify(claimId1, true); // This should resolve and set cooldown
        
        // Check that cooldown is set
        uint256 cooldownTime = claims.getWorkerCooldown(worker1, ACTION_TYPE_ID);
        assertGt(cooldownTime, block.timestamp);
        
        // Try to submit another claim during cooldown
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Worker is in cooldown period"));
        vm.prank(worker1);
        claims.submit(ACTION_TYPE_ID, "QmNewEvidence456");
        
        // Fast forward past cooldown and try again
        vm.warp(cooldownTime + 1);
        
        vm.prank(worker1);
        uint256 claimId2 = claims.submit(ACTION_TYPE_ID, "QmNewEvidence456");
        assertGt(claimId2, claimId1);
    }

    /// @notice Test verify already resolved
    function test_verify_alreadyResolved() public {
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_ID, EVIDENCE_CID);
        
        address[] memory jurors = new address[](3);
        jurors[0] = juror1;
        jurors[1] = juror2;
        jurors[2] = juror3;
        
        vm.prank(address(mockVerifierPool));
        claims.assignJurors(claimId, jurors);
        
        // Approve the claim (resolve it)
        vm.prank(juror1);
        claims.verify(claimId, true);
        vm.prank(juror2);
        claims.verify(claimId, true); // This resolves it
        
        // Try to vote again on resolved claim
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Claim already resolved"));
        vm.prank(juror3);
        claims.verify(claimId, true);
    }
}
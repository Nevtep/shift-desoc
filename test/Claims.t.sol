// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Claims} from "../contracts/modules/Claims.sol";
import {ValuableActionRegistry} from "../contracts/modules/ValuableActionRegistry.sol";
import {MembershipTokenERC20Votes} from "../contracts/tokens/MembershipTokenERC20Votes.sol";
import {Types} from "../contracts/libs/Types.sol";
import {Errors} from "../contracts/libs/Errors.sol";

contract MockVerifierPool {
    function selectJurors(uint256 claimId, uint256 count, uint256 randomness) external pure returns (address[] memory) {
        address[] memory jurors = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            jurors[i] = address(uint160(0x1001 + i));
        }
        return jurors;
    }
    
    function updateReputations(
        uint256 claimId, 
        address[] calldata jurors, 
        bool[] calldata correctVotes
    ) external {
        // Mock implementation - just return success
    }
}

contract MockWorkerSBT {
    function mintAndAwardPoints(address, uint256, string memory) external pure {
        // Mock implementation
    }
}

/// @title Claims Contract Test Suite
/// @notice Comprehensive tests for Claims contract with ValuableActionRegistry integration
contract ClaimsTest is Test {
    Claims public claims;
    ValuableActionRegistry public registry;
    MembershipTokenERC20Votes public membershipToken;
    MockVerifierPool public verifierPool;
    MockWorkerSBT public workerSBT;
    
    address public governance = makeAddr("governance");
    address public founder = makeAddr("founder");
    address public moderator = makeAddr("moderator");
    address public worker1 = makeAddr("worker1");
    address public worker2 = makeAddr("worker2");
    address public juror1 = address(0x1001);
    address public juror2 = address(0x1002);
    address public juror3 = address(0x1003);
    
    uint256 public constant ACTION_TYPE_1 = 1;
    uint256 public constant ACTION_TYPE_2 = 2;

    event ClaimSubmitted(uint256 indexed claimId, uint256 indexed typeId, address indexed worker, string evidenceCID);
    event JurorsAssigned(uint256 indexed claimId, address[] jurors);
    event ClaimVerified(uint256 indexed claimId, address indexed verifier, bool approve);
    event ClaimResolved(uint256 indexed claimId, Types.ClaimStatus status, uint32 finalApprovals, uint32 finalRejections);

    function setUp() public {
        // Deploy contracts
        membershipToken = new MembershipTokenERC20Votes("TestDAO", "TDAO", 1, governance);
        verifierPool = new MockVerifierPool();
        workerSBT = new MockWorkerSBT();
        
        // Deploy ValuableActionRegistry
        registry = new ValuableActionRegistry(governance);
        
        // Deploy Claims contract
        claims = new Claims(
            governance,
            address(registry),
            address(verifierPool),
            address(workerSBT),
            address(membershipToken)
        );
        
        // Set up registry with moderator and founder
        vm.startPrank(governance);
        registry.setModerator(moderator, true);
        registry.addFounder(founder, 1); // Community ID = 1
        
        // Grant minter role to Claims contract
        membershipToken.grantRole(membershipToken.MINTER_ROLE(), address(claims));
        vm.stopPrank();
        
        // Create test ValuableActions
        _createTestActions();
    }

    function _createTestActions() internal {
        vm.startPrank(founder);
        
        // Action 1: Standard action with moderate rewards
        Types.ValuableAction memory action1 = Types.ValuableAction({
            membershipTokenReward: 100,
            communityTokenReward: 50,
            investorSBTReward: 0,
            jurorsMin: 2,
            panelSize: 3,
            verifyWindow: 24 hours,
            verifierRewardWeight: 5,
            slashVerifierBps: 1000,
            cooldownPeriod: 1 hours,
            maxConcurrent: 2,
            revocable: true,
            evidenceTypes: 1,
            proposalThreshold: 1000,
            proposer: founder,
            requiresGovernanceApproval: false,
            evidenceSpecCID: "QmTest1",
            titleTemplate: "Standard Work",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 30 days,
            founderVerified: true
        });
        
        registry.proposeValuableAction(1, action1, "QmDesc1");
        
        // Action 2: High-reward action with longer cooldown
        Types.ValuableAction memory action2 = Types.ValuableAction({
            membershipTokenReward: 500,
            communityTokenReward: 250,
            investorSBTReward: 0,
            jurorsMin: 3,
            panelSize: 5,
            verifyWindow: 48 hours,
            verifierRewardWeight: 10,
            slashVerifierBps: 1500,
            cooldownPeriod: 7 days,
            maxConcurrent: 1,
            revocable: false,
            evidenceTypes: 3,
            proposalThreshold: 5000,
            proposer: founder,
            requiresGovernanceApproval: false,
            evidenceSpecCID: "QmTest2",
            titleTemplate: "High Value Work",
            automationRules: new bytes32[](0),
            activationDelay: 0,
            deprecationWarning: 60 days,
            founderVerified: true
        });
        
        registry.proposeValuableAction(1, action2, "QmDesc2");
        
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function testConstructor() public {
        Claims testClaims = new Claims(
            governance,
            address(registry),
            address(verifierPool),
            address(workerSBT),
            address(membershipToken)
        );
        
        assertEq(address(testClaims.actionRegistry()), address(registry));
        assertEq(testClaims.verifierPool(), address(verifierPool));
        assertEq(testClaims.workerSBT(), address(workerSBT));
        assertEq(testClaims.governance(), governance);
        assertEq(testClaims.membershipToken(), address(membershipToken));
    }

    function testConstructorZeroAddressReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new Claims(address(0), address(registry), address(verifierPool), address(workerSBT), address(membershipToken));
    }

    /*//////////////////////////////////////////////////////////////
                             CLAIM SUBMISSION TESTS
    //////////////////////////////////////////////////////////////*/

    function testSubmitClaim() public {
        vm.expectEmit(true, true, true, true);
        emit ClaimSubmitted(1, ACTION_TYPE_1, worker1, "QmEvidence1");
        
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        assertEq(claimId, 1);
        
        // Verify claim was created correctly
        (
            uint256 typeId,
            address worker,
            string memory evidenceCID,
            Types.ClaimStatus status,
            uint64 createdAt,
            uint64 verifyDeadline,
            uint32 approvalsCount,
            uint32 rejectionsCount
        ) = claims.getClaimInfo(claimId);
        
        assertEq(typeId, ACTION_TYPE_1);
        assertEq(worker, worker1);
        assertEq(evidenceCID, "QmEvidence1");
        assertEq(uint256(status), uint256(Types.ClaimStatus.Pending));
        assertEq(createdAt, block.timestamp);
        assertEq(verifyDeadline, block.timestamp + 24 hours);
        assertEq(approvalsCount, 0);
        assertEq(rejectionsCount, 0);
        
        // Check jurors were assigned
        address[] memory jurors = claims.getClaimJurors(claimId);
        assertEq(jurors.length, 3);
    }

    function testSubmitClaimEmptyEvidenceFails() public {
        vm.prank(worker1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence CID cannot be empty"));
        claims.submit(ACTION_TYPE_1, "");
    }

    function testSubmitClaimInactiveActionFails() public {
        // Deactivate the action
        vm.prank(governance);
        registry.deactivate(ACTION_TYPE_1);
        
        vm.prank(worker1);
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Action type is not active"));
        claims.submit(ACTION_TYPE_1, "QmEvidence1");
    }

    /*//////////////////////////////////////////////////////////////
                             VERIFICATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testVerifyClaim() public {
        // Submit claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        // First verification
        vm.expectEmit(true, true, true, true);
        emit ClaimVerified(claimId, juror1, true);
        
        vm.prank(juror1);
        claims.verify(claimId, true);
        
        // Check vote was recorded
        (, , , , , , uint32 approvalsCount, ) = claims.getClaimInfo(claimId);
        assertEq(approvalsCount, 1);
    }

    function testVerifyClaimResolution() public {
        // Submit claim  
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        // Get initial membership token balance
        uint256 initialBalance = membershipToken.balanceOf(worker1);
        
        // Two approvals should resolve the claim (jurorsMin = 2)
        vm.prank(juror1);
        claims.verify(claimId, true);
        
        // Expect resolution event on second vote
        vm.expectEmit(true, true, true, true);
        emit ClaimResolved(claimId, Types.ClaimStatus.Approved, 2, 0);
        
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        // Check claim status
        (, , , Types.ClaimStatus status, , , , ) = claims.getClaimInfo(claimId);
        assertEq(uint256(status), uint256(Types.ClaimStatus.Approved));
        
        // Check membership tokens were minted
        assertEq(membershipToken.balanceOf(worker1), initialBalance + 100);
        
        // Check cooldown was set
        assertEq(claims.workerCooldowns(worker1, ACTION_TYPE_1), block.timestamp + 1 hours);
    }

    /*//////////////////////////////////////////////////////////////
                             INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/

    function testEndToEndClaimWorkflow() public {
        // 1. Submit claim
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_1, "QmEvidence1");
        
        // 2. Initially no rewards
        assertEq(membershipToken.balanceOf(worker1), 0);
        
        // 3. Jurors vote to approve
        vm.prank(juror1);
        claims.verify(claimId, true);
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        // 4. Check final state
        (, , , Types.ClaimStatus finalStatus, , , uint32 approvals, uint32 rejections) = claims.getClaimInfo(claimId);
        assertEq(uint256(finalStatus), uint256(Types.ClaimStatus.Approved));
        assertEq(approvals, 2);
        assertEq(rejections, 0);
        
        // 5. Check rewards were distributed
        assertEq(membershipToken.balanceOf(worker1), 100);
        
        // 6. Check cooldown is active
        assertEq(claims.workerCooldowns(worker1, ACTION_TYPE_1), block.timestamp + 1 hours);
    }

    function testHighValueActionParameters() public {
        // Test Action 2 with different parameters
        vm.prank(worker1);
        uint256 claimId = claims.submit(ACTION_TYPE_2, "QmHighValueEvidence");
        
        // Need 3 approvals for this action type (jurorsMin = 3)
        vm.prank(juror1);
        claims.verify(claimId, true);
        vm.prank(juror2);
        claims.verify(claimId, true);
        
        // Should still be pending after 2 approvals
        (, , , Types.ClaimStatus status2, , , , ) = claims.getClaimInfo(claimId);
        assertEq(uint256(status2), uint256(Types.ClaimStatus.Pending));
        
        // Third approval should resolve it
        vm.prank(juror3);
        claims.verify(claimId, true);
        
        (, , , Types.ClaimStatus finalStatus2, , , , ) = claims.getClaimInfo(claimId);
        assertEq(uint256(finalStatus2), uint256(Types.ClaimStatus.Approved));
        
        // Check higher reward was minted (500 tokens)
        assertEq(membershipToken.balanceOf(worker1), 500);
        
        // Check longer cooldown (7 days)
        assertEq(claims.workerCooldowns(worker1, ACTION_TYPE_2), block.timestamp + 7 days);
    }
}
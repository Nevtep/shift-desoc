// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CountingMultiChoice} from "contracts/core/CountingMultiChoice.sol";
import {ICountingMultiChoice} from "contracts/core/interfaces/ICountingMultiChoice.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title MultiChoiceTest
/// @notice Comprehensive tests for CountingMultiChoice contract
contract MultiChoiceTest is Test {
    CountingMultiChoice public mc;
    address public voter1 = address(0x1);
    address public voter2 = address(0x2);
    
    event MultiChoiceEnabled(uint256 indexed proposalId, uint8 options);
    event VoteCastMulti(
        uint256 indexed proposalId,
        address indexed voter,
        uint256[] weights,
        uint256 totalWeight,
        string reason
    );

    function setUp() public {
        mc = new CountingMultiChoice();
    }

    /// @notice Test enabling multi-choice voting
    function test_enableMulti_success() public {
        vm.expectEmit(true, false, false, true);
        emit MultiChoiceEnabled(1, 3);
        
        mc.enableMulti(1, 3);
        
        assertTrue(mc.isMultiEnabled(1));
        assertEq(mc.numOptionsOf(1), 3);
        
        uint256[] memory totals = mc.optionTotals(1);
        assertEq(totals.length, 3);
        assertEq(totals[0], 0);
        assertEq(totals[1], 0);
        assertEq(totals[2], 0);
    }
    
    /// @notice Test enabling fails with insufficient options
    function test_enableMulti_failsInsufficientOptions() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidOptionsCount.selector, 1));
        mc.enableMulti(1, 1);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidOptionsCount.selector, 0));
        mc.enableMulti(1, 0);
    }
    
    /// @notice Test enabling fails if already enabled
    function test_enableMulti_failsAlreadyEnabled() public {
        mc.enableMulti(1, 3);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.MultiChoiceAlreadyEnabled.selector, 1));
        mc.enableMulti(1, 5);
    }

    /// @notice Test basic multi-choice voting
    function test_castVoteMulti_basic() public {
        mc.enableMulti(1, 3);
        
        uint256[] memory weights = new uint256[](3);
        weights[0] = 6e17; // 60%
        weights[1] = 3e17; // 30%
        weights[2] = 1e17; // 10%
        
        vm.expectEmit(true, true, false, true);
        emit VoteCastMulti(1, voter1, weights, 100 ether, "Prefer option 0");
        
        mc.castVoteMulti(1, voter1, 100 ether, weights, "Prefer option 0");
        
        uint256[] memory totals = mc.optionTotals(1);
        assertEq(totals[0], 60 ether);
        assertEq(totals[1], 30 ether);
        assertEq(totals[2], 10 ether);
        
        uint256[] memory voterWeights = mc.getVoterWeights(1, voter1);
        assertEq(voterWeights[0], 6e17);
        assertEq(voterWeights[1], 3e17);
        assertEq(voterWeights[2], 1e17);
    }
    
    /// @notice Test voting with partial weight allocation
    function test_castVoteMulti_partialAllocation() public {
        mc.enableMulti(1, 2);
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 7e17; // 70%
        weights[1] = 0;    // 0% (30% not allocated)
        
        mc.castVoteMulti(1, voter1, 50 ether, weights, "Only option 0");
        
        uint256[] memory totals = mc.optionTotals(1);
        assertEq(totals[0], 35 ether); // 50 * 0.7
        assertEq(totals[1], 0 ether);
    }
    
    /// @notice Test multiple voters
    function test_castVoteMulti_multipleVoters() public {
        mc.enableMulti(1, 2);
        
        // Voter 1: 80% to option 0, 20% to option 1
        uint256[] memory weights1 = new uint256[](2);
        weights1[0] = 8e17;
        weights1[1] = 2e17;
        mc.castVoteMulti(1, voter1, 100 ether, weights1, "Voter 1");
        
        // Voter 2: 30% to option 0, 70% to option 1
        uint256[] memory weights2 = new uint256[](2);
        weights2[0] = 3e17;
        weights2[1] = 7e17;
        mc.castVoteMulti(1, voter2, 200 ether, weights2, "Voter 2");
        
        uint256[] memory totals = mc.optionTotals(1);
        assertEq(totals[0], 80 ether + 60 ether); // 140 ether total
        assertEq(totals[1], 20 ether + 140 ether); // 160 ether total
    }
    
    /// @notice Test changing vote (re-voting)
    function test_castVoteMulti_changeVote() public {
        mc.enableMulti(1, 2);
        
        // Initial vote
        uint256[] memory weights1 = new uint256[](2);
        weights1[0] = 1e18; // 100% to option 0
        weights1[1] = 0;
        mc.castVoteMulti(1, voter1, 100 ether, weights1, "Initial vote");
        
        uint256[] memory totals1 = mc.optionTotals(1);
        assertEq(totals1[0], 100 ether);
        assertEq(totals1[1], 0 ether);
        
        // Change vote
        uint256[] memory weights2 = new uint256[](2);
        weights2[0] = 0;
        weights2[1] = 1e18; // 100% to option 1
        mc.castVoteMulti(1, voter1, 100 ether, weights2, "Changed vote");
        
        uint256[] memory totals2 = mc.optionTotals(1);
        assertEq(totals2[0], 0 ether);
        assertEq(totals2[1], 100 ether);
    }
    
    /// @notice Test voting fails if multi-choice not enabled
    function test_castVoteMulti_failsNotEnabled() public {
        uint256[] memory weights = new uint256[](2);
        weights[0] = 5e17;
        weights[1] = 5e17;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.MultiChoiceNotEnabled.selector, 1));
        mc.castVoteMulti(1, voter1, 100 ether, weights, "Should fail");
    }
    
    /// @notice Test voting fails with wrong weights length
    function test_castVoteMulti_failsWrongLength() public {
        mc.enableMulti(1, 3);
        
        uint256[] memory weights = new uint256[](2); // Should be 3
        weights[0] = 5e17;
        weights[1] = 5e17;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidWeightsLength.selector, 2, 3));
        mc.castVoteMulti(1, voter1, 100 ether, weights, "Wrong length");
    }
    
    /// @notice Test voting fails with excessive weight allocation
    function test_castVoteMulti_failsExcessiveAllocation() public {
        mc.enableMulti(1, 2);
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 7e17; // 70%
        weights[1] = 4e17; // 40% (total 110% > 100%)
        
        vm.expectRevert(abi.encodeWithSelector(Errors.ExcessiveWeightAllocation.selector, 11e17));
        mc.castVoteMulti(1, voter1, 100 ether, weights, "Too much allocation");
    }
    
    /// @notice Test edge case: maximum allocation
    function test_castVoteMulti_maxAllocation() public {
        mc.enableMulti(1, 2);
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 1e18; // 100%
        weights[1] = 0;
        
        // Should succeed with exactly 100% allocation
        mc.castVoteMulti(1, voter1, 100 ether, weights, "Max allocation");
        
        uint256[] memory totals = mc.optionTotals(1);
        assertEq(totals[0], 100 ether);
        assertEq(totals[1], 0 ether);
    }
    
    /// @notice Test high precision weights
    function test_castVoteMulti_highPrecision() public {
        mc.enableMulti(1, 3);
        
        uint256[] memory weights = new uint256[](3);
        weights[0] = 333333333333333333; // ~33.33%
        weights[1] = 333333333333333333; // ~33.33%  
        weights[2] = 333333333333333334; // ~33.34%
        // Total: 1000000000000000000 (exactly 1e18)
        
        mc.castVoteMulti(1, voter1, 1000 ether, weights, "High precision");
        
        uint256[] memory totals = mc.optionTotals(1);
        // Due to integer division, expect slight rounding
        assertEq(totals[0], 333333333333333333000 / 1e18 * 1e18); // ~333.33 ether
        assertEq(totals[1], 333333333333333333000 / 1e18 * 1e18); // ~333.33 ether
        assertEq(totals[2], 333333333333333334000 / 1e18 * 1e18); // ~333.34 ether
    }
}

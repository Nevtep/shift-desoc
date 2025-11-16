// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CountingMultiChoice} from "../contracts/core/CountingMultiChoice.sol";
import {Errors} from "../contracts/libs/Errors.sol";

contract CountingMultiChoiceTest is Test {
    CountingMultiChoice public counting;
    address public governor = address(0x123);
    address public voter1 = address(0x456);
    address public voter2 = address(0x789);

    uint256 public constant PROPOSAL_ID = 1;
    uint8 public constant NUM_OPTIONS = 4;

    event MultiChoiceEnabled(uint256 indexed proposalId, uint8 options);
    event VoteCastMulti(
        uint256 indexed proposalId,
        address indexed voter,
        uint256[] weights,
        uint256 totalWeight,
        string reason
    );
    event ProposalCanceled(uint256 indexed proposalId);

    function setUp() public {
        counting = new CountingMultiChoice(governor);
    }

    function testConstructor() public view {
        assertEq(counting.governor(), governor, "Governor not set correctly");
    }

    function testConstructorZeroAddress() public {
        vm.expectRevert("CountingMultiChoice: invalid governor");
        new CountingMultiChoice(address(0));
    }

    function testEnableMulti() public {
        vm.prank(governor);
        vm.expectEmit(true, false, false, true);
        emit MultiChoiceEnabled(PROPOSAL_ID, NUM_OPTIONS);
        
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        assertTrue(counting.isMultiEnabled(PROPOSAL_ID), "Multi-choice not enabled");
        assertEq(counting.numOptionsOf(PROPOSAL_ID), NUM_OPTIONS, "Wrong number of options");
    }

    function testEnableMultiOnlyGovernor() public {
        vm.prank(voter1);
        vm.expectRevert("CountingMultiChoice: only governor");
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
    }

    function testEnableMultiInvalidOptions() public {
        vm.startPrank(governor);
        
        // Too few options
        vm.expectRevert("CountingMultiChoice: need at least 2 options");
        counting.enableMulti(PROPOSAL_ID, 1);
        
        // Too many options
        vm.expectRevert("CountingMultiChoice: too many options");
        counting.enableMulti(PROPOSAL_ID, 11);
        
        vm.stopPrank();
    }

    function testEnableMultiAlreadyEnabled() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        vm.prank(governor);
        vm.expectRevert("CountingMultiChoice: already enabled");
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
    }

    function testCastVoteMulti() public {
        // Setup
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        uint256[] memory weights = new uint256[](NUM_OPTIONS);
        weights[0] = 0.5e18; // 50%
        weights[1] = 0.3e18; // 30%
        weights[2] = 0.2e18; // 20%
        weights[3] = 0;      // 0%
        
        uint256 voterWeight = 1000e18;
        string memory reason = "Test vote";
        
        vm.expectEmit(true, true, false, true);
        emit VoteCastMulti(PROPOSAL_ID, voter1, weights, voterWeight, reason);
        
        uint256 weightUsed = counting.castVoteMulti(
            PROPOSAL_ID, voter1, voterWeight, weights, reason
        );
        
        assertEq(weightUsed, 1e18, "Weight used should be 100%");
        
        // Check vote totals
        uint256[] memory totals = counting.optionTotals(PROPOSAL_ID);
        assertEq(totals[0], 500e18, "Option 0 should have 50% of voter weight");
        assertEq(totals[1], 300e18, "Option 1 should have 30% of voter weight");
        assertEq(totals[2], 200e18, "Option 2 should have 20% of voter weight");
        assertEq(totals[3], 0, "Option 3 should have 0% of voter weight");
        
        // Check voter weights
        uint256[] memory voterWeights = counting.getVoterWeights(PROPOSAL_ID, voter1);
        for (uint i = 0; i < NUM_OPTIONS; i++) {
            assertEq(voterWeights[i], weights[i], "Voter weight not recorded correctly");
        }
    }

    function testCastVoteMultiNotEnabled() public {
        uint256[] memory weights = new uint256[](NUM_OPTIONS);
        weights[0] = 1e18;
        
        vm.expectRevert("CountingMultiChoice: multi-choice not enabled");
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights, "Test");
    }

    function testCastVoteMultiInvalidWeightsLength() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        uint256[] memory weights = new uint256[](2); // Wrong length
        weights[0] = 0.5e18;
        weights[1] = 0.5e18;
        
        vm.expectRevert("CountingMultiChoice: invalid weights length");
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights, "Test");
    }

    function testCastVoteMultiExcessiveWeights() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        uint256[] memory weights = new uint256[](NUM_OPTIONS);
        weights[0] = 0.6e18; // 60%
        weights[1] = 0.5e18; // 50% - total exceeds 100%
        weights[2] = 0;
        weights[3] = 0;
        
        vm.expectRevert("CountingMultiChoice: total weights exceed 100%");
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights, "Test");
    }

    function testCastVoteMultiAlreadyVoted() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        uint256[] memory weights = new uint256[](NUM_OPTIONS);
        weights[0] = 1e18;
        
        // First vote
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights, "First vote");
        
        // Second vote should fail
        vm.expectRevert("CountingMultiChoice: already voted");
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights, "Second vote");
    }

    function testPartialWeightAllocation() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        uint256[] memory weights = new uint256[](NUM_OPTIONS);
        weights[0] = 0.7e18; // Only allocate 70%, leaving 30% unused
        weights[1] = 0;
        weights[2] = 0;
        weights[3] = 0;
        
        uint256 weightUsed = counting.castVoteMulti(
            PROPOSAL_ID, voter1, 1000e18, weights, "Partial allocation"
        );
        
        assertEq(weightUsed, 0.7e18, "Should allow partial allocation");
        
        uint256[] memory totals = counting.optionTotals(PROPOSAL_ID);
        assertEq(totals[0], 700e18, "Option 0 should have 70% of voter weight");
    }

    function testGetWinningOption() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        // Voter 1: 50% to option 1
        uint256[] memory weights1 = new uint256[](NUM_OPTIONS);
        weights1[1] = 0.5e18;
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights1, "Vote 1");
        
        // Voter 2: 80% to option 2 (should win)
        uint256[] memory weights2 = new uint256[](NUM_OPTIONS);
        weights2[2] = 0.8e18;
        counting.castVoteMulti(PROPOSAL_ID, voter2, 1000e18, weights2, "Vote 2");
        
        (uint256 winningOption, uint256 winningVotes) = counting.getWinningOption(PROPOSAL_ID);
        
        assertEq(winningOption, 2, "Option 2 should be winning");
        assertEq(winningVotes, 800e18, "Winning votes should be 800e18");
    }

    function testBinaryVoteCompatibility() public {
        // Test the _countVote function for Governor compatibility
        // Note: This is an internal function, so we'd need to expose it for testing
        // or test it through integration with a Governor contract
        
        // For now, just test that binary vote results can be retrieved
        (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes) = 
            counting.proposalVotes(PROPOSAL_ID);
            
        assertEq(againstVotes, 0, "Against votes should start at 0");
        assertEq(forVotes, 0, "For votes should start at 0");
        assertEq(abstainVotes, 0, "Abstain votes should start at 0");
    }

    function testCancelProposal() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        assertTrue(counting.isMultiEnabled(PROPOSAL_ID), "Should be enabled");
        
        vm.prank(governor);
        vm.expectEmit(true, false, false, false);
        emit ProposalCanceled(PROPOSAL_ID);
        
        counting.cancelProposal(PROPOSAL_ID);
        
        assertFalse(counting.isMultiEnabled(PROPOSAL_ID), "Should be disabled after cancel");
    }

    function testCancelProposalOnlyGovernor() public {
        vm.prank(voter1);
        vm.expectRevert("CountingMultiChoice: only governor");
        counting.cancelProposal(PROPOSAL_ID);
    }

    function testValidateVoteDistribution() public view {
        uint256[] memory validWeights = new uint256[](3);
        validWeights[0] = 0.5e18;
        validWeights[1] = 0.3e18;
        validWeights[2] = 0.2e18;
        
        (bool valid, string memory reason) = counting.validateVoteDistribution(validWeights);
        assertTrue(valid, "Should be valid distribution");
        assertEq(reason, "Valid distribution", "Wrong validation message");
        
        uint256[] memory excessiveWeights = new uint256[](2);
        excessiveWeights[0] = 0.6e18;
        excessiveWeights[1] = 0.5e18; // Total > 100%
        
        (bool valid2, string memory reason2) = counting.validateVoteDistribution(excessiveWeights);
        assertFalse(valid2, "Should be invalid distribution");
        assertEq(reason2, "Total exceeds 100%", "Wrong validation message");
        
        uint256[] memory zeroWeights = new uint256[](2);
        (bool valid3, string memory reason3) = counting.validateVoteDistribution(zeroWeights);
        assertFalse(valid3, "Should be invalid distribution");
        assertEq(reason3, "Must allocate some weight", "Wrong validation message");
    }

    function testPreviewVoteDistribution() public view {
        uint256 voterWeight = 1000e18;
        uint256[] memory weights = new uint256[](3);
        weights[0] = 0.5e18;  // 50%
        weights[1] = 0.3e18;  // 30%
        weights[2] = 0.2e18;  // 20%
        
        uint256[] memory actualWeights = counting.previewVoteDistribution(voterWeight, weights);
        
        assertEq(actualWeights[0], 500e18, "Should be 50% of voter weight");
        assertEq(actualWeights[1], 300e18, "Should be 30% of voter weight");
        assertEq(actualWeights[2], 200e18, "Should be 20% of voter weight");
    }

    function testGetAllOptionVotes() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        uint256[] memory weights = new uint256[](NUM_OPTIONS);
        weights[0] = 0.4e18;
        weights[1] = 0.3e18;
        weights[2] = 0.2e18;
        weights[3] = 0.1e18;
        
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights, "Test");
        
        uint256[] memory allVotes = counting.getAllOptionVotes(PROPOSAL_ID);
        
        assertEq(allVotes[0], 400e18, "Option 0 votes");
        assertEq(allVotes[1], 300e18, "Option 1 votes");
        assertEq(allVotes[2], 200e18, "Option 2 votes");
        assertEq(allVotes[3], 100e18, "Option 3 votes");
    }

    function testGetOptionVotes() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        uint256[] memory weights = new uint256[](NUM_OPTIONS);
        weights[1] = 0.7e18; // Only vote for option 1
        
        counting.castVoteMulti(PROPOSAL_ID, voter1, 1000e18, weights, "Test");
        
        assertEq(counting.getOptionVotes(PROPOSAL_ID, 0), 0, "Option 0 should have 0 votes");
        assertEq(counting.getOptionVotes(PROPOSAL_ID, 1), 700e18, "Option 1 should have votes");
        assertEq(counting.getOptionVotes(PROPOSAL_ID, 2), 0, "Option 2 should have 0 votes");
    }

    function testGetOptionVotesInvalidOption() public {
        vm.prank(governor);
        counting.enableMulti(PROPOSAL_ID, NUM_OPTIONS);
        
        vm.expectRevert("CountingMultiChoice: invalid option");
        counting.getOptionVotes(PROPOSAL_ID, NUM_OPTIONS); // Invalid index
    }
}
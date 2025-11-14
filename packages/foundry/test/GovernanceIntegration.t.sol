// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ShiftGovernor} from "contracts/core/ShiftGovernor.sol";
import {CountingMultiChoice} from "contracts/core/CountingMultiChoice.sol";
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {IGovernor} from "@openzeppelin/contracts/governance/IGovernor.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title GovernanceIntegrationTest  
/// @notice Integration tests for ShiftGovernor with multi-choice voting
contract GovernanceIntegrationTest is Test {
    ShiftGovernor public governor;
    CountingMultiChoice public multiChoice;
    MembershipTokenERC20Votes public token;
    TimelockController public timelock;
    
    address public admin = address(0x1);
    address public voter1 = address(0x2);
    address public voter2 = address(0x3);
    address public voter3 = address(0x4);
    
    // Timelock roles
    bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
    
    event MultiChoiceProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        uint8 numOptions,
        string description
    );
    
    event MultiChoiceVoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint256[] weights,
        uint256 totalWeight,
        string reason
    );

    function setUp() public {
        vm.startPrank(admin);
        
        // Deploy token
        token = new MembershipTokenERC20Votes("Shift Membership", "SHIFT");
        
        // Deploy timelock with 1 hour delay for testing
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](0);
        timelock = new TimelockController(1 hours, proposers, executors, admin);
        
        // Deploy governor
        governor = new ShiftGovernor(address(token), address(timelock));
        
        // Deploy multi-choice counting
        multiChoice = new CountingMultiChoice();
        
        // Grant governor the proposer and executor roles
        timelock.grantRole(PROPOSER_ROLE, address(governor));
        timelock.grantRole(EXECUTOR_ROLE, address(governor));
        timelock.grantRole(CANCELLER_ROLE, address(governor));
        
        vm.stopPrank();
        
        // Configure governor with multi-choice counter (use init function)
        governor.initCountingMulti(address(multiChoice));
        
        vm.startPrank(admin);
        
        // Transfer tokens and delegate voting power (admin has all tokens from constructor)
        token.transfer(voter1, 100 ether);
        token.transfer(voter2, 200 ether);
        token.transfer(voter3, 50 ether);
        
        vm.stopPrank();
        
        // Delegate voting power
        vm.prank(voter1);
        token.delegate(voter1);
        
        vm.prank(voter2);
        token.delegate(voter2);
        
        vm.prank(voter3);
        token.delegate(voter3);
        
        // Advance block to snapshot voting power
        vm.roll(block.number + 1);
    }
    
    /// @notice Test creating a multi-choice proposal
    function test_proposeMultiChoice_success() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", voter1, 50 ether);
        
        // Don't check exact proposal ID since it's hash-based
        
        vm.prank(voter1);
        uint256 proposalId = governor.proposeMultiChoice(
            targets,
            values,
            calldatas,
            "Mint 50 tokens to voter1",
            3
        );
        
        assertTrue(governor.isMultiChoice(proposalId));
        assertEq(governor.numOptionsOf(proposalId), 3);
        assertTrue(multiChoice.isMultiEnabled(proposalId));
    }
    
    /// @notice Test multi-choice proposal creation fails with insufficient options
    function test_proposeMultiChoice_failsInsufficientOptions() public {
        address[] memory targets = new address[](0);
        uint256[] memory values = new uint256[](0);
        bytes[] memory calldatas = new bytes[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidOptionsCount.selector, 1));
        vm.prank(voter1);
        governor.proposeMultiChoice(targets, values, calldatas, "Test", 1);
    }
    
    /// @notice Test end-to-end multi-choice voting workflow
    function test_multiChoiceVoting_endToEnd() public {
        // Create proposal
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", address(this), 100 ether);
        
        vm.prank(voter1);
        uint256 proposalId = governor.proposeMultiChoice(
            targets,
            values,
            calldatas,
            "Community treasury funding proposal",
            3
        );
        
        // Wait for voting period to start
        vm.roll(block.number + governor.votingDelay() + 1);
        
        // Voter 1: 70% option 0, 30% option 1
        uint256[] memory weights1 = new uint256[](3);
        weights1[0] = 7e17; // 70%
        weights1[1] = 3e17; // 30%
        weights1[2] = 0;    // 0%
        
        vm.expectEmit(true, true, false, true);
        emit MultiChoiceVoteCast(proposalId, voter1, weights1, 100 ether, "Prefer option 0");
        
        vm.prank(voter1);
        governor.castVoteMultiChoice(proposalId, weights1, "Prefer option 0");
        
        // Voter 2: 40% option 0, 60% option 2  
        uint256[] memory weights2 = new uint256[](3);
        weights2[0] = 4e17; // 40%
        weights2[1] = 0;    // 0%
        weights2[2] = 6e17; // 60%
        
        vm.prank(voter2);
        governor.castVoteMultiChoice(proposalId, weights2, "Prefer option 2");
        
        // Voter 3: 100% option 1
        uint256[] memory weights3 = new uint256[](3);
        weights3[0] = 0;    // 0%
        weights3[1] = 1e18; // 100%
        weights3[2] = 0;    // 0%
        
        vm.prank(voter3);
        governor.castVoteMultiChoice(proposalId, weights3, "Only option 1");
        
        // Verify totals
        uint256[] memory totals = governor.getMultiChoiceTotals(proposalId);
        assertEq(totals[0], 70 ether + 80 ether); // 150 ether
        assertEq(totals[1], 30 ether + 50 ether); // 80 ether  
        assertEq(totals[2], 120 ether);           // 120 ether
        
        // Verify voter ballots
        uint256[] memory voter1Ballot = governor.getVoterMultiChoiceWeights(proposalId, voter1);
        assertEq(voter1Ballot[0], 7e17);
        assertEq(voter1Ballot[1], 3e17);
        assertEq(voter1Ballot[2], 0);
    }
    
    /// @notice Test voting fails when proposal not active
    function test_castVoteMultiChoice_failsNotActive() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", voter1, 10 ether);
        
        vm.prank(voter1);
        uint256 proposalId = governor.proposeMultiChoice(
            targets,
            values,
            calldatas,
            "Test proposal",
            2
        );
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 5e17;
        weights[1] = 5e17;
        
        // Try to vote before voting period starts
        vm.expectRevert(abi.encodeWithSelector(
            Errors.ProposalNotActive.selector, 
            proposalId, 
            uint8(IGovernor.ProposalState.Pending)
        ));
        vm.prank(voter1);
        governor.castVoteMultiChoice(proposalId, weights, "Too early");
    }
    
    /// @notice Test voting fails with insufficient voting power
    function test_castVoteMultiChoice_failsInsufficientPower() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", voter1, 10 ether);
        
        vm.prank(voter1);
        uint256 proposalId = governor.proposeMultiChoice(
            targets,
            values,
            calldatas, 
            "Test proposal",
            2
        );
        
        vm.roll(block.number + governor.votingDelay() + 1);
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 5e17;
        weights[1] = 5e17;
        
        // Try to vote from address with no tokens
        vm.expectRevert(abi.encodeWithSelector(Errors.InsufficientVotingPower.selector, address(0x999), 1, 0));
        vm.prank(address(0x999));
        governor.castVoteMultiChoice(proposalId, weights, "No power");
    }
    
    /// @notice Test voting fails when multi-choice not enabled
    function test_castVoteMultiChoice_failsNotEnabled() public {
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", voter1, 10 ether);
        
        // Create a new governor without multi-choice counter  
        ShiftGovernor newGovernor = new ShiftGovernor(address(token), address(timelock));
        
        vm.prank(voter1);
        uint256 proposalId = newGovernor.propose(
            targets,
            values,
            calldatas,
            "Regular proposal"
        );
        
        vm.roll(block.number + governor.votingDelay() + 1);
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 5e17;
        weights[1] = 5e17;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.MultiChoiceNotEnabled.selector, proposalId));
        vm.prank(voter1);
        newGovernor.castVoteMultiChoice(proposalId, weights, "Not enabled");
    }
    
    /// @notice Test updating multi-choice counter
    function test_setCountingMulti() public {
        CountingMultiChoice newCounter = new CountingMultiChoice();
        
        // Only governance can update
        vm.expectRevert();
        vm.prank(voter1);
        governor.setCountingMulti(address(newCounter));
        
        // Test initialization check
        ShiftGovernor newGovernor = new ShiftGovernor(address(token), address(timelock));
        newGovernor.initCountingMulti(address(newCounter));
        assertEq(newGovernor.multiCounter(), address(newCounter));
        
        // Cannot initialize twice
        vm.expectRevert("Already initialized");
        newGovernor.initCountingMulti(address(multiChoice));
    }
    
    /// @notice Test quorum and proposal state functions work correctly
    function test_governanceStateChecks() public {
        // Check quorum (4% of 1M total supply = 40k tokens)
        uint256 currentQuorum = governor.quorum(block.number - 1);
        assertEq(currentQuorum, 40000 ether);
        
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        
        targets[0] = address(token);
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature("transfer(address,uint256)", voter1, 10 ether);
        
        vm.prank(voter1);
        uint256 proposalId = governor.proposeMultiChoice(
            targets,
            values,
            calldatas,
            "Test proposal",
            2
        );
        
        // Initially pending
        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Pending));
        
        // After voting delay, becomes active
        vm.roll(block.number + governor.votingDelay() + 1);
        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Active));
        
        // After voting period, if no votes, becomes defeated
        vm.roll(block.number + governor.votingPeriod() + 1);
        assertEq(uint8(governor.state(proposalId)), uint8(IGovernor.ProposalState.Defeated));
    }
}
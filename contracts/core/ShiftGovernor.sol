// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {Governor} from "@openzeppelin/contracts/governance/Governor.sol";
import {GovernorSettings} from "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import {GovernorCountingSimple} from "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import {GovernorVotes} from "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
// solhint-disable-next-line max-line-length
import {GovernorVotesQuorumFraction as Quorum} from "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import {GovernorTimelockControl} from "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import {ICountingMultiChoice} from "contracts/core/interfaces/ICountingMultiChoice.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title ShiftGovernor
/// @notice Governance contract with multi-choice voting support for Shift DeSoc platform
/// @dev Extends OpenZeppelin Governor with custom multi-choice voting capability
contract ShiftGovernor is
    Governor, GovernorSettings, GovernorCountingSimple,
    GovernorVotes, Quorum, GovernorTimelockControl
{
    /// @notice Tracks number of options for multi-choice proposals
    mapping(uint256 => uint8) private _numOptions;
    
    /// @notice Address of the multi-choice counting contract
    address public multiCounter;

    /// @notice Emitted when multi-choice counter is updated
    event MultiCounterUpdated(address indexed oldCounter, address indexed newCounter);
    
    /// @notice Emitted when a multi-choice proposal is created
    event MultiChoiceProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        uint8 numOptions,
        string description
    );

    /// @notice Emitted when a multi-choice vote is cast
    event MultiChoiceVoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint256[] weights,
        uint256 totalWeight,
        string reason
    );

    constructor(address token, address timelock)
        Governor("ShiftGovernor")
        GovernorSettings(1 days, 5 days, 0)  // 1 day voting delay, 5 days voting period, 0 proposal threshold
        GovernorVotes(IVotes(token))
        Quorum(4)  // 4% quorum
        GovernorTimelockControl(TimelockController(payable(timelock))) 
    {}

    /// @notice Set the multi-choice counting contract
    /// @param counter Address of the CountingMultiChoice contract
    function setCountingMulti(address counter) external onlyGovernance { 
        address oldCounter = multiCounter;
        multiCounter = counter; 
        emit MultiCounterUpdated(oldCounter, counter);
    }

    /// @notice Initialize multi-choice counter (admin only, for setup)
    /// @param counter Address of the CountingMultiChoice contract
    function initCountingMulti(address counter) external {
        require(multiCounter == address(0), "Already initialized");
        multiCounter = counter;
        emit MultiCounterUpdated(address(0), counter);
    }

    /// @notice Cast a multi-choice vote
    /// @param proposalId The proposal ID
    /// @param weights Array of weights for each option (must sum ≤ 1e18)
    /// @param reason Vote rationale
    function castVoteMultiChoice(
        uint256 proposalId,
        uint256[] calldata weights,
        string calldata reason
    ) external {
        if (multiCounter == address(0)) revert Errors.MultiChoiceNotEnabled(proposalId);
        if (state(proposalId) != ProposalState.Active) {
            revert Errors.ProposalNotActive(proposalId, uint8(state(proposalId)));
        }

        uint256 weight = getVotes(_msgSender(), proposalSnapshot(proposalId));
        if (weight == 0) revert Errors.InsufficientVotingPower(_msgSender(), 1, 0);

        uint256 weightUsed = ICountingMultiChoice(multiCounter).castVoteMulti(
            proposalId, _msgSender(), weight, weights, reason
        );

        emit MultiChoiceVoteCast(proposalId, _msgSender(), weights, weightUsed, reason);
    }

    /// @notice Get number of options for a proposal
    /// @param proposalId The proposal ID
    /// @return Number of voting options (0 if not multi-choice)
    function numOptionsOf(uint256 proposalId) external view returns (uint8) { 
        return _numOptions[proposalId]; 
    }

    /// @notice Check if a proposal is multi-choice
    /// @param proposalId The proposal ID
    /// @return True if multi-choice enabled
    function isMultiChoice(uint256 proposalId) external view returns (bool) {
        return _numOptions[proposalId] > 0;
    }

    /// @notice Get multi-choice vote totals for a proposal
    /// @param proposalId The proposal ID
    /// @return Array of vote totals per option
    function getMultiChoiceTotals(uint256 proposalId) external view returns (uint256[] memory) {
        if (multiCounter == address(0)) return new uint256[](0);
        return ICountingMultiChoice(multiCounter).optionTotals(proposalId);
    }

    /// @notice Get a voter's multi-choice ballot
    /// @param proposalId The proposal ID
    /// @param voter The voter address
    /// @return Array of weights allocated per option
    function getVoterMultiChoiceWeights(uint256 proposalId, address voter) external view returns (uint256[] memory) {
        if (multiCounter == address(0)) return new uint256[](0);
        return ICountingMultiChoice(multiCounter).getVoterWeights(proposalId, voter);
    }

    /// @notice Create a multi-choice proposal
    /// @param targets Target addresses for proposal calls
    /// @param values Ether values for proposal calls  
    /// @param calldatas Encoded function calls
    /// @param description Proposal description
    /// @param numOptions Number of voting options (2-255)
    /// @return proposalId The ID of the created proposal
    function proposeMultiChoice(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        uint8 numOptions
    ) public returns (uint256 proposalId) {
        if (numOptions < 2) revert Errors.InvalidOptionsCount(numOptions);
        
        proposalId = propose(targets, values, calldatas, description);
        _numOptions[proposalId] = numOptions;
        
        if (multiCounter != address(0)) {
            ICountingMultiChoice(multiCounter).enableMulti(proposalId, numOptions);
        }
        
        emit MultiChoiceProposalCreated(proposalId, _msgSender(), numOptions, description);
    }

    // Required overrides for OpenZeppelin 5.x
    function quorum(uint256 blockNumber) public view override(Governor, Quorum) returns (uint256) {
        return super.quorum(blockNumber);
    }
    
    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }
    
    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }
    
    function proposalNeedsQueuing(uint256 proposalId) 
        public 
        view 
        override(Governor, GovernorTimelockControl) 
        returns (bool) 
    {
        return super.proposalNeedsQueuing(proposalId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(Governor) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    function _queueOperations(
        uint256 proposalId, 
        address[] memory targets, 
        uint256[] memory values, 
        bytes[] memory calldatas, 
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }
    
    function _executeOperations(
        uint256 proposalId, 
        address[] memory targets, 
        uint256[] memory values, 
        bytes[] memory calldatas, 
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }
    
    function _cancel(
        address[] memory targets, 
        uint256[] memory values, 
        bytes[] memory calldatas, 
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }
    
    function _executor() internal view override(Governor, GovernorTimelockControl) returns (address) {
        return super._executor();
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICountingMultiChoice} from 
    "contracts/core/interfaces/ICountingMultiChoice.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title CountingMultiChoice
/// @notice Implements multi-choice voting for governance proposals
/// @dev Allows voters to distribute their voting weight across multiple options
contract CountingMultiChoice is ICountingMultiChoice {
    struct ProposalConfig { 
        uint8 options;
        bool enabled; 
    }
    
    struct ProposalTally { 
        uint256[] totals;
    }
    
    /// @notice Configuration for each proposal
    mapping(uint256 => ProposalConfig) internal _config;
    
    /// @notice Voter ballots: proposalId => voter => weights[]
    mapping(uint256 => mapping(address => uint256[])) internal _ballots;
    
    /// @notice Vote tallies: proposalId => totals[]
    mapping(uint256 => ProposalTally) internal _tallies;

    /// @notice Enable multi-choice voting for a proposal
    /// @param proposalId The proposal ID
    /// @param options Number of voting options (must be 2-255)
    function enableMulti(uint256 proposalId, uint8 options) external {
        if (options < 2) revert Errors.InvalidOptionsCount(options);
        if (_config[proposalId].enabled) revert Errors.MultiChoiceAlreadyEnabled(proposalId);
        
        _config[proposalId] = ProposalConfig({options: options, enabled: true});
        _tallies[proposalId].totals = new uint256[](options);
        
        emit MultiChoiceEnabled(proposalId, options);
    }

    /// @notice Cast a multi-choice vote
    /// @param proposalId The proposal ID
    /// @param voter The voter address
    /// @param weight The voter's total weight
    /// @param weights Array of weights for each option (must sum ≤ 1e18)
    /// @param reason Vote rationale
    /// @return The weight used
    function castVoteMulti(
        uint256 proposalId,
        address voter,
        uint256 weight,
        uint256[] calldata weights,
        string calldata reason
    ) external returns (uint256) {
        ProposalConfig memory config = _config[proposalId];
        if (!config.enabled) revert Errors.MultiChoiceNotEnabled(proposalId);
        if (weights.length != config.options) {
            revert Errors.InvalidWeightsLength(weights.length, config.options);
        }

        // Validate weight allocation
        uint256 totalAllocation;
        for (uint256 i = 0; i < weights.length; ++i) {
            totalAllocation += weights[i];
        }
        if (totalAllocation > 1e18) revert Errors.ExcessiveWeightAllocation(totalAllocation);

        // Remove previous vote if exists
        uint256[] storage previousBallot = _ballots[proposalId][voter];
        if (previousBallot.length > 0) {
            for (uint256 i = 0; i < previousBallot.length; ++i) {
                _tallies[proposalId].totals[i] -= (previousBallot[i] * weight) / 1e18;
            }
        }

        // Record new vote
        _ballots[proposalId][voter] = weights;
        for (uint256 i = 0; i < weights.length; ++i) {
            _tallies[proposalId].totals[i] += (weights[i] * weight) / 1e18;
        }

        emit VoteCastMulti(proposalId, voter, weights, weight, reason);
        return weight;
    }

    /// @notice Get vote totals for all options
    /// @param proposalId The proposal ID
    /// @return Array of vote totals per option
    function optionTotals(uint256 proposalId) external view returns (uint256[] memory) {
        return _tallies[proposalId].totals;
    }

    /// @notice Get number of options for a proposal
    /// @param proposalId The proposal ID
    /// @return Number of voting options
    function numOptionsOf(uint256 proposalId) external view returns (uint8) {
        return _config[proposalId].options;
    }

    /// @notice Get a voter's ballot
    /// @param proposalId The proposal ID
    /// @param voter The voter address
    /// @return Array of weights allocated per option
    function getVoterWeights(uint256 proposalId, address voter) external view returns (uint256[] memory) {
        return _ballots[proposalId][voter];
    }

    /// @notice Check if multi-choice voting is enabled for proposal
    /// @param proposalId The proposal ID
    /// @return True if enabled
    function isMultiEnabled(uint256 proposalId) external view returns (bool) {
        return _config[proposalId].enabled;
    }
}

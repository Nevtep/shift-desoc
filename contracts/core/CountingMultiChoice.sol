// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICountingMultiChoice} from 
    "contracts/core/interfaces/ICountingMultiChoice.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title CountingMultiChoice
/// @notice Implements multi-choice voting for governance proposals with binary compatibility
/// @dev Supports both traditional binary voting and advanced multi-choice preference distribution
contract CountingMultiChoice is ICountingMultiChoice {
    /// @notice Emitted when a proposal is canceled
    event ProposalCanceled(uint256 indexed proposalId);

    /// @notice Vote types for binary compatibility
    enum VoteType {
        Against,
        For, 
        Abstain
    }

    /// @notice Comprehensive vote storage supporting both binary and multi-choice
    struct ProposalVote {
        uint256 againstVotes;           // Traditional "No" votes
        uint256 forVotes;              // Traditional "Yes" votes  
        uint256 abstainVotes;          // Traditional abstentions
        mapping(uint256 => uint256) optionVotes; // Multi-choice vote weights
        mapping(address => bool) hasVoted;       // Voter participation tracking
        mapping(address => uint256[]) voterWeights; // Individual weight distributions
    }

    /// @notice Multi-choice configuration per proposal
    struct MultiChoiceConfig {
        bool enabled;              // Whether multi-choice is active
        uint8 numOptions;         // Number of available options
        uint256 totalWeight;      // Sum of all cast votes
        uint256[] optionTotals;   // Vote total per option
    }
    
    /// @notice Governor contract address for access control
    address public governor;
    
    /// @notice Vote storage for each proposal
    mapping(uint256 => ProposalVote) private _proposalVotes;
    
    /// @notice Multi-choice configurations
    mapping(uint256 => MultiChoiceConfig) private _multiConfigs;

    /// @notice Access control modifier - only Governor can manage configurations
    modifier onlyGovernor() {
        require(msg.sender == governor, "CountingMultiChoice: only governor");
        _;
    }

    /// @notice Initialize with Governor contract address
    /// @param _governor Address of the Governor contract
    constructor(address _governor) {
        require(_governor != address(0), "CountingMultiChoice: invalid governor");
        governor = _governor;
    }

    /// @notice Enable multi-choice voting for a proposal
    /// @param proposalId The proposal ID
    /// @param options Number of voting options (must be 2-10)
    function enableMulti(uint256 proposalId, uint8 options) external onlyGovernor {
        require(options >= 2, "CountingMultiChoice: need at least 2 options");
        require(options <= 10, "CountingMultiChoice: too many options"); // UI limit
        require(!_multiConfigs[proposalId].enabled, "CountingMultiChoice: already enabled");
        
        _multiConfigs[proposalId] = MultiChoiceConfig({
            enabled: true,
            numOptions: options,
            totalWeight: 0,
            optionTotals: new uint256[](options)
        });
        
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
        MultiChoiceConfig storage config = _multiConfigs[proposalId];
        require(config.enabled, "CountingMultiChoice: multi-choice not enabled");
        require(weights.length == config.numOptions, "CountingMultiChoice: invalid weights length");

        ProposalVote storage proposalVote = _proposalVotes[proposalId];
        require(!proposalVote.hasVoted[voter], "CountingMultiChoice: already voted");

        // Validate weight allocation
        uint256 totalAllocation = _sumWeights(weights);
        require(totalAllocation <= 1e18, "CountingMultiChoice: total weights exceed 100%");

        // Record vote
        proposalVote.hasVoted[voter] = true;
        proposalVote.voterWeights[voter] = weights;

        // Apply voter's weight proportionally to each option
        for (uint256 i = 0; i < weights.length; ++i) {
            if (weights[i] > 0) {
                uint256 optionWeight = (weight * weights[i]) / 1e18;
                proposalVote.optionVotes[i] += optionWeight;
                config.optionTotals[i] += optionWeight;
            }
        }

        config.totalWeight += weight;

        emit VoteCastMulti(proposalId, voter, weights, weight, reason);
        return totalAllocation;
    }

    /// @notice Binary vote counting for Governor compatibility
    /// @param proposalId The proposal ID
    /// @param account The voter address
    /// @param support Vote type (0=Against, 1=For, 2=Abstain)
    /// @param weight The voter's weight
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory // params (unused for binary voting)
    ) internal virtual {
        ProposalVote storage proposalVote = _proposalVotes[proposalId];

        require(!proposalVote.hasVoted[account], "CountingMultiChoice: already voted");
        proposalVote.hasVoted[account] = true;

        if (support == uint8(VoteType.Against)) {
            proposalVote.againstVotes += weight;
        } else if (support == uint8(VoteType.For)) {
            proposalVote.forVotes += weight;
        } else if (support == uint8(VoteType.Abstain)) {
            proposalVote.abstainVotes += weight;
        } else {
            revert("CountingMultiChoice: invalid vote type");
        }
    }

    /// @notice Sum weights array for validation
    /// @param weights Array of weights to sum
    /// @return total Sum of all weights
    function _sumWeights(uint256[] calldata weights) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < weights.length; i++) {
            total += weights[i];
        }
    }

    /// @notice Get vote totals for all options (multi-choice)
    /// @param proposalId The proposal ID
    /// @return Array of vote totals per option
    function optionTotals(uint256 proposalId) external view returns (uint256[] memory) {
        return _multiConfigs[proposalId].optionTotals;
    }

    /// @notice Get binary vote results (Governor compatibility)
    /// @param proposalId The proposal ID
    /// @return againstVotes forVotes abstainVotes Traditional vote counts
    function proposalVotes(uint256 proposalId) public view returns (
        uint256 againstVotes,
        uint256 forVotes,
        uint256 abstainVotes
    ) {
        ProposalVote storage proposalVote = _proposalVotes[proposalId];
        return (
            proposalVote.againstVotes,
            proposalVote.forVotes,
            proposalVote.abstainVotes
        );
    }

    /// @notice Get number of options for a proposal
    /// @param proposalId The proposal ID
    /// @return Number of voting options
    function numOptionsOf(uint256 proposalId) external view returns (uint8) {
        return _multiConfigs[proposalId].numOptions;
    }

    /// @notice Get a voter's ballot
    /// @param proposalId The proposal ID
    /// @param voter The voter address
    /// @return Array of weights allocated per option
    function getVoterWeights(uint256 proposalId, address voter) external view returns (uint256[] memory) {
        return _proposalVotes[proposalId].voterWeights[voter];
    }

    /// @notice Check if multi-choice voting is enabled for proposal
    /// @param proposalId The proposal ID
    /// @return True if enabled
    function isMultiEnabled(uint256 proposalId) external view returns (bool) {
        return _multiConfigs[proposalId].enabled;
    }

    /// @notice Get vote weight for specific option
    /// @param proposalId The proposal ID
    /// @param optionIndex The option index
    /// @return Vote weight for that option
    function getOptionVotes(uint256 proposalId, uint256 optionIndex) external view returns (uint256) {
        require(optionIndex < _multiConfigs[proposalId].numOptions, "CountingMultiChoice: invalid option");
        return _proposalVotes[proposalId].optionVotes[optionIndex];
    }

    /// @notice Get complete vote distribution across all options
    /// @param proposalId The proposal ID
    /// @return votes Array of vote totals per option
    function getAllOptionVotes(uint256 proposalId) external view returns (uint256[] memory votes) {
        uint8 numOptions = _multiConfigs[proposalId].numOptions;
        votes = new uint256[](numOptions);
        
        for (uint256 i = 0; i < numOptions; i++) {
            votes[i] = _proposalVotes[proposalId].optionVotes[i];
        }
        
        return votes;
    }

    /// @notice Determine winning option and vote count
    /// @param proposalId The proposal ID
    /// @return winningOption winningVotes The option with most votes and its count
    function getWinningOption(uint256 proposalId) external view returns (uint256 winningOption, uint256 winningVotes) {
        uint8 numOptions = _multiConfigs[proposalId].numOptions;
        uint256 maxVotes = 0;
        uint256 winner = 0;
        
        for (uint256 i = 0; i < numOptions; i++) {
            uint256 optionVotes = _proposalVotes[proposalId].optionVotes[i];
            if (optionVotes > maxVotes) {
                maxVotes = optionVotes;
                winner = i;
            }
        }
        
        return (winner, maxVotes);
    }

    /// @notice Clean up multi-choice state when proposals are cancelled
    /// @param proposalId The proposal ID to cancel
    function cancelProposal(uint256 proposalId) external onlyGovernor {
        delete _multiConfigs[proposalId];
        // Note: Individual vote records preserved for transparency
        
        emit ProposalCanceled(proposalId);
    }

    /// @notice Validate weight distribution before voting
    /// @param weights Array of weights to validate
    /// @return valid reason Validation result and reason
    function validateVoteDistribution(uint256[] calldata weights) 
        external pure returns (bool valid, string memory reason) {
        
        uint256 total = _sumWeights(weights);
        
        if (total > 1e18) {
            return (false, "Total exceeds 100%");
        }
        
        if (total == 0) {
            return (false, "Must allocate some weight");
        }
        
        return (true, "Valid distribution");
    }

    /// @notice Preview vote distribution before casting
    /// @param voterWeight Total voting power of the voter
    /// @param weights Proposed weight distribution
    /// @return actualWeights Actual weight allocation per option
    function previewVoteDistribution(
        uint256 voterWeight,
        uint256[] calldata weights
    ) external pure returns (uint256[] memory actualWeights) {
        actualWeights = new uint256[](weights.length);
        
        for (uint256 i = 0; i < weights.length; i++) {
            actualWeights[i] = (voterWeight * weights[i]) / 1e18;
        }
        
        return actualWeights;
    }
}

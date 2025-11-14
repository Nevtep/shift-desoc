// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICountingMultiChoice {
    /// @notice Emitted when multi-choice voting is enabled for a proposal
    event MultiChoiceEnabled(uint256 indexed proposalId, uint8 options);
    
    /// @notice Emitted when a multi-choice vote is cast
    event VoteCastMulti(
        uint256 indexed proposalId,
        address indexed voter,
        uint256[] weights,
        uint256 totalWeight,
        string reason
    );

    /// @notice Enable multi-choice voting for a proposal
    /// @param proposalId The proposal ID
    /// @param options Number of voting options (2-255)
    function enableMulti(uint256 proposalId, uint8 options) external;

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
    ) external returns (uint256);

    /// @notice Get vote totals for all options
    /// @param proposalId The proposal ID
    /// @return Array of vote totals per option
    function optionTotals(uint256 proposalId) external view returns (uint256[] memory);

    /// @notice Get number of options for a proposal
    /// @param proposalId The proposal ID
    /// @return Number of voting options
    function numOptionsOf(uint256 proposalId) external view returns (uint8);

    /// @notice Get a voter's ballot
    /// @param proposalId The proposal ID
    /// @param voter The voter address
    /// @return Array of weights allocated per option
    function getVoterWeights(uint256 proposalId, address voter) external view returns (uint256[] memory);

    /// @notice Check if multi-choice voting is enabled for proposal
    /// @param proposalId The proposal ID
    /// @return True if enabled
    function isMultiEnabled(uint256 proposalId) external view returns (bool);
}

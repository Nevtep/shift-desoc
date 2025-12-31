// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVerifierManager
/// @notice Interface for VPT-based verifier management system
interface IVerifierManager {
    /// @notice Select M jurors from N available verifiers for an engagement using VPT eligibility
    /// @param engagementId Engagement ID requiring verification
    /// @param communityId Community identifier for verifier pool
    /// @param panelSize Total number of jurors to select (N)
    /// @param seed Randomness seed for selection
    /// @param useWeighting Whether to use VPT amounts as weights in selection
    /// @return selectedJurors Array of selected juror addresses
    function selectJurors(
        uint256 engagementId, 
        uint256 communityId,
        uint256 panelSize,
        uint256 seed,
        bool useWeighting
    ) external returns (address[] memory selectedJurors);

    /// @notice Handle fraud detection by initiating governance ban process
    /// @param engagementId Engagement ID where fraud was detected
    /// @param communityId Community identifier
    /// @param offenders Array of juror addresses that voted incorrectly
    /// @param evidenceCID IPFS hash with fraud evidence
    function reportFraud(
        uint256 engagementId,
        uint256 communityId,
        address[] calldata offenders,
        string calldata evidenceCID
    ) external;

    /// @notice Check if address has verifier power for community
    /// @param verifier Address to check
    /// @param communityId Community identifier
    /// @return True if verifier has power > 0
    function hasVerifierPower(address verifier, uint256 communityId) external view returns (bool);

    /// @notice Get eligible verifier count for a community
    /// @param communityId Community identifier
    /// @return Number of eligible verifiers (power > 0, not banned)
    function getEligibleVerifierCount(uint256 communityId) external view returns (uint256);

    /// @notice Get verifier power amount
    /// @param verifier Address to check
    /// @param communityId Community identifier
    /// @return power Amount of verifier power tokens
    function getVerifierPower(address verifier, uint256 communityId) external view returns (uint256 power);
}
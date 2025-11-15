// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVerifierPool
/// @notice Interface for the VerifierPool contract
interface IVerifierPool {
    /// @notice Select M jurors from N available verifiers for a claim
    /// @param claimId Claim ID requiring verification
    /// @param panelSize Total number of jurors to select (N)
    /// @param seed Randomness seed for selection
    /// @return selectedJurors Array of selected juror addresses
    function selectJurors(
        uint256 claimId, 
        uint256 panelSize,
        uint256 seed
    ) external returns (address[] memory selectedJurors);

    /// @notice Update verifier reputation after claim resolution
    /// @param claimId Claim ID that was verified
    /// @param jurors Array of juror addresses
    /// @param successful Array indicating which jurors voted correctly
    function updateReputations(
        uint256 claimId,
        address[] calldata jurors,
        bool[] calldata successful
    ) external;

    /// @notice Check if address is an active verifier
    /// @param verifier Address to check
    /// @return True if verifier is active
    function isVerifier(address verifier) external view returns (bool);

    /// @notice Get active verifier count
    /// @return Number of active verifiers
    function getActiveVerifierCount() external view returns (uint256);
}
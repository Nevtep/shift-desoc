// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IValuableActionSBT
/// @notice Interface for ValuableActionSBT contract
interface IValuableActionSBT {
    /// @notice Mint SBT and award WorkerPoints to a worker
    /// @param worker Address of the worker
    /// @param points Amount of WorkerPoints to award
    /// @param metadataURI IPFS URI for token metadata
    function mintAndAwardPoints(
        address worker,
        uint256 points,
        string calldata metadataURI
    ) external;
    
    /// @notice Award WorkerPoints to an existing SBT holder
    /// @param worker Address of the worker
    /// @param points Amount of WorkerPoints to award
    function awardWorkerPoints(
        address worker,
        uint256 points
    ) external;
    
    /// @notice Check if a worker has an SBT
    /// @param worker Address to check
    /// @return Whether the worker has an SBT
    function hasSBT(address worker) external view returns (bool);
    
    /// @notice Get current WorkerPoints for a worker (with decay applied)
    /// @param worker Address of the worker
    /// @return Current WorkerPoints balance
    function getCurrentWorkerPoints(address worker) external view returns (uint256);
}
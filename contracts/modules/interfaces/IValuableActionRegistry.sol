// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../../libs/Types.sol";

/// @title IValuableActionRegistry
/// @notice Interface for ValuableActionRegistry contract
interface IValuableActionRegistry {
    /// @notice Get valuable action details
    /// @param id Valuable action ID
    /// @return action Valuable action data
    function getValuableAction(uint256 id) external view returns (Types.ValuableAction memory action);
    
    /// @notice Check if a valuable action exists and is active
    /// @param id Valuable action ID
    /// @return Whether the valuable action is active
    function isValuableActionActive(uint256 id) external view returns (bool);
    
    /// @notice Issue an engagement token
    /// @param communityId Community identifier
    /// @param to Address to receive the token
    /// @param subtype Engagement subtype
    /// @param actionTypeId Action type identifier
    /// @param metadata Additional metadata
    /// @return tokenId Minted token ID
    function issueEngagement(
        uint256 communityId,
        address to,
        Types.EngagementSubtype subtype,
        bytes32 actionTypeId,
        bytes calldata metadata
    ) external returns (uint256 tokenId);
}

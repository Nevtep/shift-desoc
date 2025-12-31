// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "contracts/libs/Types.sol";

/// @title IValuableActionSBT
/// @notice Interface for ValuableActionSBT contract
interface IValuableActionSBT {
    enum TokenKind {
        WORK,
        ROLE,
        CREDENTIAL,
        POSITION,
        INVESTMENT
    }

    struct TokenData {
        TokenKind kind;
        uint256 communityId;
        bytes32 actionTypeId;
        bytes32 roleTypeId;
        bytes32 cohortId;
        uint32 points;
        uint32 weight;
        uint64 issuedAt;
        uint64 endedAt;
        uint64 expiry;
        uint8 closeOutcome;
        address verifier;
    }

    /// @notice Mint typed engagement SBT
    /// @param to Recipient
    /// @param subtype Engagement subtype
    /// @param actionTypeId Action type identifier
    /// @param metadata Encoded metadata payload
    /// @return tokenId Minted token ID
    function mintEngagement(
        address to,
        uint256 communityId,
        Types.EngagementSubtype subtype,
        bytes32 actionTypeId,
        bytes calldata metadata
    ) external returns (uint256 tokenId);

    /// @notice Mint position SBT
    /// @param to Recipient
    /// @param positionTypeId Position type identifier
    /// @param points Position points
    /// @param metadata Encoded metadata payload
    /// @return tokenId Minted token ID
    function mintPosition(
        address to,
        uint256 communityId,
        bytes32 positionTypeId,
        uint32 points,
        bytes calldata metadata
    ) external returns (uint256 tokenId);

    /// @notice Mint investment SBT
    /// @param to Recipient
    /// @param cohortId Cohort identifier
    /// @param weight Investor weight
    /// @param metadata Encoded metadata payload
    /// @return tokenId Minted token ID
    function mintInvestment(
        address to,
        uint256 communityId,
        bytes32 cohortId,
        uint32 weight,
        bytes calldata metadata
    ) external returns (uint256 tokenId);

    /// @notice Set ended timestamp for a token (e.g., closing a position)
    function setEndedAt(uint256 tokenId, uint64 endedAt) external;

    /// @notice Close a position token and stamp an outcome code
    function closePositionToken(uint256 tokenId, uint8 outcome) external;

    /// @notice Fetch token data
    function getTokenData(uint256 tokenId) external view returns (TokenData memory);
}
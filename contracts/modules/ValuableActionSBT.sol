// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {Errors} from "../libs/Errors.sol";
import {Types} from "../libs/Types.sol";
import {Roles} from "../libs/Roles.sol";

/// @title ValuableActionSBT
/// @notice Single typed soulbound SBT for work, role, credential, position, and investment records
contract ValuableActionSBT is ERC721URIStorage, AccessManaged {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/
    error Soulbound();
    error TokenNotExists(uint256 tokenId);

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    event TokenIssued(uint256 indexed tokenId, TokenKind kind, uint256 indexed communityId, address indexed subject);


    /*//////////////////////////////////////////////////////////////
                                 TYPES
    //////////////////////////////////////////////////////////////*/
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
        uint256 cohortId;
        uint32 points;
        uint32 weight;
        uint64 issuedAt;
        uint64 endedAt;
        uint64 expiry;
        uint8 closeOutcome;
        address verifier;
    }

    /*//////////////////////////////////////////////////////////////
                                 STORAGE
    //////////////////////////////////////////////////////////////*/
    uint256 public nextTokenId = 1;
    mapping(uint256 => TokenData) private _tokenData;
    mapping(uint256 => bytes) private _tokenRawMetadata;

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(address accessManager) ERC721("Shift ValuableAction SBT", "SHIFT-SBT") AccessManaged(accessManager) {
        if (accessManager == address(0)) revert Errors.ZeroAddress();
    }

    /*//////////////////////////////////////////////////////////////
                             MINT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint an engagement SBT (WORK/ROLE/CREDENTIAL)
    function mintEngagement(
        address to,
        uint256 communityId,
        Types.EngagementSubtype subtype,
        bytes32 actionTypeId,
        bytes calldata metadata
    ) external restricted returns (uint256 tokenId) {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (actionTypeId == bytes32(0)) revert Errors.InvalidInput("Invalid actionTypeId");

        TokenKind kind = _mapSubtypeToKind(subtype);
        tokenId = _mintTypedToken(
            to,
            TokenData({
                kind: kind,
                communityId: communityId,
                actionTypeId: kind == TokenKind.ROLE ? bytes32(0) : actionTypeId,
                roleTypeId: kind == TokenKind.ROLE ? actionTypeId : bytes32(0),
                cohortId: 0,
                points: 0,
                weight: 0,
                issuedAt: uint64(block.timestamp),
                endedAt: 0,
                expiry: 0,
                closeOutcome: 0,
                verifier: address(0)
            }),
            metadata
        );
    }

    /// @notice Mint a position SBT
    function mintPosition(
        address to,
        uint256 communityId,
        bytes32 positionTypeId,
        uint32 points,
        bytes calldata metadata
    ) external restricted returns (uint256 tokenId) {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (positionTypeId == bytes32(0)) revert Errors.InvalidInput("Invalid positionTypeId");

        tokenId = _mintTypedToken(
            to,
            TokenData({
                kind: TokenKind.POSITION,
                communityId: communityId,
                actionTypeId: bytes32(0),
                roleTypeId: positionTypeId,
                cohortId: 0,
                points: points,
                weight: 0,
                issuedAt: uint64(block.timestamp),
                endedAt: 0,
                expiry: 0,
                closeOutcome: 0,
                verifier: address(0)
            }),
            metadata
        );
    }

    /// @notice Mint a role record derived from a position lifecycle
    function mintRoleFromPosition(
        address to,
        uint256 communityId,
        bytes32 roleTypeId,
        uint32 points,
        uint64 issuedAt,
        uint64 endedAt,
        uint8 closeOutcome,
        bytes calldata metadata
    ) external restricted returns (uint256 tokenId) {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (roleTypeId == bytes32(0)) revert Errors.InvalidInput("Invalid roleTypeId");
        if (issuedAt == 0) revert Errors.InvalidInput("Invalid issuedAt");
        if (endedAt < issuedAt) revert Errors.InvalidInput("Invalid endedAt");

        tokenId = _mintTypedToken(
            to,
            TokenData({
                kind: TokenKind.ROLE,
                communityId: communityId,
                actionTypeId: bytes32(0),
                roleTypeId: roleTypeId,
                cohortId: 0,
                points: points,
                weight: 0,
                issuedAt: issuedAt,
                endedAt: endedAt,
                expiry: 0,
                closeOutcome: closeOutcome,
                verifier: msg.sender
            }),
            metadata
        );
    }

    /// @notice Mint an investment SBT
    function mintInvestment(
        address to,
        uint256 communityId,
        uint256 cohortId,
        uint32 weight,
        bytes calldata metadata
    ) external restricted returns (uint256 tokenId) {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (cohortId == 0) revert Errors.InvalidInput("Invalid cohortId");

        tokenId = _mintTypedToken(
            to,
            TokenData({
                kind: TokenKind.INVESTMENT,
                communityId: communityId,
                actionTypeId: bytes32(0),
                roleTypeId: bytes32(0),
                cohortId: cohortId,
                points: 0,
                weight: weight,
                issuedAt: uint64(block.timestamp),
                endedAt: 0,
                expiry: 0,
                closeOutcome: 0,
                verifier: address(0)
            }),
            metadata
        );
    }

    /// @notice Update the endedAt timestamp for a token (e.g., closing a position)
    function setEndedAt(uint256 tokenId, uint64 endedAt) external restricted {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists(tokenId);
        _tokenData[tokenId].endedAt = endedAt;
    }

    /// @notice Close a position token by stamping end time and outcome
    function closePositionToken(uint256 tokenId, uint8 outcome) external restricted {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists(tokenId);
        TokenData storage data = _tokenData[tokenId];
        if (data.kind != TokenKind.POSITION) revert Errors.InvalidInput("Not a position token");
        if (data.endedAt != 0) revert Errors.InvalidInput("Position already closed");

        data.endedAt = uint64(block.timestamp);
        data.closeOutcome = outcome;
    }

    /// @notice Update metadata URI (optional)
    function updateTokenURI(uint256 tokenId, string calldata newURI) external restricted {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists(tokenId);
        _setTokenURI(tokenId, newURI);
    }

    /*//////////////////////////////////////////////////////////////
                         INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/
    function _mintTypedToken(address to, TokenData memory data, bytes calldata metadata) internal returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        _tokenData[tokenId] = data;
        _tokenRawMetadata[tokenId] = metadata;
        emit TokenIssued(tokenId, data.kind, data.communityId, to);
    }

    function _mapSubtypeToKind(Types.EngagementSubtype subtype) internal pure returns (TokenKind) {
        if (subtype == Types.EngagementSubtype.ROLE) return TokenKind.ROLE;
        if (subtype == Types.EngagementSubtype.CREDENTIAL) return TokenKind.CREDENTIAL;
        return TokenKind.WORK;
    }

    /*//////////////////////////////////////////////////////////////
                        SOULBOUND ENFORCEMENT
    //////////////////////////////////////////////////////////////*/
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override(ERC721, IERC721) {
        revert Soulbound();
    }

    /*//////////////////////////////////////////////////////////////
                               VIEWS
    //////////////////////////////////////////////////////////////*/
    function getTokenData(uint256 tokenId) external view returns (TokenData memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotExists(tokenId);
        return _tokenData[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

}
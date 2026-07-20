// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title VerifierPowerToken1155
/// @notice Per-community verifier power token using ERC-1155 with AccessManager authority
/// @dev Token ID represents communityId; AccessManager binds which roles can mint/burn/transfer
contract VerifierPowerToken1155 is ERC1155, AccessManaged {
    /// @notice Immutable community scope for this token instance.
    uint256 public immutable communityId;

    /// @notice Total verifier power supply for the bound community.
    uint256 internal _totalSupply;

    /// @notice Active verifier roster for the bound community.
    address[] internal _activeVerifiers;
    mapping(address => uint256) internal _activeVerifierIndexPlusOne;

    /// @notice Community initialization flag for the bound community.
    bool internal _communityInitialized;
    
    /// @notice Events for verifier power changes
    event VerifierGranted(address indexed to, uint256 indexed communityId, uint256 amount, string reasonCID);
    event VerifierRevoked(address indexed from, uint256 indexed communityId, uint256 amount, string reasonCID);
    event CommunityInitialized(uint256 indexed communityId, string metadataURI);
    
    /// @notice Custom errors
    error TransfersDisabled();
    error CommunityNotInitialized(uint256 communityId);
    error InvalidAmount(uint256 amount);
    error InsufficientBalance(address account, uint256 communityId, uint256 required, uint256 available);
    
    /// @notice Constructor
    /// @param manager Address of the AccessManager authority
    /// @param uri Base metadata URI for the tokens
    constructor(address manager, string memory uri, uint256 _communityId) ERC1155(uri) AccessManaged(manager) {
        if (manager == address(0)) revert Errors.ZeroAddress();
        if (_communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        communityId = _communityId;
    }
    
    /// @notice Initialize this token's immutable community with metadata
    function initializeCommunity(string calldata metadataURI) external restricted {
        _initializeCommunity(metadataURI);
    }

    function _initializeCommunity(string calldata metadataURI) internal {
        if (_communityInitialized) {
            revert Errors.InvalidInput("Community already initialized");
        }

        _communityInitialized = true;
        emit CommunityInitialized(communityId, metadataURI);
    }
    
    /// @notice Mint verifier power for this token's immutable community
    function mint(
        address to,
        uint256 amount,
        string calldata reasonCID
    ) external restricted {
        _mintPower(to, amount, reasonCID);
    }

    function _mintPower(address to, uint256 amount, string calldata reasonCID) internal {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        if (!_communityInitialized) revert CommunityNotInitialized(communityId);
        
        _totalSupply += amount;
        _mint(to, communityId, amount, "");
        _syncActiveVerifier(to);
        
        emit VerifierGranted(to, communityId, amount, reasonCID);
    }
    
    /// @notice Burn verifier power for this token's immutable community
    function burn(
        address from,
        uint256 amount,
        string calldata reasonCID
    ) external restricted {
        _burnPower(from, amount, reasonCID);
    }

    function _burnPower(address from, uint256 amount, string calldata reasonCID) internal {
        if (from == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        
        uint256 currentBalance = balanceOf(from, communityId);
        if (currentBalance < amount) {
            revert InsufficientBalance(from, communityId, amount, currentBalance);
        }
        
        _totalSupply -= amount;
        _burn(from, communityId, amount);
        _syncActiveVerifier(from);
        
        emit VerifierRevoked(from, communityId, amount, reasonCID);
    }
    
    /// @notice Batch mint verifier power for this token's immutable community
    function batchMint(
        address[] calldata to,
        uint256[] calldata amounts,
        string calldata reasonCID
    ) external restricted {
        _batchMintPower(to, amounts, reasonCID);
    }

    function _batchMintPower(
        address[] calldata to,
        uint256[] calldata amounts,
        string calldata reasonCID
    ) internal {
        if (to.length != amounts.length) revert Errors.InvalidInput("Array length mismatch");
        if (!_communityInitialized) revert CommunityNotInitialized(communityId);
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < to.length; i++) {
            if (to[i] == address(0)) revert Errors.ZeroAddress();
            if (amounts[i] == 0) revert InvalidAmount(amounts[i]);
            
            totalAmount += amounts[i];
            _mint(to[i], communityId, amounts[i], "");
            _syncActiveVerifier(to[i]);
            
            emit VerifierGranted(to[i], communityId, amounts[i], reasonCID);
        }
        
        _totalSupply += totalAmount;
    }
    
    /// @notice Batch burn verifier power for this token's immutable community
    function batchBurn(
        address[] calldata from,
        uint256[] calldata amounts,
        string calldata reasonCID
    ) external restricted {
        _batchBurnPower(from, amounts, reasonCID);
    }

    function _batchBurnPower(
        address[] calldata from,
        uint256[] calldata amounts,
        string calldata reasonCID
    ) internal {
        if (from.length != amounts.length) revert Errors.InvalidInput("Array length mismatch");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < from.length; i++) {
            if (from[i] == address(0)) revert Errors.ZeroAddress();
            if (amounts[i] == 0) revert InvalidAmount(amounts[i]);
            
            uint256 currentBalance = balanceOf(from[i], communityId);
            if (currentBalance < amounts[i]) {
                revert InsufficientBalance(from[i], communityId, amounts[i], currentBalance);
            }
            
            totalAmount += amounts[i];
            _totalSupply -= amounts[i];
            _burn(from[i], communityId, amounts[i]);
            _syncActiveVerifier(from[i]);
            
            emit VerifierRevoked(from[i], communityId, amounts[i], reasonCID);
        }
        
    }
    
    /// @notice Disable regular transfers - only AccessManager-authorized transfers allowed via adminTransfer
    /// @dev All transfer functions revert to prevent trading of verifier power
    function safeTransferFrom(
        address, 
        address, 
        uint256, 
        uint256, 
        bytes memory
    ) public virtual override {
        revert TransfersDisabled();
    }
    
    /// @notice Disable batch transfers - only AccessManager-authorized transfers allowed via adminTransfer
    /// @dev Batch transfer function also reverts
    function safeBatchTransferFrom(
        address, 
        address, 
        uint256[] memory, 
        uint256[] memory, 
        bytes memory
    ) public virtual override {
        revert TransfersDisabled();
    }
    
    /// @notice Administrative transfer for this token's immutable community
    function adminTransfer(
        address from,
        address to,
        uint256 amount,
        string calldata reasonCID
    ) external restricted {
        _adminTransferPower(from, to, amount, reasonCID);
    }

    function _adminTransferPower(
        address from,
        address to,
        uint256 amount,
        string calldata reasonCID
    ) internal {
        if (from == address(0) || to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        
        uint256 currentBalance = balanceOf(from, communityId);
        if (currentBalance < amount) {
            revert InsufficientBalance(from, communityId, amount, currentBalance);
        }
        
        _safeTransferFrom(from, to, communityId, amount, "");
        _syncActiveVerifier(from);
        _syncActiveVerifier(to);
        
        // Emit both revocation and granting events for transparency
        emit VerifierRevoked(from, communityId, amount, reasonCID);
        emit VerifierGranted(to, communityId, amount, reasonCID);
    }
    
    /// @notice Check if address has verifier power in this token's immutable community
    function hasVerifierPower(address account) public view returns (bool) {
        return balanceOf(account, communityId) > 0;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function communityInitialized() external view returns (bool) {
        return _communityInitialized;
    }

    function _syncActiveVerifier(address account) internal {
        uint256 indexPlusOne = _activeVerifierIndexPlusOne[account];
        bool hasPower = balanceOf(account, communityId) > 0;

        if (hasPower) {
            if (indexPlusOne == 0) {
                _activeVerifiers.push(account);
                _activeVerifierIndexPlusOne[account] = _activeVerifiers.length;
            }
            return;
        }

        if (indexPlusOne == 0) {
            return;
        }

        uint256 index = indexPlusOne - 1;
        uint256 lastIndex = _activeVerifiers.length - 1;

        if (index != lastIndex) {
            address lastVerifier = _activeVerifiers[lastIndex];
            _activeVerifiers[index] = lastVerifier;
            _activeVerifierIndexPlusOne[lastVerifier] = indexPlusOne;
        }

        _activeVerifiers.pop();
        delete _activeVerifierIndexPlusOne[account];
    }
    
    /// @notice Get active verifier addresses and powers for the bound community.
    /// @dev Returns a paginated slice of the current active verifier roster.
    /// @return verifiers Array of verifier addresses 
    /// @return powers Array of corresponding verifier power amounts
    /// @return hasMore True if there are more results beyond maxResults
    function getCommunityVerifiers(
        uint256 startIndex,
        uint256 maxResults
    ) external view returns (
        address[] memory verifiers,
        uint256[] memory powers,
        bool hasMore
    ) {
        uint256 totalVerifiers = _activeVerifiers.length;
        if (startIndex >= totalVerifiers || maxResults == 0) {
            return (new address[](0), new uint256[](0), false);
        }

        uint256 remaining = totalVerifiers - startIndex;
        uint256 resultLength = maxResults < remaining ? maxResults : remaining;

        verifiers = new address[](resultLength);
        powers = new uint256[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            address verifier = _activeVerifiers[startIndex + i];
            verifiers[i] = verifier;
            powers[i] = balanceOf(verifier, communityId);
        }

        hasMore = resultLength < remaining;
    }
    /// @notice Get verifier power statistics for this token's immutable community
    /// @return totalVerifiers Total number of active verifiers in the bound community roster
    /// @return totalPower Total verifier power distributed
    /// @return averagePower Average power per verifier
    function getCommunityStats() external view returns (
        uint256 totalVerifiers,
        uint256 totalPower,
        uint256 averagePower
    ) {
        totalPower = _totalSupply;
        totalVerifiers = _activeVerifiers.length;
        averagePower = totalVerifiers > 0 ? totalPower / totalVerifiers : 0;
    }
    
    /// @notice Update the base URI for token metadata
    /// @param newURI New base URI
    function setURI(string calldata newURI) external restricted {
        _setURI(newURI);
    }

}
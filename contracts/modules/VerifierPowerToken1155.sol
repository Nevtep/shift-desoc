// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title VerifierPowerToken1155
/// @notice Per-community verifier power token using ERC-1155 with timelock-only control
/// @dev Token ID represents communityId, only timelock can mint/burn/transfer tokens
contract VerifierPowerToken1155 is ERC1155, AccessControl {
    /// @notice Role identifier for timelock contract
    bytes32 public constant TIMELOCK_ROLE = keccak256("TIMELOCK_ROLE");
    
    /// @notice Total supply per community for tracking
    mapping(uint256 => uint256) public totalSupply;
    
    /// @notice Track if a community has been initialized
    mapping(uint256 => bool) public communityInitialized;
    
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
    /// @param timelock Address of the timelock controller
    /// @param uri Base metadata URI for the tokens
    constructor(address timelock, string memory uri) ERC1155(uri) {
        if (timelock == address(0)) revert Errors.ZeroAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, timelock);
        _grantRole(TIMELOCK_ROLE, timelock);
        
        // Revoke admin role from deployer for security
        _revokeRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /// @notice Initialize a new community with metadata
    /// @param communityId Community identifier 
    /// @param metadataURI IPFS hash containing community verifier metadata
    function initializeCommunity(
        uint256 communityId, 
        string calldata metadataURI
    ) external onlyRole(TIMELOCK_ROLE) {
        if (communityInitialized[communityId]) {
            revert Errors.InvalidInput("Community already initialized");
        }
        
        communityInitialized[communityId] = true;
        emit CommunityInitialized(communityId, metadataURI);
    }
    
    /// @notice Mint verifier power tokens (timelock only)
    /// @param to Address to mint tokens to
    /// @param communityId Community identifier (token ID)
    /// @param amount Amount of verifier power to mint
    /// @param reasonCID IPFS hash explaining reason for granting verifier power
    function mint(
        address to, 
        uint256 communityId, 
        uint256 amount, 
        string calldata reasonCID
    ) external onlyRole(TIMELOCK_ROLE) {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        if (!communityInitialized[communityId]) revert CommunityNotInitialized(communityId);
        
        totalSupply[communityId] += amount;
        _mint(to, communityId, amount, "");
        
        emit VerifierGranted(to, communityId, amount, reasonCID);
    }
    
    /// @notice Burn verifier power tokens (timelock only)
    /// @param from Address to burn tokens from
    /// @param communityId Community identifier (token ID)
    /// @param amount Amount of verifier power to burn
    /// @param reasonCID IPFS hash explaining reason for revoking verifier power
    function burn(
        address from, 
        uint256 communityId, 
        uint256 amount,
        string calldata reasonCID
    ) external onlyRole(TIMELOCK_ROLE) {
        if (from == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        
        uint256 currentBalance = balanceOf(from, communityId);
        if (currentBalance < amount) {
            revert InsufficientBalance(from, communityId, amount, currentBalance);
        }
        
        totalSupply[communityId] -= amount;
        _burn(from, communityId, amount);
        
        emit VerifierRevoked(from, communityId, amount, reasonCID);
    }
    
    /// @notice Batch mint to multiple addresses (timelock only)
    /// @param to Array of addresses to mint to
    /// @param communityId Community identifier
    /// @param amounts Array of amounts to mint
    /// @param reasonCID IPFS hash explaining the batch operation
    function batchMint(
        address[] calldata to,
        uint256 communityId,
        uint256[] calldata amounts,
        string calldata reasonCID
    ) external onlyRole(TIMELOCK_ROLE) {
        if (to.length != amounts.length) revert Errors.InvalidInput("Array length mismatch");
        if (!communityInitialized[communityId]) revert CommunityNotInitialized(communityId);
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < to.length; i++) {
            if (to[i] == address(0)) revert Errors.ZeroAddress();
            if (amounts[i] == 0) revert InvalidAmount(amounts[i]);
            
            totalAmount += amounts[i];
            _mint(to[i], communityId, amounts[i], "");
            
            emit VerifierGranted(to[i], communityId, amounts[i], reasonCID);
        }
        
        totalSupply[communityId] += totalAmount;
    }
    
    /// @notice Batch burn from multiple addresses (timelock only)
    /// @param from Array of addresses to burn from
    /// @param communityId Community identifier
    /// @param amounts Array of amounts to burn
    /// @param reasonCID IPFS hash explaining the batch operation
    function batchBurn(
        address[] calldata from,
        uint256 communityId,
        uint256[] calldata amounts,
        string calldata reasonCID
    ) external onlyRole(TIMELOCK_ROLE) {
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
            _burn(from[i], communityId, amounts[i]);
            
            emit VerifierRevoked(from[i], communityId, amounts[i], reasonCID);
        }
        
        totalSupply[communityId] -= totalAmount;
    }
    
    /// @notice Disable regular transfers - only timelock can move tokens
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
    
    /// @notice Disable batch transfers - only timelock can move tokens
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
    
    /// @notice Administrative transfer by timelock (for governance decisions)
    /// @param from Source address
    /// @param to Destination address  
    /// @param communityId Community identifier
    /// @param amount Amount to transfer
    /// @param reasonCID IPFS hash explaining the transfer
    function adminTransfer(
        address from,
        address to,
        uint256 communityId,
        uint256 amount,
        string calldata reasonCID
    ) external onlyRole(TIMELOCK_ROLE) {
        if (from == address(0) || to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert InvalidAmount(amount);
        
        uint256 currentBalance = balanceOf(from, communityId);
        if (currentBalance < amount) {
            revert InsufficientBalance(from, communityId, amount, currentBalance);
        }
        
        _safeTransferFrom(from, to, communityId, amount, "");
        
        // Emit both revocation and granting events for transparency
        emit VerifierRevoked(from, communityId, amount, reasonCID);
        emit VerifierGranted(to, communityId, amount, reasonCID);
    }
    
    /// @notice Check if address has any verifier power for community
    /// @param account Address to check
    /// @param communityId Community identifier
    /// @return True if account has > 0 tokens for community
    function hasVerifierPower(address account, uint256 communityId) external view returns (bool) {
        return balanceOf(account, communityId) > 0;
    }
    
    /// @notice Get all addresses with verifier power for a community (view only - gas intensive)
    /// @dev This is a convenience function that may be expensive for large communities
    /// @return verifiers Array of verifier addresses 
    /// @return powers Array of corresponding verifier power amounts
    /// @return hasMore True if there are more results beyond maxResults
    function getCommunityVerifiers(
        uint256 /* communityId */,
        uint256 /* startIndex */,
        uint256 /* maxResults */
    ) external pure returns (
        address[] memory verifiers,
        uint256[] memory powers,
        bool hasMore
    ) {
        // Note: This is a basic implementation. In production, you'd want to maintain
        // an auxiliary data structure to track verifiers efficiently
        
        // This implementation requires off-chain indexing of Transfer events
        // to efficiently query verifier sets. For now, returning empty arrays.
        verifiers = new address[](0);
        powers = new uint256[](0);
        hasMore = false;
        
        // TODO: Implement efficient verifier enumeration using event indexing
        // or maintain an auxiliary mapping of communityId => verifier addresses
    }
    
    /// @notice Get verifier power statistics for a community
    /// @param communityId Community identifier
    /// @return totalVerifiers Total number of verifiers (would need tracking)
    /// @return totalPower Total verifier power distributed
    /// @return averagePower Average power per verifier
    function getCommunityStats(uint256 communityId) external view returns (
        uint256 totalVerifiers,
        uint256 totalPower,
        uint256 averagePower
    ) {
        totalPower = totalSupply[communityId];
        
        // Note: totalVerifiers would need auxiliary tracking for efficiency
        totalVerifiers = 0; // TODO: Implement verifier counting
        averagePower = totalVerifiers > 0 ? totalPower / totalVerifiers : 0;
    }
    
    /// @notice Update the base URI for token metadata
    /// @param newURI New base URI
    function setURI(string calldata newURI) external onlyRole(TIMELOCK_ROLE) {
        _setURI(newURI);
    }
    
    /// @notice Check interface support
    /// @param interfaceId Interface identifier
    /// @return True if interface is supported
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
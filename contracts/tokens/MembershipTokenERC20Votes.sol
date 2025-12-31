// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Errors} from "../libs/Errors.sol";

/// @title MembershipTokenERC20Votes
/// @notice Governance token that can only be minted through ValuableAction completion
/// @dev Pure governance token with no initial supply - tokens earned only through verified work
contract MembershipTokenERC20Votes is ERC20, ERC20Permit, ERC20Votes, AccessControlEnumerable {
    
    /*//////////////////////////////////////////////////////////////
                                ROLES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Role for contracts that can mint tokens (Engagements, CommunityFactory)
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    /// @notice Role for governance operations
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Maximum supply cap to prevent inflation attacks
    uint256 public constant MAX_SUPPLY = 100_000_000 ether; // 100M tokens max
    
    /// @notice Community ID this token belongs to
    uint256 public immutable communityId;
    
    /// @notice Whether the token has been initialized
    bool public initialized;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Emitted when tokens are minted for ValuableAction completion
    event TokensMintedForWork(
        address indexed recipient,
        uint256 amount,
        address indexed minter,
        string reason
    );
    
    /// @notice Emitted when minter role is granted/revoked
    event MinterRoleUpdated(address indexed account, bool granted, address indexed updater);
    
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    /// @param name Token name (e.g., "TestCommunity Membership")
    /// @param symbol Token symbol (e.g., "MEMBER-1")
    /// @param _communityId ID of the community this token represents
    /// @param admin Address that will have DEFAULT_ADMIN_ROLE initially
    constructor(
        string memory name,
        string memory symbol,
        uint256 _communityId,
        address admin
    ) ERC20(name, symbol) ERC20Permit(name) {
        if (admin == address(0)) revert Errors.ZeroAddress();
        if (_communityId == 0) revert Errors.InvalidInput("Community ID cannot be zero");
        
        communityId = _communityId;
        
        // Grant admin role - no initial token minting
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
    }
    
    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Initialize token with authorized minters (Engagements and CommunityFactory)
    /// @param engagementsContract Address of the Engagements contract
    /// @param communityFactory Address of the CommunityFactory contract
    /// @dev Can only be called once during community setup
    function initialize(address engagementsContract, address communityFactory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (initialized) revert Errors.InvalidInput("Already initialized");
        if (engagementsContract == address(0) || communityFactory == address(0)) {
            revert Errors.ZeroAddress();
        }
        
        // Grant minting rights to authorized contracts
        _grantRole(MINTER_ROLE, engagementsContract);
        _grantRole(MINTER_ROLE, communityFactory);
        
        initialized = true;
        
        emit MinterRoleUpdated(engagementsContract, true, msg.sender);
        emit MinterRoleUpdated(communityFactory, true, msg.sender);
    }
    
    /*//////////////////////////////////////////////////////////////
                             MINTING LOGIC
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Mint tokens for ValuableAction completion
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint
    /// @param reason Description of why tokens are being minted
    /// @dev Can only be called by authorized minters (Engagements, CommunityFactory)
    function mint(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");
        
        // Check supply cap
        uint256 newTotalSupply = totalSupply() + amount;
        if (newTotalSupply > MAX_SUPPLY) {
            revert Errors.InvalidInput("Would exceed max supply");
        }
        
        _mint(to, amount);
        
        emit TokensMintedForWork(to, amount, msg.sender, reason);
    }
    
    /// @notice Batch mint tokens for multiple recipients
    /// @param recipients Array of addresses to mint tokens to
    /// @param amounts Array of amounts to mint for each recipient
    /// @param reason Description of why tokens are being minted
    /// @dev More gas efficient for multiple recipients, used by CommunityFactory for founder bootstrap
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata reason
    ) external onlyRole(MINTER_ROLE) {
        if (recipients.length != amounts.length) {
            revert Errors.InvalidInput("Array length mismatch");
        }
        if (recipients.length == 0) {
            revert Errors.InvalidInput("Empty arrays");
        }
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        // Check supply cap for total batch
        uint256 newTotalSupply = totalSupply() + totalAmount;
        if (newTotalSupply > MAX_SUPPLY) {
            revert Errors.InvalidInput("Batch would exceed max supply");
        }
        
        // Mint to each recipient
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert Errors.ZeroAddress();
            if (amounts[i] == 0) revert Errors.InvalidInput("Amount cannot be zero");
            
            _mint(recipients[i], amounts[i]);
            
            emit TokensMintedForWork(recipients[i], amounts[i], msg.sender, reason);
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                         GOVERNANCE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Grant minter role to a new contract
    /// @param account Address to grant minter role to
    /// @dev Can only be called by governance
    function grantMinterRole(address account) external onlyRole(GOVERNANCE_ROLE) {
        if (account == address(0)) revert Errors.ZeroAddress();
        
        _grantRole(MINTER_ROLE, account);
        
        emit MinterRoleUpdated(account, true, msg.sender);
    }
    
    /// @notice Revoke minter role from an account
    /// @param account Address to revoke minter role from
    /// @dev Can only be called by governance
    function revokeMinterRole(address account) external onlyRole(GOVERNANCE_ROLE) {
        _revokeRole(MINTER_ROLE, account);
        
        emit MinterRoleUpdated(account, false, msg.sender);
    }
    
    /// @notice Emergency burn function for governance
    /// @param from Address to burn tokens from
    /// @param amount Amount of tokens to burn
    /// @dev Only callable by governance in emergency situations
    function emergencyBurn(address from, uint256 amount) external onlyRole(GOVERNANCE_ROLE) {
        if (from == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");
        if (balanceOf(from) < amount) revert Errors.InvalidInput("Insufficient balance");
        
        _burn(from, amount);
    }
    
    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get remaining mintable supply
    /// @return remaining Number of tokens that can still be minted
    function remainingSupply() external view returns (uint256 remaining) {
        return MAX_SUPPLY - totalSupply();
    }
    
    /// @notice Check if an address has minter role
    /// @param account Address to check
    /// @return hasMinterRole True if account has minter role
    function isMinter(address account) external view returns (bool hasMinterRole) {
        return hasRole(MINTER_ROLE, account);
    }
    
    /// @notice Get all addresses with minter role
    /// @return minters Array of addresses with minter role
    function getMinters() external view returns (address[] memory minters) {
        uint256 memberCount = getRoleMemberCount(MINTER_ROLE);
        minters = new address[](memberCount);
        
        for (uint256 i = 0; i < memberCount; i++) {
            minters[i] = getRoleMember(MINTER_ROLE, i);
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                         REQUIRED OVERRIDES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Update function override for ERC20 and ERC20Votes
    function _update(address from, address to, uint256 amount) 
        internal override(ERC20, ERC20Votes) {
        super._update(from, to, amount);
    }
    
    /// @notice Nonces function override for ERC20Permit and Nonces
    function nonces(address owner) 
        public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
    
    /// @notice Supports interface override for AccessControl
    function supportsInterface(bytes4 interfaceId) 
        public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

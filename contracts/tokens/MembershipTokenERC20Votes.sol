// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";
import {AccessManaged} from "@openzeppelin/contracts/access/manager/AccessManaged.sol";
import {Errors} from "../libs/Errors.sol";
import {Roles} from "../libs/Roles.sol";

/// @title MembershipTokenERC20Votes
/// @notice Governance token that can only be minted through ValuableAction completion
/// @dev Pure governance token with no initial supply - tokens earned only through verified work
contract MembershipTokenERC20Votes is ERC20, ERC20Permit, ERC20Votes, AccessManaged {
    
    /*//////////////////////////////////////////////////////////////
                                ROLES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Role IDs used by AccessManager for function authorization
    uint64 public constant MINTER_ROLE = Roles.MEMBERSHIP_TOKEN_MINTER_ROLE;
    uint64 public constant GOVERNANCE_ROLE = Roles.MEMBERSHIP_TOKEN_GOVERNANCE_ROLE;
    
    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Maximum supply cap to prevent inflation attacks
    uint256 public constant MAX_SUPPLY = 100_000_000 ether; // 100M tokens max
    
    /// @notice Community ID this token belongs to
    uint256 public immutable communityId;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Emitted when tokens are minted for ValuableAction completion
    event MembershipTokenMinted(
        address indexed recipient,
        uint256 amount,
        address indexed minter,
        string reason
    );
    
    
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    /// @param name Token name (e.g., "TestCommunity Membership")
    /// @param symbol Token symbol (e.g., "MEMBER-1")
    /// @param _communityId ID of the community this token represents
    /// @param manager AccessManager authority
    constructor(
        string memory name,
        string memory symbol,
        uint256 _communityId,
        address manager
    ) ERC20(name, symbol) ERC20Permit(name) AccessManaged(manager) {
        if (_communityId == 0) revert Errors.InvalidInput("Community ID cannot be zero");
        if (manager == address(0)) revert Errors.ZeroAddress();

        communityId = _communityId;
    }
    
    /*//////////////////////////////////////////////////////////////
                             MINTING LOGIC
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Mint tokens for ValuableAction completion
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint
    /// @param reason Description of why tokens are being minted
    /// @dev Can only be called by authorized minters (Engagements, CommunityFactory)
    function mint(address to, uint256 amount, string calldata reason) external restricted {
        if (to == address(0)) revert Errors.ZeroAddress();
        if (amount == 0) revert Errors.InvalidInput("Amount cannot be zero");
        
        // Check supply cap
        uint256 newTotalSupply = totalSupply() + amount;
        if (newTotalSupply > MAX_SUPPLY) {
            revert Errors.InvalidInput("Would exceed max supply");
        }
        
        _mint(to, amount);
        
        emit MembershipTokenMinted(to, amount, msg.sender, reason);
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
    ) external restricted {
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
            
            emit MembershipTokenMinted(recipients[i], amounts[i], msg.sender, reason);
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                         GOVERNANCE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Emergency burn function for governance
    /// @param from Address to burn tokens from
    /// @param amount Amount of tokens to burn
    /// @dev Only callable by governance in emergency situations
    function emergencyBurn(address from, uint256 amount) external restricted {
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
    
    function getMinters() external pure returns (address[] memory minters) {
        // AccessManager controls minters; on-chain enumeration is external to this contract
        minters = new address[](0);
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
    

}

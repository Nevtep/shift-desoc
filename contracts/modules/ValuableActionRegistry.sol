// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "../libs/Types.sol";
import {Errors} from "../libs/Errors.sol";

/// @title ValuableActionRegistry
/// @notice Registry for configurable valuable actions with verification parameters
/// @dev Manages work verification rules for the Claims system with enhanced governance integration
contract ValuableActionRegistry {
    /// @notice Emitted when a new valuable action is created
    event ValuableActionCreated(uint256 indexed id, Types.ValuableAction valuableAction, address indexed creator);
    
    /// @notice Emitted when a valuable action is updated
    event ValuableActionUpdated(uint256 indexed id, Types.ValuableAction valuableAction, address indexed updater);
    
    /// @notice Emitted when a valuable action is activated after governance approval
    event ValuableActionActivated(uint256 indexed id, uint256 indexed proposalId);
    
    /// @notice Emitted when a valuable action is deactivated
    event ValuableActionDeactivated(uint256 indexed id, address indexed deactivator);
    
    /// @notice Emitted when moderator status is changed
    event ModeratorUpdated(address indexed account, bool isModerator, address indexed updater);

    /// @notice Counter for valuable action IDs
    uint256 public lastId;
    
    /// @notice Mapping from valuable action ID to configuration
    mapping(uint256 => Types.ValuableAction) public valuableActionsById;
    
    /// @notice Mapping from address to moderator status
    mapping(address => bool) public isModerator;
    
    /// @notice Mapping to track active/inactive valuable actions
    mapping(uint256 => bool) public isActive;
    
    /// @notice Mapping to track pending valuable actions awaiting governance approval
    mapping(uint256 => uint256) public pendingValuableActions; // valuableActionId => proposalId
    
    /// @notice Address that can manage moderators (typically governance)
    address public governance;
    
    /// @notice System for founder verification (bootstrap security)
    mapping(address => mapping(uint256 => bool)) public founderWhitelist;  // founder => communityId => verified
    mapping(uint256 => address[]) public communityFounders;               // communityId => founders list

    /// @notice Only moderators can call this function
    modifier onlyModerator() { 
        if (!isModerator[msg.sender]) revert Errors.NotAuthorized(msg.sender); 
        _; 
    }
    
    /// @notice Only governance can call this function
    modifier onlyGovernance() {
        if (msg.sender != governance) revert Errors.NotAuthorized(msg.sender);
        _;
    }

    /// @notice Initialize the registry
    /// @param _governance Address that can manage moderators
    constructor(address _governance) {
        if (_governance == address(0)) revert Errors.ZeroAddress();
        governance = _governance;
        
        // Make governance the initial moderator
        isModerator[_governance] = true;
        emit ModeratorUpdated(_governance, true, msg.sender);
    }

    /// @notice Set moderator status for an address
    /// @param who Address to set moderator status for
    /// @param status Whether the address should be a moderator
    function setModerator(address who, bool status) external onlyGovernance {
        if (who == address(0)) revert Errors.ZeroAddress();
        
        isModerator[who] = status;
        emit ModeratorUpdated(who, status, msg.sender);
    }

    /// @notice Add founder to whitelist for community bootstrap
    /// @param founder Address to add as founder
    /// @param communityId Community ID to grant founder privileges for
    function addFounder(address founder, uint256 communityId) external onlyGovernance {
        if (founder == address(0)) revert Errors.ZeroAddress();
        
        if (!founderWhitelist[founder][communityId]) {
            founderWhitelist[founder][communityId] = true;
            communityFounders[communityId].push(founder);
        }
    }

    /// @notice Propose a new valuable action
    /// @param communityId Community ID this action belongs to
    /// @param params Valuable action configuration
    /// @param ipfsDescription IPFS hash with detailed description
    /// @return valuableActionId The ID of the created valuable action
    function proposeValuableAction(
        uint256 communityId,
        Types.ValuableAction calldata params,
        string calldata ipfsDescription
    ) external payable returns (uint256 valuableActionId) {
        _validateValuableAction(params);
        
        valuableActionId = ++lastId;
        valuableActionsById[valuableActionId] = params;
        
        // Case 1: Founder verification for community bootstrap
        if (params.founderVerified) {
            if (!founderWhitelist[msg.sender][communityId]) {
                revert Errors.NotAuthorized(msg.sender);
            }
            // Founders can create ValuableActions that bypass normal governance delays
            _activateValuableAction(valuableActionId, params);
        } else {
            // Case 2: Normal governance approval required
            if (params.requiresGovernanceApproval) {
                uint256 proposalId = _createGovernanceProposal(valuableActionId, params, ipfsDescription);
                pendingValuableActions[valuableActionId] = proposalId;
            } else {
                // Case 3: Direct activation for simple actions
                _activateValuableAction(valuableActionId, params);
            }
        }
        
        emit ValuableActionCreated(valuableActionId, params, msg.sender);
    }

    /// @notice Activate valuable action after governance approval
    /// @param valuableActionId ID of the valuable action
    /// @param approvedProposalId ID of the approved governance proposal
    function activateFromGovernance(uint256 valuableActionId, uint256 approvedProposalId) external onlyGovernance {
        if (!_exists(valuableActionId)) revert Errors.InvalidValuableAction(valuableActionId);
        if (pendingValuableActions[valuableActionId] != approvedProposalId) {
            revert Errors.InvalidInput("Proposal ID mismatch");
        }
        
        isActive[valuableActionId] = true;
        
        // Clear pending status
        delete pendingValuableActions[valuableActionId];
        
        emit ValuableActionActivated(valuableActionId, approvedProposalId);
    }

    /// @notice Update an existing valuable action
    /// @param id ID of the valuable action to update
    /// @param params New configuration for the valuable action
    function update(uint256 id, Types.ValuableAction calldata params) external onlyModerator {
        if (!_exists(id)) revert Errors.InvalidValuableAction(id);
        if (!isActive[id]) revert Errors.InvalidValuableAction(id);
        
        _validateValuableAction(params);
        
        valuableActionsById[id] = params;
        emit ValuableActionUpdated(id, params, msg.sender);
    }

    /// @notice Deactivate a valuable action (cannot be used for new claims)
    /// @param id ID of the valuable action to deactivate
    function deactivate(uint256 id) external onlyModerator {
        if (!_exists(id)) revert Errors.InvalidValuableAction(id);
        if (!isActive[id]) revert Errors.InvalidValuableAction(id);
        
        isActive[id] = false;
        emit ValuableActionDeactivated(id, msg.sender);
    }

    /// @notice Get valuable action configuration
    /// @param id Valuable action ID
    /// @return action The valuable action configuration
    function getValuableAction(uint256 id) external view returns (Types.ValuableAction memory action) {
        if (!_exists(id)) revert Errors.InvalidValuableAction(id);
        return valuableActionsById[id];
    }

    /// @notice Check if a valuable action exists and is active
    /// @param id Valuable action ID
    /// @return Whether the valuable action is active
    function isValuableActionActive(uint256 id) external view returns (bool) {
        return _exists(id) && isActive[id];
    }

    /// @notice Get all active valuable action IDs
    /// @return ids Array of active valuable action IDs
    function getActiveValuableActions() external view returns (uint256[] memory ids) {
        uint256 activeCount = 0;
        
        // Count active actions
        for (uint256 i = 1; i <= lastId; i++) {
            if (isActive[i]) activeCount++;
        }
        
        // Build array of active IDs
        ids = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= lastId; i++) {
            if (isActive[i]) {
                ids[index++] = i;
            }
        }
    }

    /// @notice Get founders for a community
    /// @param communityId Community ID
    /// @return founders Array of founder addresses
    function getCommunityFounders(uint256 communityId) external view returns (address[] memory founders) {
        return communityFounders[communityId];
    }

    /// @notice Update governance address
    /// @param newGovernance New governance address
    function updateGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert Errors.ZeroAddress();
        governance = newGovernance;
    }

    /// @dev Activate a valuable action immediately
    /// @param valuableActionId ID of the valuable action
    function _activateValuableAction(uint256 valuableActionId, Types.ValuableAction memory /* params */) internal {
        isActive[valuableActionId] = true;
        emit ValuableActionActivated(valuableActionId, 0); // No proposal ID for direct activation
    }

    /// @dev Create governance proposal for valuable action approval
    /// @param valuableActionId ID of the valuable action  
    /// @param description IPFS description
    /// @return proposalId Created proposal ID
    function _createGovernanceProposal(
        uint256 valuableActionId, 
        Types.ValuableAction memory /* params */,
        string calldata description
    ) internal view returns (uint256 proposalId) {
        // This would integrate with the actual governance system
        // For now, return a placeholder proposal ID
        // TODO: Implement actual governance proposal creation
        proposalId = uint256(keccak256(abi.encodePacked(valuableActionId, description, block.timestamp)));
    }

    /// @dev Validate valuable action configuration
    /// @param params Valuable action to validate
    function _validateValuableAction(Types.ValuableAction calldata params) internal pure {
        // Validate basic parameters
        if (params.membershipTokenReward == 0) revert Errors.InvalidInput("MembershipToken reward cannot be zero");
        if (params.jurorsMin == 0) revert Errors.InvalidInput("Minimum jurors cannot be zero");
        if (params.panelSize == 0) revert Errors.InvalidInput("Panel size cannot be zero");
        if (params.jurorsMin > params.panelSize) {
            revert Errors.InvalidInput("Minimum jurors cannot exceed panel size");
        }
        if (params.verifyWindow == 0) revert Errors.InvalidInput("Verify window cannot be zero");
        if (params.slashVerifierBps > 10000) {
            revert Errors.InvalidInput("Slash rate cannot exceed 100%");
        }
        if (bytes(params.evidenceSpecCID).length == 0) {
            revert Errors.InvalidInput("Evidence spec CID cannot be empty");
        }
        if (params.cooldownPeriod == 0) revert Errors.InvalidInput("Cooldown period cannot be zero");
    }

    /// @dev Check if a valuable action exists
    /// @param id Valuable action ID
    /// @return Whether the valuable action exists
    function _exists(uint256 id) internal view returns (bool) {
        return id > 0 && id <= lastId;
    }
}
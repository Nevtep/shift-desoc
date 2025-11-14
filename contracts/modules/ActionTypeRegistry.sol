// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title ActionTypeRegistry
/// @notice Registry for configurable action types with verification parameters
/// @dev Manages work verification rules for the Claims system
contract ActionTypeRegistry {
    /// @notice Emitted when a new action type is created
    event ActionTypeCreated(uint256 indexed id, Types.ActionType actionType, address indexed creator);
    
    /// @notice Emitted when an action type is updated
    event ActionTypeUpdated(uint256 indexed id, Types.ActionType actionType, address indexed updater);
    
    /// @notice Emitted when an action type is deactivated
    event ActionTypeDeactivated(uint256 indexed id, address indexed deactivator);
    
    /// @notice Emitted when moderator status is changed
    event ModeratorUpdated(address indexed account, bool isModerator, address indexed updater);

    /// @notice Counter for action type IDs
    uint256 public lastId;
    
    /// @notice Mapping from action type ID to configuration
    mapping(uint256 => Types.ActionType) public typesById;
    
    /// @notice Mapping from address to moderator status
    mapping(address => bool) public isModerator;
    
    /// @notice Mapping to track active/inactive action types
    mapping(uint256 => bool) public isActive;
    
    /// @notice Address that can manage moderators (typically governance)
    address public governance;

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

    /// @notice Create a new action type
    /// @param actionType Configuration for the new action type
    /// @return id The ID of the created action type
    function create(Types.ActionType calldata actionType) external onlyModerator returns (uint256 id) {
        _validateActionType(actionType);
        
        id = ++lastId;
        typesById[id] = actionType;
        isActive[id] = true;
        
        emit ActionTypeCreated(id, actionType, msg.sender);
    }

    /// @notice Update an existing action type
    /// @param id ID of the action type to update
    /// @param actionType New configuration for the action type
    function update(uint256 id, Types.ActionType calldata actionType) external onlyModerator {
        if (!_exists(id)) revert Errors.InvalidActionType(id);
        if (!isActive[id]) revert Errors.InvalidActionType(id);
        
        _validateActionType(actionType);
        
        typesById[id] = actionType;
        emit ActionTypeUpdated(id, actionType, msg.sender);
    }

    /// @notice Deactivate an action type (cannot be used for new claims)
    /// @param id ID of the action type to deactivate
    function deactivate(uint256 id) external onlyModerator {
        if (!_exists(id)) revert Errors.InvalidActionType(id);
        if (!isActive[id]) revert Errors.InvalidActionType(id);
        
        isActive[id] = false;
        emit ActionTypeDeactivated(id, msg.sender);
    }

    /// @notice Get action type configuration
    /// @param id Action type ID
    /// @return actionType The action type configuration
    function getActionType(uint256 id) external view returns (Types.ActionType memory actionType) {
        if (!_exists(id)) revert Errors.InvalidActionType(id);
        return typesById[id];
    }

    /// @notice Check if an action type exists and is active
    /// @param id Action type ID
    /// @return Whether the action type is active
    function isActionTypeActive(uint256 id) external view returns (bool) {
        return _exists(id) && isActive[id];
    }

    /// @notice Get all active action type IDs
    /// @return ids Array of active action type IDs
    function getActiveActionTypes() external view returns (uint256[] memory ids) {
        uint256 activeCount = 0;
        
        // Count active types
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

    /// @notice Update governance address
    /// @param newGovernance New governance address
    function updateGovernance(address newGovernance) external onlyGovernance {
        if (newGovernance == address(0)) revert Errors.ZeroAddress();
        governance = newGovernance;
    }

    /// @dev Validate action type configuration
    /// @param actionType Action type to validate
    function _validateActionType(Types.ActionType calldata actionType) internal pure {
        // Validate basic parameters
        if (actionType.weight == 0) revert Errors.InvalidInput("Weight cannot be zero");
        if (actionType.jurorsMin == 0) revert Errors.InvalidInput("Minimum jurors cannot be zero");
        if (actionType.panelSize == 0) revert Errors.InvalidInput("Panel size cannot be zero");
        if (actionType.jurorsMin > actionType.panelSize) {
            revert Errors.InvalidInput("Minimum jurors cannot exceed panel size");
        }
        if (actionType.verifyWindow == 0) revert Errors.InvalidInput("Verify window cannot be zero");
        if (actionType.slashVerifierBps > 10000) {
            revert Errors.InvalidInput("Slash rate cannot exceed 100%");
        }
        if (bytes(actionType.evidenceSpecCID).length == 0) {
            revert Errors.InvalidInput("Evidence spec CID cannot be empty");
        }
    }

    /// @dev Check if an action type exists
    /// @param id Action type ID
    /// @return Whether the action type exists
    function _exists(uint256 id) internal view returns (bool) {
        return id > 0 && id <= lastId;
    }
}

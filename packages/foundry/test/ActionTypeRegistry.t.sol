// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ActionTypeRegistry} from "contracts/modules/ActionTypeRegistry.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";

/// @title ActionTypeRegistryTest
/// @notice Comprehensive tests for ActionTypeRegistry contract
contract ActionTypeRegistryTest is Test {
    ActionTypeRegistry public registry;
    
    address public governance = address(0x1);
    address public moderator1 = address(0x2);
    address public moderator2 = address(0x3);
    address public unauthorizedUser = address(0x4);
    
    // Sample action types for testing
    Types.ActionType public basicActionType;
    Types.ActionType public advancedActionType;
    
    event ActionTypeCreated(uint256 indexed id, Types.ActionType actionType, address indexed creator);
    event ActionTypeUpdated(uint256 indexed id, Types.ActionType actionType, address indexed updater);
    event ActionTypeDeactivated(uint256 indexed id, address indexed deactivator);
    event ModeratorUpdated(address indexed account, bool isModerator, address indexed updater);

    function setUp() public {
        // Deploy registry with governance
        vm.prank(governance);
        registry = new ActionTypeRegistry(governance);
        
        // Setup sample action types
        basicActionType = Types.ActionType({
            weight: 100,
            jurorsMin: 3,
            panelSize: 5,
            verifyWindow: 24 hours,
            cooldown: 1 hours,
            rewardVerify: 10,
            slashVerifierBps: 1000, // 10%
            revocable: true,
            evidenceSpecCID: "QmBasicEvidence123"
        });
        
        advancedActionType = Types.ActionType({
            weight: 500,
            jurorsMin: 5,
            panelSize: 10,
            verifyWindow: 48 hours,
            cooldown: 6 hours,
            rewardVerify: 25,
            slashVerifierBps: 2000, // 20%
            revocable: false,
            evidenceSpecCID: "QmAdvancedEvidence456"
        });
    }

    /// @notice Test initial deployment state
    function test_deployment() public {
        assertEq(registry.governance(), governance);
        assertEq(registry.lastId(), 0);
        assertTrue(registry.isModerator(governance)); // Governance is initial moderator
        assertFalse(registry.isModerator(moderator1));
    }

    /// @notice Test deployment with zero address fails
    function test_deployment_zeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new ActionTypeRegistry(address(0));
    }

    /// @notice Test setting moderator status
    function test_setModerator_success() public {
        vm.expectEmit(true, false, false, true);
        emit ModeratorUpdated(moderator1, true, governance);
        
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        assertTrue(registry.isModerator(moderator1));
        
        // Remove moderator status
        vm.expectEmit(true, false, false, true);
        emit ModeratorUpdated(moderator1, false, governance);
        
        vm.prank(governance);
        registry.setModerator(moderator1, false);
        
        assertFalse(registry.isModerator(moderator1));
    }

    /// @notice Test setting moderator fails for unauthorized caller
    function test_setModerator_unauthorized() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        registry.setModerator(moderator1, true);
    }

    /// @notice Test setting moderator with zero address fails
    function test_setModerator_zeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(governance);
        registry.setModerator(address(0), true);
    }

    /// @notice Test creating action type
    function test_create_success() public {
        // Set up moderator
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.expectEmit(true, false, false, true);
        emit ActionTypeCreated(1, basicActionType, moderator1);
        
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        assertEq(id, 1);
        assertEq(registry.lastId(), 1);
        assertTrue(registry.isActionTypeActive(1));
        
        Types.ActionType memory retrieved = registry.getActionType(1);
        assertEq(retrieved.weight, basicActionType.weight);
        assertEq(retrieved.jurorsMin, basicActionType.jurorsMin);
        assertEq(retrieved.panelSize, basicActionType.panelSize);
        assertEq(retrieved.verifyWindow, basicActionType.verifyWindow);
        assertEq(retrieved.cooldown, basicActionType.cooldown);
        assertEq(retrieved.rewardVerify, basicActionType.rewardVerify);
        assertEq(retrieved.slashVerifierBps, basicActionType.slashVerifierBps);
        assertEq(retrieved.revocable, basicActionType.revocable);
        assertEq(retrieved.evidenceSpecCID, basicActionType.evidenceSpecCID);
    }

    /// @notice Test creating multiple action types
    function test_create_multiple() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        // Create first action type
        vm.prank(moderator1);
        uint256 id1 = registry.create(basicActionType);
        assertEq(id1, 1);
        
        // Create second action type
        vm.prank(moderator1);
        uint256 id2 = registry.create(advancedActionType);
        assertEq(id2, 2);
        
        assertEq(registry.lastId(), 2);
        assertTrue(registry.isActionTypeActive(1));
        assertTrue(registry.isActionTypeActive(2));
        
        // Verify both are in active list
        uint256[] memory activeIds = registry.getActiveActionTypes();
        assertEq(activeIds.length, 2);
        assertEq(activeIds[0], 1);
        assertEq(activeIds[1], 2);
    }

    /// @notice Test create fails for unauthorized caller
    function test_create_unauthorized() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        registry.create(basicActionType);
    }

    /// @notice Test create fails with invalid parameters
    function test_create_invalidParameters() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        // Zero weight
        Types.ActionType memory invalidType = basicActionType;
        invalidType.weight = 0;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Weight cannot be zero"));
        vm.prank(moderator1);
        registry.create(invalidType);
        
        // Zero minimum jurors
        invalidType = basicActionType;
        invalidType.jurorsMin = 0;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot be zero"));
        vm.prank(moderator1);
        registry.create(invalidType);
        
        // Zero panel size
        invalidType = basicActionType;
        invalidType.panelSize = 0;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Panel size cannot be zero"));
        vm.prank(moderator1);
        registry.create(invalidType);
        
        // Minimum jurors > panel size
        invalidType = basicActionType;
        invalidType.jurorsMin = 10;
        invalidType.panelSize = 5;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Minimum jurors cannot exceed panel size"));
        vm.prank(moderator1);
        registry.create(invalidType);
        
        // Zero verify window
        invalidType = basicActionType;
        invalidType.verifyWindow = 0;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Verify window cannot be zero"));
        vm.prank(moderator1);
        registry.create(invalidType);
        
        // Slash rate > 100%
        invalidType = basicActionType;
        invalidType.slashVerifierBps = 10001;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Slash rate cannot exceed 100%"));
        vm.prank(moderator1);
        registry.create(invalidType);
        
        // Empty evidence spec CID
        invalidType = basicActionType;
        invalidType.evidenceSpecCID = "";
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Evidence spec CID cannot be empty"));
        vm.prank(moderator1);
        registry.create(invalidType);
    }

    /// @notice Test updating action type
    function test_update_success() public {
        // Setup and create initial action type
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        // Update with new parameters
        Types.ActionType memory updatedType = advancedActionType;
        
        vm.expectEmit(true, false, false, true);
        emit ActionTypeUpdated(id, updatedType, moderator1);
        
        vm.prank(moderator1);
        registry.update(id, updatedType);
        
        Types.ActionType memory retrieved = registry.getActionType(id);
        assertEq(retrieved.weight, updatedType.weight);
        assertEq(retrieved.jurorsMin, updatedType.jurorsMin);
        assertEq(retrieved.evidenceSpecCID, updatedType.evidenceSpecCID);
    }

    /// @notice Test update fails for non-existent action type
    function test_update_nonExistent() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidActionType.selector, 999));
        vm.prank(moderator1);
        registry.update(999, basicActionType);
    }

    /// @notice Test update fails for deactivated action type
    function test_update_deactivated() public {
        // Setup and create action type
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        // Deactivate it
        vm.prank(moderator1);
        registry.deactivate(id);
        
        // Try to update deactivated type
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidActionType.selector, id));
        vm.prank(moderator1);
        registry.update(id, advancedActionType);
    }

    /// @notice Test update fails for unauthorized caller
    function test_update_unauthorized() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        registry.update(id, advancedActionType);
    }

    /// @notice Test deactivating action type
    function test_deactivate_success() public {
        // Setup and create action type
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        assertTrue(registry.isActionTypeActive(id));
        
        vm.expectEmit(true, false, false, false);
        emit ActionTypeDeactivated(id, moderator1);
        
        vm.prank(moderator1);
        registry.deactivate(id);
        
        assertFalse(registry.isActionTypeActive(id));
        
        // Should not be in active list
        uint256[] memory activeIds = registry.getActiveActionTypes();
        assertEq(activeIds.length, 0);
    }

    /// @notice Test deactivate fails for non-existent action type
    function test_deactivate_nonExistent() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidActionType.selector, 999));
        vm.prank(moderator1);
        registry.deactivate(999);
    }

    /// @notice Test deactivate fails for already deactivated action type
    function test_deactivate_alreadyDeactivated() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        vm.prank(moderator1);
        registry.deactivate(id);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidActionType.selector, id));
        vm.prank(moderator1);
        registry.deactivate(id);
    }

    /// @notice Test getting action type
    function test_getActionType_success() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        Types.ActionType memory retrieved = registry.getActionType(id);
        assertEq(retrieved.weight, basicActionType.weight);
        assertEq(retrieved.evidenceSpecCID, basicActionType.evidenceSpecCID);
    }

    /// @notice Test getting non-existent action type fails
    function test_getActionType_nonExistent() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidActionType.selector, 999));
        registry.getActionType(999);
    }

    /// @notice Test getting active action types
    function test_getActiveActionTypes() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        // Initially empty
        uint256[] memory activeIds = registry.getActiveActionTypes();
        assertEq(activeIds.length, 0);
        
        // Create multiple action types
        vm.prank(moderator1);
        uint256 id1 = registry.create(basicActionType);
        
        vm.prank(moderator1);
        uint256 id2 = registry.create(advancedActionType);
        
        activeIds = registry.getActiveActionTypes();
        assertEq(activeIds.length, 2);
        assertEq(activeIds[0], id1);
        assertEq(activeIds[1], id2);
        
        // Deactivate one
        vm.prank(moderator1);
        registry.deactivate(id1);
        
        activeIds = registry.getActiveActionTypes();
        assertEq(activeIds.length, 1);
        assertEq(activeIds[0], id2);
    }

    /// @notice Test updating governance
    function test_updateGovernance_success() public {
        address newGovernance = address(0x999);
        
        vm.prank(governance);
        registry.updateGovernance(newGovernance);
        
        assertEq(registry.governance(), newGovernance);
    }

    /// @notice Test updating governance fails for unauthorized caller
    function test_updateGovernance_unauthorized() public {
        address newGovernance = address(0x999);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        registry.updateGovernance(newGovernance);
    }

    /// @notice Test updating governance with zero address fails
    function test_updateGovernance_zeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(governance);
        registry.updateGovernance(address(0));
    }

    /// @notice Test edge case: maximum valid slash rate
    function test_create_maxSlashRate() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        Types.ActionType memory maxSlashType = basicActionType;
        maxSlashType.slashVerifierBps = 10000; // 100%
        
        vm.prank(moderator1);
        uint256 id = registry.create(maxSlashType);
        
        Types.ActionType memory retrieved = registry.getActionType(id);
        assertEq(retrieved.slashVerifierBps, 10000);
    }

    /// @notice Test edge case: minimum valid parameters
    function test_create_minimumValues() public {
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        Types.ActionType memory minType = Types.ActionType({
            weight: 1,
            jurorsMin: 1,
            panelSize: 1,
            verifyWindow: 1,
            cooldown: 0, // Cooldown can be 0
            rewardVerify: 0, // Reward can be 0
            slashVerifierBps: 0, // No slashing
            revocable: false,
            evidenceSpecCID: "Q" // Minimum valid IPFS CID
        });
        
        vm.prank(moderator1);
        uint256 id = registry.create(minType);
        
        assertTrue(registry.isActionTypeActive(id));
    }

    /// @notice Test multiple moderators can manage action types
    function test_multipleModerators() public {
        // Set up two moderators
        vm.prank(governance);
        registry.setModerator(moderator1, true);
        
        vm.prank(governance);
        registry.setModerator(moderator2, true);
        
        // First moderator creates action type
        vm.prank(moderator1);
        uint256 id = registry.create(basicActionType);
        
        // Second moderator updates it
        vm.prank(moderator2);
        registry.update(id, advancedActionType);
        
        // First moderator deactivates it
        vm.prank(moderator1);
        registry.deactivate(id);
        
        assertFalse(registry.isActionTypeActive(id));
    }
}
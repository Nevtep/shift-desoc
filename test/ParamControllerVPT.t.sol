// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ParamController} from "../contracts/modules/ParamController.sol";
import {Errors} from "../contracts/libs/Errors.sol";

/// @title ParamController VPT Integration Test Suite
/// @notice Comprehensive tests for VPT system parameter management in ParamController
contract ParamControllerVPTTest is Test {
    ParamController public paramController;
    
    address public governance = makeAddr("governance");
    address public unauthorizedUser = makeAddr("unauthorized");
    
    uint256 public constant COMMUNITY_ID_1 = 1;
    uint256 public constant COMMUNITY_ID_2 = 2;
    
    event UintParamSet(uint256 indexed communityId, bytes32 indexed key, uint256 value);
    event BoolParamSet(uint256 indexed communityId, bytes32 indexed key, bool value);
    event GovernanceUpdated(address oldGov, address newGov);
    
    function setUp() public {
        paramController = new ParamController(governance);
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        assertEq(paramController.governance(), governance);
    }
    
    function testConstructorZeroAddressReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new ParamController(address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                      VPT PARAMETER CONSTANT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testVPTParameterConstants() public view {
        // Verify all VPT parameter constants are properly defined
        assertTrue(paramController.VERIFIER_PANEL_SIZE() != bytes32(0));
        assertTrue(paramController.VERIFIER_MIN() != bytes32(0));
        assertTrue(paramController.MAX_PANELS_PER_EPOCH() != bytes32(0));
        assertTrue(paramController.USE_VPT_WEIGHTING() != bytes32(0));
        assertTrue(paramController.MAX_WEIGHT_PER_VERIFIER() != bytes32(0));
        assertTrue(paramController.COOLDOWN_AFTER_FRAUD() != bytes32(0));
        
        // Verify constants have expected values
        assertEq(paramController.VERIFIER_PANEL_SIZE(), keccak256("VERIFIER_PANEL_SIZE"));
        assertEq(paramController.VERIFIER_MIN(), keccak256("VERIFIER_MIN"));
        assertEq(paramController.MAX_PANELS_PER_EPOCH(), keccak256("MAX_PANELS_PER_EPOCH"));
        assertEq(paramController.USE_VPT_WEIGHTING(), keccak256("USE_VPT_WEIGHTING"));
        assertEq(paramController.MAX_WEIGHT_PER_VERIFIER(), keccak256("MAX_WEIGHT_PER_VERIFIER"));
        assertEq(paramController.COOLDOWN_AFTER_FRAUD(), keccak256("COOLDOWN_AFTER_FRAUD"));
    }
    
    /*//////////////////////////////////////////////////////////////
                      INDIVIDUAL PARAMETER TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetUint256Parameters() public {
        // Test setting verifier panel size
        vm.expectEmit(true, true, false, true);
        emit UintParamSet(COMMUNITY_ID_1, paramController.VERIFIER_PANEL_SIZE(), 5);
        
        vm.startPrank(governance);
        paramController.setUint256(COMMUNITY_ID_1, paramController.VERIFIER_PANEL_SIZE(), 5);
        
        // Test setting verifier minimum
        paramController.setUint256(COMMUNITY_ID_1, paramController.VERIFIER_MIN(), 3);
        
        // Test setting max panels per epoch
        paramController.setUint256(COMMUNITY_ID_1, paramController.MAX_PANELS_PER_EPOCH(), 10);
        
        // Test setting max weight per verifier
        paramController.setUint256(COMMUNITY_ID_1, paramController.MAX_WEIGHT_PER_VERIFIER(), 1000);
        
        // Test setting cooldown after fraud
        paramController.setUint256(COMMUNITY_ID_1, paramController.COOLDOWN_AFTER_FRAUD(), 86400);
        vm.stopPrank();
        
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.VERIFIER_PANEL_SIZE()), 5);
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.VERIFIER_MIN()), 3);
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.MAX_PANELS_PER_EPOCH()), 10);
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.MAX_WEIGHT_PER_VERIFIER()), 1000);
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.COOLDOWN_AFTER_FRAUD()), 86400);
    }
    
    function testSetBoolParameters() public {
        // Test setting VPT weighting
        vm.expectEmit(true, true, false, true);
        emit BoolParamSet(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING(), true);
        
        vm.startPrank(governance);
        paramController.setBool(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING(), true);
        vm.stopPrank();
        
        assertTrue(paramController.getBool(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING()));
        
        // Test setting it to false
        vm.startPrank(governance);
        paramController.setBool(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING(), false);
        vm.stopPrank();
        
        assertFalse(paramController.getBool(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING()));
    }
    
    function testSetParametersUnauthorizedReverts() public {
        bytes32 panelSizeKey = paramController.VERIFIER_PANEL_SIZE();
        bytes32 vptWeightingKey = paramController.USE_VPT_WEIGHTING();
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        paramController.setUint256(COMMUNITY_ID_1, panelSizeKey, 5);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        paramController.setBool(COMMUNITY_ID_1, vptWeightingKey, true);
    }
    
    /*//////////////////////////////////////////////////////////////
                     BULK VERIFIER PARAMETER TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetVerifierParams() public {
        uint256 verifierPanelSize = 5;
        uint256 verifierMin = 3;
        uint256 maxPanelsPerEpoch = 10;
        bool useVPTWeighting = true;
        uint256 maxWeightPerVerifier = 1000;
        uint256 cooldownAfterFraud = 86400;
        
        // Expect all parameter set events
        vm.expectEmit(true, true, false, true);
        emit UintParamSet(COMMUNITY_ID_1, paramController.VERIFIER_PANEL_SIZE(), verifierPanelSize);
        vm.expectEmit(true, true, false, true);
        emit UintParamSet(COMMUNITY_ID_1, paramController.VERIFIER_MIN(), verifierMin);
        vm.expectEmit(true, true, false, true);
        emit UintParamSet(COMMUNITY_ID_1, paramController.MAX_PANELS_PER_EPOCH(), maxPanelsPerEpoch);
        vm.expectEmit(true, true, false, true);
        emit UintParamSet(COMMUNITY_ID_1, paramController.MAX_WEIGHT_PER_VERIFIER(), maxWeightPerVerifier);
        vm.expectEmit(true, true, false, true);
        emit UintParamSet(COMMUNITY_ID_1, paramController.COOLDOWN_AFTER_FRAUD(), cooldownAfterFraud);
        vm.expectEmit(true, true, false, true);
        emit BoolParamSet(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING(), useVPTWeighting);
        
        vm.prank(governance);
        paramController.setVerifierParams(
            COMMUNITY_ID_1,
            verifierPanelSize,
            verifierMin,
            maxPanelsPerEpoch,
            useVPTWeighting,
            maxWeightPerVerifier,
            cooldownAfterFraud
        );
        
        // Verify all parameters were set correctly
        (
            uint256 returnedPanelSize,
            uint256 returnedMin,
            uint256 returnedMaxPanels,
            bool returnedWeighting,
            uint256 returnedMaxWeight,
            uint256 returnedCooldown
        ) = paramController.getVerifierParams(COMMUNITY_ID_1);
        
        assertEq(returnedPanelSize, verifierPanelSize);
        assertEq(returnedMin, verifierMin);
        assertEq(returnedMaxPanels, maxPanelsPerEpoch);
        assertEq(returnedWeighting, useVPTWeighting);
        assertEq(returnedMaxWeight, maxWeightPerVerifier);
        assertEq(returnedCooldown, cooldownAfterFraud);
    }
    
    function testSetVerifierParamsValidation() public {
        // Test verifier min cannot exceed panel size
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Min cannot exceed panel size"));
        vm.prank(governance);
        paramController.setVerifierParams(COMMUNITY_ID_1, 3, 5, 10, false, 1000, 86400);
        
        // Test panel size cannot be zero
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Panel size cannot be zero"));
        vm.prank(governance);
        paramController.setVerifierParams(COMMUNITY_ID_1, 0, 0, 10, false, 1000, 86400);
    }
    
    function testSetVerifierParamsUnauthorizedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        paramController.setVerifierParams(COMMUNITY_ID_1, 5, 3, 10, true, 1000, 86400);
    }
    
    /*//////////////////////////////////////////////////////////////
                      MULTI-COMMUNITY ISOLATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMultiCommunityParameterIsolation() public {
        // Set different parameters for different communities
        vm.startPrank(governance);
        
        // Community 1: Standard configuration
        paramController.setVerifierParams(COMMUNITY_ID_1, 5, 3, 10, true, 1000, 86400);
        
        // Community 2: Different configuration
        paramController.setVerifierParams(COMMUNITY_ID_2, 7, 4, 15, false, 2000, 172800);
        
        vm.stopPrank();
        
        // Verify Community 1 parameters
        (
            uint256 panelSize1,
            uint256 min1,
            uint256 maxPanels1,
            bool weighting1,
            uint256 maxWeight1,
            uint256 cooldown1
        ) = paramController.getVerifierParams(COMMUNITY_ID_1);
        
        assertEq(panelSize1, 5);
        assertEq(min1, 3);
        assertEq(maxPanels1, 10);
        assertTrue(weighting1);
        assertEq(maxWeight1, 1000);
        assertEq(cooldown1, 86400);
        
        // Verify Community 2 parameters
        (
            uint256 panelSize2,
            uint256 min2,
            uint256 maxPanels2,
            bool weighting2,
            uint256 maxWeight2,
            uint256 cooldown2
        ) = paramController.getVerifierParams(COMMUNITY_ID_2);
        
        assertEq(panelSize2, 7);
        assertEq(min2, 4);
        assertEq(maxPanels2, 15);
        assertFalse(weighting2);
        assertEq(maxWeight2, 2000);
        assertEq(cooldown2, 172800);
    }
    
    function testParameterDefaultValues() public view {
        // Verify unset parameters return default values
        (
            uint256 panelSize,
            uint256 min,
            uint256 maxPanels,
            bool weighting,
            uint256 maxWeight,
            uint256 cooldown
        ) = paramController.getVerifierParams(999); // Non-existent community
        
        assertEq(panelSize, 0);
        assertEq(min, 0);
        assertEq(maxPanels, 0);
        assertFalse(weighting);
        assertEq(maxWeight, 0);
        assertEq(cooldown, 0);
    }
    
    /*//////////////////////////////////////////////////////////////
                      PARAMETER UPDATE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testParameterUpdates() public {
        // Initial setup
        vm.prank(governance);
        paramController.setVerifierParams(COMMUNITY_ID_1, 5, 3, 10, true, 1000, 86400);
        
        // Update individual parameters
        vm.startPrank(governance);
        
        paramController.setUint256(COMMUNITY_ID_1, paramController.VERIFIER_PANEL_SIZE(), 7);
        paramController.setBool(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING(), false);
        
        vm.stopPrank();
        
        // Verify updates
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.VERIFIER_PANEL_SIZE()), 7);
        assertFalse(paramController.getBool(COMMUNITY_ID_1, paramController.USE_VPT_WEIGHTING()));
        
        // Verify other parameters unchanged
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.VERIFIER_MIN()), 3);
        assertEq(paramController.getUint256(COMMUNITY_ID_1, paramController.MAX_PANELS_PER_EPOCH()), 10);
    }
    
    /*//////////////////////////////////////////////////////////////
                       GOVERNANCE MANAGEMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testUpdateGovernance() public {
        address newGovernance = makeAddr("newGovernance");
        
        vm.expectEmit(false, false, false, true);
        emit GovernanceUpdated(governance, newGovernance);
        
        vm.prank(governance);
        paramController.updateGovernance(newGovernance);
        
        assertEq(paramController.governance(), newGovernance);
        
        // Verify old governance address should no longer work
        bytes32 panelSizeKey = paramController.VERIFIER_PANEL_SIZE();
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, governance));
        vm.prank(governance);
        paramController.setUint256(COMMUNITY_ID_1, panelSizeKey, 999);
        
        // New governance should work
        vm.prank(newGovernance);
        paramController.setUint256(COMMUNITY_ID_1, panelSizeKey, 10);
        
        assertEq(paramController.getUint256(COMMUNITY_ID_1, panelSizeKey), 10);
    }
    
    function testUpdateGovernanceZeroAddressReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(governance);
        paramController.updateGovernance(address(0));
    }
    
    function testUpdateGovernanceUnauthorizedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        paramController.updateGovernance(makeAddr("newGov"));
    }
    
    /*//////////////////////////////////////////////////////////////
                        REALISTIC CONFIGURATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testRealisticVPTConfigurations() public {
        vm.startPrank(governance);
        
        // Small Community Configuration
        paramController.setVerifierParams(
            1, // Small community
            3, // Small panel
            2, // Simple majority
            5, // Limited concurrent panels
            false, // No weighting (equality-focused)
            0, // No weight limits needed
            3600 // 1 hour fraud cooldown
        );
        
        // Medium Community Configuration
        paramController.setVerifierParams(
            2, // Medium community
            5, // Medium panel
            3, // Majority of 5
            20, // More panels allowed
            true, // Use VPT weighting
            1000, // Reasonable weight limit
            86400 // 1 day fraud cooldown
        );
        
        // Large Community Configuration
        paramController.setVerifierParams(
            3, // Large community
            9, // Large panel for better coverage
            5, // Higher threshold for security
            50, // Many concurrent panels
            true, // Use VPT weighting
            500, // Lower individual weight limit to prevent concentration
            604800 // 1 week fraud cooldown
        );
        
        vm.stopPrank();
        
        // Verify configurations make sense
        (uint256 panelSize1, uint256 min1,,, uint256 maxWeight1,) = paramController.getVerifierParams(1);
        assertTrue(min1 <= panelSize1); // Min doesn't exceed panel size
        assertEq(maxWeight1, 0); // No weighting used
        
        (uint256 panelSize2, uint256 min2,,, uint256 maxWeight2,) = paramController.getVerifierParams(2);
        assertTrue(min2 <= panelSize2);
        assertTrue(maxWeight2 > 0); // Weighting configured
        
        (uint256 panelSize3, uint256 min3,,, uint256 maxWeight3,) = paramController.getVerifierParams(3);
        assertTrue(min3 <= panelSize3);
        assertTrue(maxWeight3 < 1000); // Lower weight limit for large community
    }
    
    /*//////////////////////////////////////////////////////////////
                           EDGE CASE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testExtremeValues() public {
        vm.startPrank(governance);
        
        // Test maximum reasonable values
        paramController.setVerifierParams(
            COMMUNITY_ID_1,
            type(uint8).max, // Very large panel (255)
            type(uint8).max, // Same as panel size
            type(uint16).max, // Very many panels
            true,
            type(uint32).max, // Very large weights
            type(uint32).max  // Very long cooldown
        );
        
        // Test minimum values
        paramController.setVerifierParams(
            COMMUNITY_ID_2,
            1, // Minimum panel size
            1, // Minimum approval needed
            0, // No panel limit
            false,
            0, // No weight limits
            0  // No cooldown
        );
        
        vm.stopPrank();
        
        // Verify extreme values are stored correctly
        (uint256 panelSize1, uint256 min1, uint256 maxPanels1, bool weighting1, uint256 maxWeight1, uint256 cooldown1) = 
            paramController.getVerifierParams(COMMUNITY_ID_1);
        
        assertEq(panelSize1, type(uint8).max);
        assertEq(min1, type(uint8).max);
        assertEq(maxPanels1, type(uint16).max);
        assertTrue(weighting1);
        assertEq(maxWeight1, type(uint32).max);
        assertEq(cooldown1, type(uint32).max);
        
        (uint256 panelSize2, uint256 min2, uint256 maxPanels2, bool weighting2, uint256 maxWeight2, uint256 cooldown2) = 
            paramController.getVerifierParams(COMMUNITY_ID_2);
        
        assertEq(panelSize2, 1);
        assertEq(min2, 1);
        assertEq(maxPanels2, 0);
        assertFalse(weighting2);
        assertEq(maxWeight2, 0);
        assertEq(cooldown2, 0);
    }
    
    /*//////////////////////////////////////////////////////////////
                              FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzzSetVerifierParams(
        uint256 communityId,
        uint8 panelSize,
        uint8 minApprovals,
        uint16 maxPanels,
        bool useWeighting,
        uint32 maxWeight,
        uint32 cooldown
    ) public {
        vm.assume(panelSize > 0);
        vm.assume(minApprovals <= panelSize);
        
        vm.prank(governance);
        paramController.setVerifierParams(
            communityId,
            panelSize,
            minApprovals,
            maxPanels,
            useWeighting,
            maxWeight,
            cooldown
        );
        
        (
            uint256 returnedPanelSize,
            uint256 returnedMin,
            uint256 returnedMaxPanels,
            bool returnedWeighting,
            uint256 returnedMaxWeight,
            uint256 returnedCooldown
        ) = paramController.getVerifierParams(communityId);
        
        assertEq(returnedPanelSize, panelSize);
        assertEq(returnedMin, minApprovals);
        assertEq(returnedMaxPanels, maxPanels);
        assertEq(returnedWeighting, useWeighting);
        assertEq(returnedMaxWeight, maxWeight);
        assertEq(returnedCooldown, cooldown);
    }
    
    function testFuzzIndividualParameters(
        uint256 communityId,
        uint256 paramValue,
        bool boolValue
    ) public {
        vm.startPrank(governance);
        
        // Test all uint256 parameters
        paramController.setUint256(communityId, paramController.VERIFIER_PANEL_SIZE(), paramValue);
        assertEq(paramController.getUint256(communityId, paramController.VERIFIER_PANEL_SIZE()), paramValue);
        
        paramController.setUint256(communityId, paramController.VERIFIER_MIN(), paramValue);
        assertEq(paramController.getUint256(communityId, paramController.VERIFIER_MIN()), paramValue);
        
        paramController.setUint256(communityId, paramController.MAX_PANELS_PER_EPOCH(), paramValue);
        assertEq(paramController.getUint256(communityId, paramController.MAX_PANELS_PER_EPOCH()), paramValue);
        
        paramController.setUint256(communityId, paramController.MAX_WEIGHT_PER_VERIFIER(), paramValue);
        assertEq(paramController.getUint256(communityId, paramController.MAX_WEIGHT_PER_VERIFIER()), paramValue);
        
        paramController.setUint256(communityId, paramController.COOLDOWN_AFTER_FRAUD(), paramValue);
        assertEq(paramController.getUint256(communityId, paramController.COOLDOWN_AFTER_FRAUD()), paramValue);
        
        // Test bool parameter
        paramController.setBool(communityId, paramController.USE_VPT_WEIGHTING(), boolValue);
        assertEq(paramController.getBool(communityId, paramController.USE_VPT_WEIGHTING()), boolValue);
        
        vm.stopPrank();
    }
}
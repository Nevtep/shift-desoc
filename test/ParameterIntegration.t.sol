// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {ParamController} from "contracts/modules/ParamController.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract ParameterIntegrationTest is Test {
    CommunityRegistry public registry;
    ParamController public paramController;
    
    address public admin = address(0x1);
    address public user1 = address(0x101);
    
    function setUp() public {
        vm.startPrank(admin);
        paramController = new ParamController(admin);
        registry = new CommunityRegistry(admin, address(paramController));
        vm.stopPrank();
    }
    
    function testUnifiedParameterManagement() public {
        // Register a community
        vm.prank(user1);
        uint256 communityId = registry.registerCommunity(
            "Test Community", 
            "Description", 
            "ipfs://metadata", 
            0
        );
        
        // Set governance parameters via ParamController
        vm.prank(admin);
        paramController.setGovernanceParams(communityId, 10 days, 5 days, 3 days);
        
        // Verify they're accessible through CommunityRegistry
        (uint256 debateWindow, uint256 voteWindow, uint256 executionDelay) = 
            registry.getGovernanceParameters(communityId);
            
        assertEq(debateWindow, 10 days);
        assertEq(voteWindow, 5 days);
        assertEq(executionDelay, 3 days);
        
        // Set eligibility parameters
        vm.prank(admin);
        paramController.setEligibilityParams(communityId, 30 days, 3, 5e18);
        
        (uint256 minSeniority, uint256 minSBTs, uint256 proposalThreshold) = 
            registry.getEligibilityRules(communityId);
            
        assertEq(minSeniority, 30 days);
        assertEq(minSBTs, 3);
        assertEq(proposalThreshold, 5e18);
        
        // Set revenue policy and backing assets
        address[] memory assets = new address[](2);
        assets[0] = address(0x1234);
        assets[1] = address(0x5678);
        
        vm.startPrank(admin);
        paramController.setRevenuePolicy(communityId, 6000, 2500, 0, 0); // 60% treasury min, 25% positions min, spillover to positions
        
        paramController.setUint256(communityId, paramController.FEE_ON_WITHDRAW(), 100);
        
        paramController.setAddressArray(communityId, paramController.BACKING_ASSETS(), assets);
        vm.stopPrank();
        
        (uint256 minTreasuryBps, uint256 minPositionsBps, uint8 spilloverTarget, uint256 splitBps, uint256 feeOnWithdraw, address[] memory backingAssets) = 
            registry.getEconomicParameters(communityId);
            
        assertEq(minTreasuryBps, 6000); // 60% min treasury
        assertEq(minPositionsBps, 2500); // 25% min positions
        assertEq(spilloverTarget, 0); // spillover to positions
        assertEq(splitBps, 0); // no split configured
        assertEq(feeOnWithdraw, 100);
        assertEq(backingAssets.length, 2);
        assertEq(backingAssets[0], address(0x1234));
        assertEq(backingAssets[1], address(0x5678));
    }
    
    function testParameterValidation() public {
        vm.prank(user1);
        uint256 communityId = registry.registerCommunity(
            "Test Community", 
            "Description", 
            "ipfs://metadata", 
            0
        );
        
        // Guarantees cannot exceed 100%
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Guarantees exceed 100%"));
        vm.prank(admin);
        paramController.setRevenuePolicy(communityId, 5000, 6000, 0, 0); // 110%
        
        // Valid lower guarantees
        vm.prank(admin);
        paramController.setRevenuePolicy(communityId, 2000, 4000, 0, 0); // 20% treasury, 40% positions
        
        // Invalid spillover target
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid spillover target"));
        vm.prank(admin);
        paramController.setRevenuePolicy(communityId, 4000, 3000, 3, 0); // Invalid target

        // Invalid split percentage when using split target
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Split bps > 100%"));
        vm.prank(admin);
        paramController.setRevenuePolicy(communityId, 4000, 3000, 2, 20000);
    }
    
    function testCrossParameterConsistency() public {
        // Register multiple communities and verify parameter isolation
        vm.prank(user1);
        uint256 communityId1 = registry.registerCommunity("Community 1", "Desc1", "ipfs://1", 0);
        
        vm.prank(user1);
        uint256 communityId2 = registry.registerCommunity("Community 2", "Desc2", "ipfs://2", 0);
        
        // Set different parameters for each community
        vm.startPrank(admin);
        paramController.setGovernanceParams(communityId1, 7 days, 3 days, 2 days);
        paramController.setGovernanceParams(communityId2, 14 days, 7 days, 5 days);
        
        paramController.setEligibilityParams(communityId1, 0, 1, 1e18);
        paramController.setEligibilityParams(communityId2, 30 days, 5, 10e18);
        vm.stopPrank();
        
        // Verify isolation
        (uint256 debate1, uint256 vote1, uint256 exec1) = registry.getGovernanceParameters(communityId1);
        (uint256 debate2, uint256 vote2, uint256 exec2) = registry.getGovernanceParameters(communityId2);
        
        assertEq(debate1, 7 days);
        assertEq(vote1, 3 days);
        assertEq(exec1, 2 days);
        
        assertEq(debate2, 14 days);
        assertEq(vote2, 7 days);
        assertEq(exec2, 5 days);
        
        (uint256 seniority1, uint256 sbts1, uint256 threshold1) = registry.getEligibilityRules(communityId1);
        (uint256 seniority2, uint256 sbts2, uint256 threshold2) = registry.getEligibilityRules(communityId2);
        
        assertEq(seniority1, 0);
        assertEq(sbts1, 1);
        assertEq(threshold1, 1e18);
        
        assertEq(seniority2, 30 days);
        assertEq(sbts2, 5);
        assertEq(threshold2, 10e18);
    }
    
    function testParameterManagementViaParamController() public {
        vm.prank(user1);
        uint256 communityId = registry.registerCommunity("Test Community", "Desc", "ipfs://metadata", 0);
        
        // Verify that parameter management now happens through ParamController
        vm.prank(admin);
        paramController.setGovernanceParams(communityId, 10 days, 5 days, 2 days);
        
        // Verify parameters are accessible through CommunityRegistry
        (uint256 debateWindow, uint256 voteWindow, uint256 executionDelay) = registry.getGovernanceParameters(communityId);
        assertEq(debateWindow, 10 days);
        assertEq(voteWindow, 5 days);
        assertEq(executionDelay, 2 days);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ValuableActionSBT} from "../contracts/modules/ValuableActionSBT.sol";

contract ValuableActionSBTTest is Test {
    ValuableActionSBT public valuableActionSBT;
    
    address public owner = makeAddr("owner");
    address public manager = makeAddr("manager");  // Claims contract
    address public governance = makeAddr("governance");
    address public worker1 = makeAddr("worker1");
    address public worker2 = makeAddr("worker2");
    address public worker3 = makeAddr("worker3");
    
    function setUp() public {
        valuableActionSBT = new ValuableActionSBT(owner, manager, governance);
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        // Check roles are set correctly
        assertTrue(valuableActionSBT.hasRole(valuableActionSBT.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(valuableActionSBT.hasRole(valuableActionSBT.MANAGER_ROLE(), manager));
        assertTrue(valuableActionSBT.hasRole(valuableActionSBT.GOVERNANCE_ROLE(), governance));
        
        // Check initial state
        assertEq(valuableActionSBT.nextTokenId(), 1);
        assertEq(valuableActionSBT.workerPointsDecayRate(), 950); // DEFAULT_DECAY_RATE
        assertEq(valuableActionSBT.nextAchievementId(), 6); // 5 default achievements + next = 6
    }
    
    function testConstructorZeroAddressReverts() public {
        vm.expectRevert();
        new ValuableActionSBT(address(0), manager, governance);
        
        vm.expectRevert();
        new ValuableActionSBT(owner, address(0), governance);
        
        vm.expectRevert();
        new ValuableActionSBT(owner, manager, address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                          MINTING & POINTS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMintAndAwardPoints() public {
        string memory metadataURI = "ipfs://QmTestURI1";
        uint256 points = 100;
        
        vm.expectEmit(true, true, true, true);
        emit ValuableActionSBT.WorkerPointsAwarded(worker1, points, points);
        
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, points, metadataURI);
        
        // Check SBT was minted
        assertTrue(valuableActionSBT.hasSBT(worker1));
        assertEq(valuableActionSBT.getTokenId(worker1), 1);
        assertEq(valuableActionSBT.getWorker(1), worker1);
        assertEq(valuableActionSBT.ownerOf(1), worker1);
        assertEq(valuableActionSBT.tokenURI(1), metadataURI);
        
        // Check WorkerPoints were awarded
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), points);
        assertEq(valuableActionSBT.lifetimeWorkerPoints(worker1), points);
        assertEq(valuableActionSBT.lastWorkerPointsUpdate(worker1), block.timestamp);
        
        // Check achievements were processed
        assertTrue(valuableActionSBT.hasAchievement(worker1, 1)); // First Contribution (1 point required)
        assertTrue(valuableActionSBT.hasAchievement(worker1, 2)); // Active Contributor (100 points required)
        assertFalse(valuableActionSBT.hasAchievement(worker1, 3)); // Community Builder (500 points required)
    }
    
    function testMintAndAwardPointsOnlyManager() public {
        vm.expectRevert();
        valuableActionSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
    }
    
    function testMintAndAwardPointsZeroAddressReverts() public {
        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintAndAwardPoints(address(0), 100, "ipfs://test");
    }
    
    function testMintAndAwardPointsZeroPointsReverts() public {
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(ValuableActionSBT.InvalidWorkerPointsAmount.selector, 0));
        valuableActionSBT.mintAndAwardPoints(worker1, 0, "ipfs://test");
    }
    
    function testAwardWorkerPointsToExistingSBT() public {
        // First mint SBT
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 100, "ipfs://test1");
        
        // Award additional points
        vm.expectEmit(true, true, true, true);
        emit ValuableActionSBT.WorkerPointsAwarded(worker1, 150, 250);
        
        vm.prank(manager);
        valuableActionSBT.awardWorkerPoints(worker1, 150);
        
        // Check points were added
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), 250);
        assertEq(valuableActionSBT.lifetimeWorkerPoints(worker1), 250);
        
        // Check still only has one token
        assertEq(valuableActionSBT.getTokenId(worker1), 1);
        assertEq(valuableActionSBT.nextTokenId(), 2); // Only one token was minted
    }
    
    function testAwardWorkerPointsToNonExistentSBT() public {
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(ValuableActionSBT.TokenNotExists.selector, 0));
        valuableActionSBT.awardWorkerPoints(worker1, 100);
    }
    
    /*//////////////////////////////////////////////////////////////
                          SOULBOUND TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSoulboundTransferReverts() public {
        // Mint SBT
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        // Try to transfer - should revert
        vm.prank(worker1);
        vm.expectRevert(ValuableActionSBT.Soulbound.selector);
        valuableActionSBT.transferFrom(worker1, worker2, 1);
    }
    
    function testSoulboundApproveReverts() public {
        // Mint SBT
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        // Try to approve - should revert
        vm.prank(worker1);
        vm.expectRevert(ValuableActionSBT.Soulbound.selector);
        valuableActionSBT.approve(worker2, 1);
    }
    
    function testSoulboundSetApprovalForAllReverts() public {
        // Mint SBT
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        // Try to set approval for all - should revert
        vm.prank(worker1);
        vm.expectRevert(ValuableActionSBT.Soulbound.selector);
        valuableActionSBT.setApprovalForAll(worker2, true);
    }
    
    /*//////////////////////////////////////////////////////////////
                          DECAY TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testWorkerPointsDecayOverTime() public {
        // Mint SBT and award points
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 1000, "ipfs://test");
        
        uint256 startTime = block.timestamp;
        
        // Fast forward one decay period (1 week)
        vm.warp(startTime + 7 days);
        
        // Points should have decayed: 1000 * 0.95 = 950
        uint256 expectedPoints = (1000 * 950) / 1000;
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), expectedPoints);
        
        // Apply decay manually to update storage
        valuableActionSBT.applyDecay(worker1);
        assertEq(valuableActionSBT.workerPoints(worker1), expectedPoints);
        
        // Fast forward another decay period (total 2 weeks from start)
        vm.warp(startTime + 14 days);
        
        // Points should decay from 950 over 2 periods iteratively (due to rounding in each step)
        // Step 1: 950 * 950 / 1000 = 902
        // Step 2: 902 * 950 / 1000 = 856  
        uint256 expectedPoints2 = 856;
        uint256 actualPoints = valuableActionSBT.getCurrentWorkerPoints(worker1);
        assertEq(actualPoints, expectedPoints2);
        
        // Lifetime points should remain unchanged
        assertEq(valuableActionSBT.lifetimeWorkerPoints(worker1), 1000);
    }
    
    function testDecayDoesNotAffectNewPoints() public {
        // Mint SBT and award points
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 1000, "ipfs://test");
        
        // Fast forward half a decay period
        vm.warp(block.timestamp + 3.5 days);
        
        // Points should not have decayed yet (less than full period)
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), 1000);
        
        // Award more points - should apply to current balance
        vm.prank(manager);
        valuableActionSBT.awardWorkerPoints(worker1, 500);
        
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), 1500);
        assertEq(valuableActionSBT.lifetimeWorkerPoints(worker1), 1500);
    }
    
    function testSetWorkerPointsDecayRate() public {
        uint256 newDecayRate = 900; // 90% retention
        
        vm.expectEmit(true, true, true, true);
        emit ValuableActionSBT.WorkerPointsDecayUpdated(950, newDecayRate);
        
        vm.prank(governance);
        valuableActionSBT.setWorkerPointsDecayRate(newDecayRate);
        
        assertEq(valuableActionSBT.workerPointsDecayRate(), newDecayRate);
    }
    
    function testSetWorkerPointsDecayRateInvalidRange() public {
        // Too high
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(ValuableActionSBT.WorkerPointsDecayTooHigh.selector, 999, 990));
        valuableActionSBT.setWorkerPointsDecayRate(999);
        
        // Too low  
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(ValuableActionSBT.WorkerPointsDecayTooHigh.selector, 400, 990));
        valuableActionSBT.setWorkerPointsDecayRate(400);
    }
    
    /*//////////////////////////////////////////////////////////////
                         ACHIEVEMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testDefaultAchievements() public {
        // Check that 5 default achievements were created
        assertEq(valuableActionSBT.nextAchievementId(), 6);
        
        // Check first achievement
        (string memory name, string memory description, uint256 required,,bool active) = valuableActionSBT.achievementDefinitions(1);
        assertEq(name, "First Contribution");
        assertEq(required, 1);
        assertTrue(active);
        
        // Check last achievement  
        (name, description, required,, active) = valuableActionSBT.achievementDefinitions(5);
        assertEq(name, "Community Leader");
        assertEq(required, 2500);
        assertTrue(active);
    }
    
    function testAchievementUnlocking() public {
        // Award enough points to unlock multiple achievements  
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 1500, "ipfs://test");
        
        // Should have unlocked achievements 1, 2, 3, 4 (1, 100, 500, 1000 points)
        assertTrue(valuableActionSBT.hasAchievement(worker1, 1));
        assertTrue(valuableActionSBT.hasAchievement(worker1, 2)); 
        assertTrue(valuableActionSBT.hasAchievement(worker1, 3));
        assertTrue(valuableActionSBT.hasAchievement(worker1, 4)); // 1000 points required - should be unlocked with 1500 points
        assertFalse(valuableActionSBT.hasAchievement(worker1, 5)); // 2500 points required
        
        assertEq(valuableActionSBT.achievementCount(worker1), 4);
    }
    
    function testAddCustomAchievement() public {
        string memory name = "Custom Achievement";
        string memory description = "Custom achievement description";
        uint256 pointsRequired = 750;
        string memory metadataURI = "ipfs://custom";
        
        vm.prank(governance);
        valuableActionSBT.addAchievement(name, description, pointsRequired, metadataURI);
        
        // Check achievement was added
        (string memory storedName, string memory storedDesc, uint256 storedPoints, string memory storedURI, bool active) = 
            valuableActionSBT.achievementDefinitions(6);
        assertEq(storedName, name);
        assertEq(storedDesc, description);
        assertEq(storedPoints, pointsRequired);
        assertEq(storedURI, metadataURI);
        assertTrue(active);
        
        // Award points to unlock it
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 800, "ipfs://test");
        
        assertTrue(valuableActionSBT.hasAchievement(worker1, 6));
    }
    
    function testManualAchievementCheck() public {
        // Mint SBT with points below achievement threshold
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 50, "ipfs://test");
        
        // Should only have first achievement
        assertTrue(valuableActionSBT.hasAchievement(worker1, 1));
        assertFalse(valuableActionSBT.hasAchievement(worker1, 2));
        
        // Manually award more points (simulating time passing and points decaying, then new work)
        vm.warp(block.timestamp + 8 days); // Cause decay
        vm.prank(manager);
        valuableActionSBT.awardWorkerPoints(worker1, 80); // Should trigger achievement check
        
        // Should now have both achievements
        assertTrue(valuableActionSBT.hasAchievement(worker1, 1));
        assertTrue(valuableActionSBT.hasAchievement(worker1, 2));
    }
    
    /*//////////////////////////////////////////////////////////////
                         REVOCATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testRevokeSBT() public {
        // Mint SBT
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 500, "ipfs://test");
        
        // Verify initial state
        assertTrue(valuableActionSBT.hasSBT(worker1));
        assertEq(valuableActionSBT.getTokenId(worker1), 1);
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), 500);
        
        string memory reason = "Misconduct";
        
        vm.expectEmit(true, true, true, true);
        emit ValuableActionSBT.TokenRevoked(worker1, 1, reason);
        
        vm.prank(governance);
        valuableActionSBT.revokeSBT(worker1, reason);
        
        // Check SBT was revoked
        assertFalse(valuableActionSBT.hasSBT(worker1));
        assertEq(valuableActionSBT.getTokenId(worker1), 0);
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), 0);
        
        // Lifetime points should still be preserved for historical reference
        assertEq(valuableActionSBT.lifetimeWorkerPoints(worker1), 500);
        
        // Token should no longer exist
        vm.expectRevert();
        valuableActionSBT.ownerOf(1);
    }
    
    function testRevokeSBTOnlyGovernance() public {
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        vm.expectRevert();
        valuableActionSBT.revokeSBT(worker1, "test");
        
        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.revokeSBT(worker1, "test");
    }
    
    function testRevokeSBTNonExistentToken() public {
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(ValuableActionSBT.TokenNotExists.selector, 0));
        valuableActionSBT.revokeSBT(worker1, "test");
    }
    
    /*//////////////////////////////////////////////////////////////
                         VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetWorkerStats() public {
        // Test worker without SBT
        (bool hasToken, uint256 tokenId, uint256 currentPoints, uint256 lifetimePoints, uint256 achievements) = 
            valuableActionSBT.getWorkerStats(worker1);
        assertFalse(hasToken);
        assertEq(tokenId, 0);
        assertEq(currentPoints, 0);
        assertEq(lifetimePoints, 0);
        assertEq(achievements, 0);
        
        // Mint SBT and test again
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 750, "ipfs://test");
        
        (hasToken, tokenId, currentPoints, lifetimePoints, achievements) = valuableActionSBT.getWorkerStats(worker1);
        assertTrue(hasToken);
        assertEq(tokenId, 1);
        assertEq(currentPoints, 750);
        assertEq(lifetimePoints, 750);
        assertEq(achievements, 3); // Should have unlocked 3 achievements (1, 100, 500 points)
    }
    
    function testUpdateTokenURI() public {
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 100, "ipfs://original");
        
        string memory newURI = "ipfs://updated";
        vm.prank(manager);
        valuableActionSBT.updateTokenURI(1, newURI);
        
        assertEq(valuableActionSBT.tokenURI(1), newURI);
    }
    
    function testUpdateTokenURINonExistentToken() public {
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(ValuableActionSBT.TokenNotExists.selector, 1));
        valuableActionSBT.updateTokenURI(1, "ipfs://test");
    }
    
    /*//////////////////////////////////////////////////////////////
                         INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMultipleWorkersSeparateTokens() public {
        // Mint SBTs for multiple workers
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker1, 300, "ipfs://worker1");
        
        vm.prank(manager);  
        valuableActionSBT.mintAndAwardPoints(worker2, 600, "ipfs://worker2");
        
        vm.prank(manager);
        valuableActionSBT.mintAndAwardPoints(worker3, 1200, "ipfs://worker3");
        
        // Check each worker has correct token and points
        assertEq(valuableActionSBT.getTokenId(worker1), 1);
        assertEq(valuableActionSBT.getTokenId(worker2), 2);
        assertEq(valuableActionSBT.getTokenId(worker3), 3);
        
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker1), 300);
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker2), 600);
        assertEq(valuableActionSBT.getCurrentWorkerPoints(worker3), 1200);
        
        // Check achievement counts differ based on points
        assertEq(valuableActionSBT.achievementCount(worker1), 2); // 1, 100 points
        assertEq(valuableActionSBT.achievementCount(worker2), 3); // 1, 100, 500 points
        assertEq(valuableActionSBT.achievementCount(worker3), 4); // 1, 100, 500, 1000 points
    }
}
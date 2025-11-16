// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {WorkerSBT} from "../contracts/modules/WorkerSBT.sol";

contract WorkerSBTTest is Test {
    WorkerSBT public workerSBT;
    
    address public owner = makeAddr("owner");
    address public manager = makeAddr("manager");  // Claims contract
    address public governance = makeAddr("governance");
    address public worker1 = makeAddr("worker1");
    address public worker2 = makeAddr("worker2");
    address public worker3 = makeAddr("worker3");
    
    function setUp() public {
        workerSBT = new WorkerSBT(owner, manager, governance);
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        // Check roles are set correctly
        assertTrue(workerSBT.hasRole(workerSBT.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(workerSBT.hasRole(workerSBT.MANAGER_ROLE(), manager));
        assertTrue(workerSBT.hasRole(workerSBT.GOVERNANCE_ROLE(), governance));
        
        // Check initial state
        assertEq(workerSBT.nextTokenId(), 1);
        assertEq(workerSBT.workerPointsDecayRate(), 950); // DEFAULT_DECAY_RATE
        assertEq(workerSBT.nextAchievementId(), 6); // 5 default achievements + next = 6
    }
    
    function testConstructorZeroAddressReverts() public {
        vm.expectRevert();
        new WorkerSBT(address(0), manager, governance);
        
        vm.expectRevert();
        new WorkerSBT(owner, address(0), governance);
        
        vm.expectRevert();
        new WorkerSBT(owner, manager, address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                          MINTING & POINTS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMintAndAwardPoints() public {
        string memory metadataURI = "ipfs://QmTestURI1";
        uint256 points = 100;
        
        vm.expectEmit(true, true, true, true);
        emit WorkerSBT.WorkerPointsAwarded(worker1, points, points);
        
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, points, metadataURI);
        
        // Check SBT was minted
        assertTrue(workerSBT.hasSBT(worker1));
        assertEq(workerSBT.getTokenId(worker1), 1);
        assertEq(workerSBT.getWorker(1), worker1);
        assertEq(workerSBT.ownerOf(1), worker1);
        assertEq(workerSBT.tokenURI(1), metadataURI);
        
        // Check WorkerPoints were awarded
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), points);
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), points);
        assertEq(workerSBT.lastWorkerPointsUpdate(worker1), block.timestamp);
        
        // Check achievements were processed
        assertTrue(workerSBT.hasAchievement(worker1, 1)); // First Contribution (1 point required)
        assertTrue(workerSBT.hasAchievement(worker1, 2)); // Active Contributor (100 points required)
        assertFalse(workerSBT.hasAchievement(worker1, 3)); // Community Builder (500 points required)
    }
    
    function testMintAndAwardPointsOnlyManager() public {
        vm.expectRevert();
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
    }
    
    function testMintAndAwardPointsZeroAddressReverts() public {
        vm.prank(manager);
        vm.expectRevert();
        workerSBT.mintAndAwardPoints(address(0), 100, "ipfs://test");
    }
    
    function testMintAndAwardPointsZeroPointsReverts() public {
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.InvalidWorkerPointsAmount.selector, 0));
        workerSBT.mintAndAwardPoints(worker1, 0, "ipfs://test");
    }
    
    function testAwardWorkerPointsToExistingSBT() public {
        // First mint SBT
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://test1");
        
        // Award additional points
        vm.expectEmit(true, true, true, true);
        emit WorkerSBT.WorkerPointsAwarded(worker1, 150, 250);
        
        vm.prank(manager);
        workerSBT.awardWorkerPoints(worker1, 150);
        
        // Check points were added
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 250);
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), 250);
        
        // Check still only has one token
        assertEq(workerSBT.getTokenId(worker1), 1);
        assertEq(workerSBT.nextTokenId(), 2); // Only one token was minted
    }
    
    function testAwardWorkerPointsToNonExistentSBT() public {
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.TokenNotExists.selector, 0));
        workerSBT.awardWorkerPoints(worker1, 100);
    }
    
    /*//////////////////////////////////////////////////////////////
                          SOULBOUND TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSoulboundTransferReverts() public {
        // Mint SBT
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        // Try to transfer - should revert
        vm.prank(worker1);
        vm.expectRevert(WorkerSBT.Soulbound.selector);
        workerSBT.transferFrom(worker1, worker2, 1);
    }
    
    function testSoulboundApproveReverts() public {
        // Mint SBT
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        // Try to approve - should revert
        vm.prank(worker1);
        vm.expectRevert(WorkerSBT.Soulbound.selector);
        workerSBT.approve(worker2, 1);
    }
    
    function testSoulboundSetApprovalForAllReverts() public {
        // Mint SBT
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        // Try to set approval for all - should revert
        vm.prank(worker1);
        vm.expectRevert(WorkerSBT.Soulbound.selector);
        workerSBT.setApprovalForAll(worker2, true);
    }
    
    /*//////////////////////////////////////////////////////////////
                          DECAY TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testWorkerPointsDecayOverTime() public {
        // Mint SBT and award points
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1000, "ipfs://test");
        
        uint256 startTime = block.timestamp;
        
        // Fast forward one decay period (1 week)
        vm.warp(startTime + 7 days);
        
        // Points should have decayed: 1000 * 0.95 = 950
        uint256 expectedPoints = (1000 * 950) / 1000;
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), expectedPoints);
        
        // Apply decay manually to update storage
        workerSBT.applyDecay(worker1);
        assertEq(workerSBT.workerPoints(worker1), expectedPoints);
        
        // Fast forward another decay period (total 2 weeks from start)
        vm.warp(startTime + 14 days);
        
        // Points should decay from 950 over 2 periods iteratively (due to rounding in each step)
        // Step 1: 950 * 950 / 1000 = 902
        // Step 2: 902 * 950 / 1000 = 856  
        uint256 expectedPoints2 = 856;
        uint256 actualPoints = workerSBT.getCurrentWorkerPoints(worker1);
        assertEq(actualPoints, expectedPoints2);
        
        // Lifetime points should remain unchanged
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), 1000);
    }
    
    function testDecayDoesNotAffectNewPoints() public {
        // Mint SBT and award points
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1000, "ipfs://test");
        
        // Fast forward half a decay period
        vm.warp(block.timestamp + 3.5 days);
        
        // Points should not have decayed yet (less than full period)
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 1000);
        
        // Award more points - should apply to current balance
        vm.prank(manager);
        workerSBT.awardWorkerPoints(worker1, 500);
        
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 1500);
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), 1500);
    }
    
    function testSetWorkerPointsDecayRate() public {
        uint256 newDecayRate = 900; // 90% retention
        
        vm.expectEmit(true, true, true, true);
        emit WorkerSBT.WorkerPointsDecayUpdated(950, newDecayRate);
        
        vm.prank(governance);
        workerSBT.setWorkerPointsDecayRate(newDecayRate);
        
        assertEq(workerSBT.workerPointsDecayRate(), newDecayRate);
    }
    
    function testSetWorkerPointsDecayRateInvalidRange() public {
        // Too high
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.WorkerPointsDecayTooHigh.selector, 999, 990));
        workerSBT.setWorkerPointsDecayRate(999);
        
        // Too low  
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.WorkerPointsDecayTooHigh.selector, 400, 990));
        workerSBT.setWorkerPointsDecayRate(400);
    }
    
    /*//////////////////////////////////////////////////////////////
                         ACHIEVEMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testDefaultAchievements() public {
        // Check that 5 default achievements were created
        assertEq(workerSBT.nextAchievementId(), 6);
        
        // Check first achievement
        (string memory name, string memory description, uint256 required,,bool active) = workerSBT.achievementDefinitions(1);
        assertEq(name, "First Contribution");
        assertEq(required, 1);
        assertTrue(active);
        
        // Check last achievement  
        (name, description, required,, active) = workerSBT.achievementDefinitions(5);
        assertEq(name, "Community Leader");
        assertEq(required, 2500);
        assertTrue(active);
    }
    
    function testAchievementUnlocking() public {
        // Award enough points to unlock multiple achievements  
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1500, "ipfs://test");
        
        // Should have unlocked achievements 1, 2, 3, 4 (1, 100, 500, 1000 points)
        assertTrue(workerSBT.hasAchievement(worker1, 1));
        assertTrue(workerSBT.hasAchievement(worker1, 2)); 
        assertTrue(workerSBT.hasAchievement(worker1, 3));
        assertTrue(workerSBT.hasAchievement(worker1, 4)); // 1000 points required - should be unlocked with 1500 points
        assertFalse(workerSBT.hasAchievement(worker1, 5)); // 2500 points required
        
        assertEq(workerSBT.achievementCount(worker1), 4);
    }
    
    function testAddCustomAchievement() public {
        string memory name = "Custom Achievement";
        string memory description = "Custom achievement description";
        uint256 pointsRequired = 750;
        string memory metadataURI = "ipfs://custom";
        
        vm.prank(governance);
        workerSBT.addAchievement(name, description, pointsRequired, metadataURI);
        
        // Check achievement was added
        (string memory storedName, string memory storedDesc, uint256 storedPoints, string memory storedURI, bool active) = 
            workerSBT.achievementDefinitions(6);
        assertEq(storedName, name);
        assertEq(storedDesc, description);
        assertEq(storedPoints, pointsRequired);
        assertEq(storedURI, metadataURI);
        assertTrue(active);
        
        // Award points to unlock it
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 800, "ipfs://test");
        
        assertTrue(workerSBT.hasAchievement(worker1, 6));
    }
    
    function testManualAchievementCheck() public {
        // Mint SBT with points below achievement threshold
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 50, "ipfs://test");
        
        // Should only have first achievement
        assertTrue(workerSBT.hasAchievement(worker1, 1));
        assertFalse(workerSBT.hasAchievement(worker1, 2));
        
        // Manually award more points (simulating time passing and points decaying, then new work)
        vm.warp(block.timestamp + 8 days); // Cause decay
        vm.prank(manager);
        workerSBT.awardWorkerPoints(worker1, 80); // Should trigger achievement check
        
        // Should now have both achievements
        assertTrue(workerSBT.hasAchievement(worker1, 1));
        assertTrue(workerSBT.hasAchievement(worker1, 2));
    }
    
    /*//////////////////////////////////////////////////////////////
                         REVOCATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testRevokeSBT() public {
        // Mint SBT
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 500, "ipfs://test");
        
        // Verify initial state
        assertTrue(workerSBT.hasSBT(worker1));
        assertEq(workerSBT.getTokenId(worker1), 1);
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 500);
        
        string memory reason = "Misconduct";
        
        vm.expectEmit(true, true, true, true);
        emit WorkerSBT.TokenRevoked(worker1, 1, reason);
        
        vm.prank(governance);
        workerSBT.revokeSBT(worker1, reason);
        
        // Check SBT was revoked
        assertFalse(workerSBT.hasSBT(worker1));
        assertEq(workerSBT.getTokenId(worker1), 0);
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 0);
        
        // Lifetime points should still be preserved for historical reference
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), 500);
        
        // Token should no longer exist
        vm.expectRevert();
        workerSBT.ownerOf(1);
    }
    
    function testRevokeSBTOnlyGovernance() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://test");
        
        vm.expectRevert();
        workerSBT.revokeSBT(worker1, "test");
        
        vm.prank(manager);
        vm.expectRevert();
        workerSBT.revokeSBT(worker1, "test");
    }
    
    function testRevokeSBTNonExistentToken() public {
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.TokenNotExists.selector, 0));
        workerSBT.revokeSBT(worker1, "test");
    }
    
    /*//////////////////////////////////////////////////////////////
                         VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetWorkerStats() public {
        // Test worker without SBT
        (bool hasToken, uint256 tokenId, uint256 currentPoints, uint256 lifetimePoints, uint256 achievements) = 
            workerSBT.getWorkerStats(worker1);
        assertFalse(hasToken);
        assertEq(tokenId, 0);
        assertEq(currentPoints, 0);
        assertEq(lifetimePoints, 0);
        assertEq(achievements, 0);
        
        // Mint SBT and test again
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 750, "ipfs://test");
        
        (hasToken, tokenId, currentPoints, lifetimePoints, achievements) = workerSBT.getWorkerStats(worker1);
        assertTrue(hasToken);
        assertEq(tokenId, 1);
        assertEq(currentPoints, 750);
        assertEq(lifetimePoints, 750);
        assertEq(achievements, 3); // Should have unlocked 3 achievements (1, 100, 500 points)
    }
    
    function testUpdateTokenURI() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://original");
        
        string memory newURI = "ipfs://updated";
        vm.prank(manager);
        workerSBT.updateTokenURI(1, newURI);
        
        assertEq(workerSBT.tokenURI(1), newURI);
    }
    
    function testUpdateTokenURINonExistentToken() public {
        vm.prank(manager);
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.TokenNotExists.selector, 1));
        workerSBT.updateTokenURI(1, "ipfs://test");
    }
    
    /*//////////////////////////////////////////////////////////////
                         INTEGRATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMultipleWorkersSeparateTokens() public {
        // Mint SBTs for multiple workers
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 300, "ipfs://worker1");
        
        vm.prank(manager);  
        workerSBT.mintAndAwardPoints(worker2, 600, "ipfs://worker2");
        
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker3, 1200, "ipfs://worker3");
        
        // Check each worker has correct token and points
        assertEq(workerSBT.getTokenId(worker1), 1);
        assertEq(workerSBT.getTokenId(worker2), 2);
        assertEq(workerSBT.getTokenId(worker3), 3);
        
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 300);
        assertEq(workerSBT.getCurrentWorkerPoints(worker2), 600);
        assertEq(workerSBT.getCurrentWorkerPoints(worker3), 1200);
        
        // Check achievement counts differ based on points
        assertEq(workerSBT.achievementCount(worker1), 2); // 1, 100 points
        assertEq(workerSBT.achievementCount(worker2), 3); // 1, 100, 500 points
        assertEq(workerSBT.achievementCount(worker3), 4); // 1, 100, 500, 1000 points
    }
}
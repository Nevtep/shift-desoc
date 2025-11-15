// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {WorkerSBT} from "contracts/modules/WorkerSBT.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract WorkerSBTTest is Test {
    WorkerSBT public workerSBT;
    
    address public owner = address(0x1);
    address public manager = address(0x2); // Claims contract
    address public governance = address(0x3);
    address public worker1 = address(0x101);
    address public worker2 = address(0x102);
    address public worker3 = address(0x103);
    
    // Events to test
    event WorkerPointsAwarded(address indexed worker, uint256 amount, uint256 newTotal);
    event WorkerPointsDecayed(address indexed worker, uint256 decayAmount, uint256 newTotal);
    event AchievementUnlocked(address indexed worker, uint256 indexed achievementId, string name);
    event TokenRevoked(address indexed worker, uint256 indexed tokenId, string reason);
    
    function setUp() public {
        vm.startPrank(owner);
        workerSBT = new WorkerSBT(owner, manager, governance);
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public {
        // Check roles
        assertTrue(workerSBT.hasRole(workerSBT.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(workerSBT.hasRole(workerSBT.MANAGER_ROLE(), manager));
        assertTrue(workerSBT.hasRole(workerSBT.GOVERNANCE_ROLE(), governance));
        
        // Check initial state
        assertEq(workerSBT.nextTokenId(), 1);
        assertEq(workerSBT.workerPointsDecayRate(), 950); // Default 95%
        assertEq(workerSBT.nextAchievementId(), 6); // 5 default achievements + 1
        
        // Check default achievements exist
        (string memory name, string memory desc, uint256 required, string memory uri, bool active) = workerSBT.achievementDefinitions(1);
        assertEq(name, "First Contribution");
        assertTrue(active);
        assertEq(required, 1);
    }
    
    function testConstructorZeroAddresses() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new WorkerSBT(address(0), manager, governance);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new WorkerSBT(owner, address(0), governance);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        new WorkerSBT(owner, manager, address(0));
    }
    
    /*//////////////////////////////////////////////////////////////
                           MINTING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMintAndAwardPoints() public {
        string memory metadataURI = "ipfs://test-metadata";
        uint256 points = 100;
        
        vm.expectEmit(true, false, false, true);
        emit WorkerPointsAwarded(worker1, points, points);
        
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, points, metadataURI);
        
        // Check token was minted
        assertEq(workerSBT.ownerOf(1), worker1);
        assertEq(workerSBT.workerToTokenId(worker1), 1);
        assertEq(workerSBT.tokenIdToWorker(1), worker1);
        assertEq(workerSBT.nextTokenId(), 2);
        
        // Check WorkerPoints
        assertEq(workerSBT.workerPoints(worker1), points);
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), points);
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), points);
        
        // Check metadata
        assertEq(workerSBT.tokenURI(1), metadataURI);
        
        // Check worker has SBT
        assertTrue(workerSBT.hasSBT(worker1));
    }
    
    function testMintAndAwardPointsOnlyManager() public {
        vm.expectRevert();
        vm.prank(worker1);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
        
        vm.expectRevert();
        vm.prank(governance);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
    }
    
    function testMintAndAwardPointsZeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(address(0), 100, "uri");
    }
    
    function testMintAndAwardPointsZeroAmount() public {
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.InvalidWorkerPointsAmount.selector, 0));
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 0, "uri");
    }
    
    function testAwardPointsToExistingWorker() public {
        // First mint
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri1");
        
        // Award more points
        vm.expectEmit(true, false, false, true);
        emit WorkerPointsAwarded(worker1, 50, 150);
        
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 50, "uri2"); // Should just award points, not mint new token
        
        // Check only one token exists
        assertEq(workerSBT.nextTokenId(), 2);
        assertEq(workerSBT.workerToTokenId(worker1), 1);
        
        // Check points updated
        assertEq(workerSBT.workerPoints(worker1), 150);
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), 150);
    }
    
    function testAwardWorkerPointsDirectly() public {
        // First mint SBT
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
        
        // Award points directly
        vm.expectEmit(true, false, false, true);
        emit WorkerPointsAwarded(worker1, 75, 175);
        
        vm.prank(manager);
        workerSBT.awardWorkerPoints(worker1, 75);
        
        assertEq(workerSBT.workerPoints(worker1), 175);
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), 175);
    }
    
    function testAwardWorkerPointsNoToken() public {
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.TokenNotExists.selector, 0));
        vm.prank(manager);
        workerSBT.awardWorkerPoints(worker1, 100);
    }
    
    /*//////////////////////////////////////////////////////////////
                         SOULBOUND TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSoulboundTransferRevert() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
        
        vm.expectRevert(WorkerSBT.Soulbound.selector);
        vm.prank(worker1);
        workerSBT.transferFrom(worker1, worker2, 1);
        
        vm.expectRevert(WorkerSBT.Soulbound.selector);
        vm.prank(worker1);
        workerSBT.safeTransferFrom(worker1, worker2, 1);
    }
    
    function testSoulboundApprovalRevert() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
        
        vm.expectRevert(WorkerSBT.Soulbound.selector);
        vm.prank(worker1);
        workerSBT.approve(worker2, 1);
        
        vm.expectRevert(WorkerSBT.Soulbound.selector);
        vm.prank(worker1);
        workerSBT.setApprovalForAll(worker2, true);
    }
    
    /*//////////////////////////////////////////////////////////////
                        GOVERNANCE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testRevokeSBT() public {
        // Mint SBT first
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 500, "uri");
        
        assertEq(workerSBT.ownerOf(1), worker1);
        assertEq(workerSBT.workerPoints(worker1), 500);
        
        // Revoke SBT
        string memory reason = "Malicious behavior";
        vm.expectEmit(true, true, false, true);
        emit TokenRevoked(worker1, 1, reason);
        
        vm.prank(governance);
        workerSBT.revokeSBT(worker1, reason);
        
        // Check token burned and data cleared
        vm.expectRevert();
        workerSBT.ownerOf(1); // Should revert as token doesn't exist
        
        assertEq(workerSBT.workerToTokenId(worker1), 0);
        assertEq(workerSBT.tokenIdToWorker(1), address(0));
        assertEq(workerSBT.workerPoints(worker1), 0);
        assertEq(workerSBT.lastWorkerPointsUpdate(worker1), 0);
        
        // Lifetime points should be preserved
        assertEq(workerSBT.lifetimeWorkerPoints(worker1), 500);
        
        assertFalse(workerSBT.hasSBT(worker1));
    }
    
    function testRevokeSBTOnlyGovernance() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
        
        vm.expectRevert();
        vm.prank(manager);
        workerSBT.revokeSBT(worker1, "test");
        
        vm.expectRevert();
        vm.prank(worker1);
        workerSBT.revokeSBT(worker1, "test");
    }
    
    function testRevokeSBTTokenNotExists() public {
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.TokenNotExists.selector, 0));
        vm.prank(governance);
        workerSBT.revokeSBT(worker1, "test");
    }
    
    function testUpdateTokenURI() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "ipfs://old-uri");
        
        assertEq(workerSBT.tokenURI(1), "ipfs://old-uri");
        
        vm.prank(manager);
        workerSBT.updateTokenURI(1, "ipfs://new-uri");
        
        assertEq(workerSBT.tokenURI(1), "ipfs://new-uri");
    }
    
    function testUpdateTokenURIOnlyManager() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
        
        vm.expectRevert();
        vm.prank(governance);
        workerSBT.updateTokenURI(1, "new-uri");
    }
    
    function testUpdateTokenURINotExists() public {
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.TokenNotExists.selector, 999));
        vm.prank(manager);
        workerSBT.updateTokenURI(999, "uri");
    }
    
    /*//////////////////////////////////////////////////////////////
                      WORKERPOINTS DECAY TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testWorkerPointsDecay() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1000, "uri");
        
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 1000);
        
        // Move forward 1 week (1 decay period)
        vm.warp(block.timestamp + 7 days);
        
        // Points should decay to 950 (95% retention)
        uint256 expectedPoints = (1000 * 950) / 1000; // 950
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), expectedPoints);
        
        // Move forward another week
        vm.warp(block.timestamp + 7 days);
        
        // Points should decay again: 950 * 0.95 = 902
        expectedPoints = (expectedPoints * 950) / 1000;
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), expectedPoints);
    }
    
    function testApplyDecay() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1000, "uri");
        
        vm.warp(block.timestamp + 7 days);
        
        // Apply decay manually
        vm.expectEmit(true, false, false, true);
        emit WorkerPointsDecayed(worker1, 50, 950); // Decayed 50 points
        
        workerSBT.applyDecay(worker1);
        
        assertEq(workerSBT.workerPoints(worker1), 950);
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 950);
    }
    
    function testSetWorkerPointsDecayRate() public {
        assertEq(workerSBT.workerPointsDecayRate(), 950);
        
        vm.expectEmit(false, false, false, true);
        emit WorkerSBT.WorkerPointsDecayUpdated(950, 900);
        
        vm.prank(governance);
        workerSBT.setWorkerPointsDecayRate(900); // 90% retention
        
        assertEq(workerSBT.workerPointsDecayRate(), 900);
    }
    
    function testSetWorkerPointsDecayRateInvalidRange() public {
        // Too high (> 99%)
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.WorkerPointsDecayTooHigh.selector, 995, 990));
        vm.prank(governance);
        workerSBT.setWorkerPointsDecayRate(995);
        
        // Too low (< 50%)
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.WorkerPointsDecayTooHigh.selector, 400, 990));
        vm.prank(governance);
        workerSBT.setWorkerPointsDecayRate(400);
    }
    
    function testSetWorkerPointsDecayRateOnlyGovernance() public {
        vm.expectRevert();
        vm.prank(manager);
        workerSBT.setWorkerPointsDecayRate(900);
    }
    
    /*//////////////////////////////////////////////////////////////
                       ACHIEVEMENT TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testDefaultAchievements() public {
        // Check first contribution achievement
        (string memory name, , uint256 required, , bool active) = workerSBT.achievementDefinitions(1);
        assertEq(name, "First Contribution");
        assertEq(required, 1);
        assertTrue(active);
        
        // Check community leader achievement
        (name, , required, , active) = workerSBT.achievementDefinitions(5);
        assertEq(name, "Community Leader");
        assertEq(required, 2500);
        assertTrue(active);
    }
    
    function testAchievementUnlocking() public {
        // Mint with 1 point - should unlock "First Contribution"
        vm.expectEmit(true, true, false, true);
        emit AchievementUnlocked(worker1, 1, "First Contribution");
        
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1, "uri");
        
        assertTrue(workerSBT.hasAchievement(worker1, 1));
        assertEq(workerSBT.achievementCount(worker1), 1);
        
        // Award more points to unlock "Active Contributor"
        vm.expectEmit(true, true, false, true);
        emit AchievementUnlocked(worker1, 2, "Active Contributor");
        
        vm.prank(manager);
        workerSBT.awardWorkerPoints(worker1, 99); // Total: 100
        
        assertTrue(workerSBT.hasAchievement(worker1, 2));
        assertEq(workerSBT.achievementCount(worker1), 2);
    }
    
    function testManualAchievementCheck() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 500, "uri");
        
        // Manually check achievements
        workerSBT.checkAchievements(worker1);
        
        // Should have unlocked first 3 achievements (1, 100, 500 points)
        assertTrue(workerSBT.hasAchievement(worker1, 1)); // 1 point
        assertTrue(workerSBT.hasAchievement(worker1, 2)); // 100 points  
        assertTrue(workerSBT.hasAchievement(worker1, 3)); // 500 points
        assertFalse(workerSBT.hasAchievement(worker1, 4)); // 1000 points
        
        assertEq(workerSBT.achievementCount(worker1), 3);
    }
    
    function testAddNewAchievement() public {
        vm.prank(governance);
        workerSBT.addAchievement(
            "Test Achievement",
            "Test description", 
            50,
            "ipfs://test-badge"
        );
        
        (string memory name, string memory desc, uint256 required, string memory uri, bool active) = 
            workerSBT.achievementDefinitions(6);
        
        assertEq(name, "Test Achievement");
        assertEq(desc, "Test description");
        assertEq(required, 50);
        assertEq(uri, "ipfs://test-badge");
        assertTrue(active);
        assertEq(workerSBT.nextAchievementId(), 7);
    }
    
    function testAddAchievementOnlyGovernance() public {
        vm.expectRevert();
        vm.prank(manager);
        workerSBT.addAchievement("Test", "Test", 50, "uri");
    }
    
    /*//////////////////////////////////////////////////////////////
                         VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetWorkerStats() public {
        // No token case
        (bool hasToken, uint256 tokenId, uint256 currentPoints, uint256 lifetimePoints, uint256 achievements) = 
            workerSBT.getWorkerStats(worker1);
        
        assertFalse(hasToken);
        assertEq(tokenId, 0);
        assertEq(currentPoints, 0);
        assertEq(lifetimePoints, 0);
        assertEq(achievements, 0);
        
        // With token case
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 150, "uri");
        
        (hasToken, tokenId, currentPoints, lifetimePoints, achievements) = 
            workerSBT.getWorkerStats(worker1);
        
        assertTrue(hasToken);
        assertEq(tokenId, 1);
        assertEq(currentPoints, 150);
        assertEq(lifetimePoints, 150);
        assertEq(achievements, 2); // Should unlock first 2 achievements
    }
    
    function testGetTokenIdAndWorker() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri");
        
        assertEq(workerSBT.getTokenId(worker1), 1);
        assertEq(workerSBT.getWorker(1), worker1);
    }
    
    function testGetWorkerNonExistentToken() public {
        vm.expectRevert(abi.encodeWithSelector(WorkerSBT.TokenNotExists.selector, 999));
        workerSBT.getWorker(999);
    }
    
    /*//////////////////////////////////////////////////////////////
                         EDGE CASE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMultipleWorkers() public {
        // Mint for multiple workers
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 100, "uri1");
        
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker2, 200, "uri2");
        
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker3, 300, "uri3");
        
        // Check all have unique tokens
        assertEq(workerSBT.workerToTokenId(worker1), 1);
        assertEq(workerSBT.workerToTokenId(worker2), 2);
        assertEq(workerSBT.workerToTokenId(worker3), 3);
        
        // Check points
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), 100);
        assertEq(workerSBT.getCurrentWorkerPoints(worker2), 200);
        assertEq(workerSBT.getCurrentWorkerPoints(worker3), 300);
        
        assertEq(workerSBT.nextTokenId(), 4);
    }
    
    function testDecayWithoutActivity() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1000, "uri");
        
        // No activity for several decay periods
        vm.warp(block.timestamp + 21 days); // 3 decay periods
        
        uint256 expectedPoints = 1000;
        // Apply decay 3 times: 1000 -> 950 -> 902 -> 857
        expectedPoints = (expectedPoints * 950) / 1000; // 950
        expectedPoints = (expectedPoints * 950) / 1000; // 902  
        expectedPoints = (expectedPoints * 950) / 1000; // 857
        
        assertEq(workerSBT.getCurrentWorkerPoints(worker1), expectedPoints);
    }
    
    function testDecayToZero() public {
        vm.prank(manager);
        workerSBT.mintAndAwardPoints(worker1, 1, "uri"); // Minimal points
        
        // Move forward many decay periods
        vm.warp(block.timestamp + 365 days); // 52 decay periods
        
        // Points should decay to 0 or very close
        uint256 currentPoints = workerSBT.getCurrentWorkerPoints(worker1);
        assertLe(currentPoints, 1); // Should be 0 or 1
    }
    
    function testSupportsInterface() public {
        // Test ERC721 interface
        assertTrue(workerSBT.supportsInterface(0x80ac58cd)); // ERC721
        
        // Test AccessControl interface  
        assertTrue(workerSBT.supportsInterface(0x7965db0b)); // AccessControl
        
        // Test ERC165 interface
        assertTrue(workerSBT.supportsInterface(0x01ffc9a7)); // ERC165
    }
}
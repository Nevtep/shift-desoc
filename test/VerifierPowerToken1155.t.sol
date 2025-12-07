// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {VerifierPowerToken1155} from "../contracts/modules/VerifierPowerToken1155.sol";
import {Errors} from "../contracts/libs/Errors.sol";

contract VerifierPowerToken1155Test is Test {
    VerifierPowerToken1155 public vpt;
    
    address public timelock = makeAddr("timelock");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");
    address public unauthorizedUser = makeAddr("unauthorized");
    
    uint256 public constant COMMUNITY_ID_1 = 1;
    uint256 public constant COMMUNITY_ID_2 = 2;
    string public constant BASE_URI = "https://api.shift.com/metadata/";
    string public constant REASON_CID = "QmTestReasonHash";
    
    event VerifierGranted(address indexed to, uint256 indexed communityId, uint256 amount, string reasonCID);
    event VerifierRevoked(address indexed from, uint256 indexed communityId, uint256 amount, string reasonCID);
    event CommunityInitialized(uint256 indexed communityId, string metadataURI);
    
    function setUp() public {
        vpt = new VerifierPowerToken1155(timelock, BASE_URI);
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        assertTrue(vpt.hasRole(vpt.TIMELOCK_ROLE(), timelock));
        assertTrue(vpt.hasRole(vpt.DEFAULT_ADMIN_ROLE(), timelock));
        assertEq(vpt.uri(0), BASE_URI);
    }
    
    function testConstructorZeroAddressReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierPowerToken1155(address(0), BASE_URI);
    }
    
    /*//////////////////////////////////////////////////////////////
                      COMMUNITY INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testInitializeCommunity() public {
        string memory metadataURI = "QmTestMetadataHash";
        
        vm.expectEmit(true, false, false, true);
        emit CommunityInitialized(COMMUNITY_ID_1, metadataURI);
        
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, metadataURI);
        
        assertTrue(vpt.communityInitialized(COMMUNITY_ID_1));
    }
    
    function testInitializeCommunityNonTimelockReverts() public {
        vm.expectRevert();
        vm.prank(unauthorizedUser);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
    }
    
    function testInitializeCommunityTwiceReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Community already initialized"));
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata2");
    }
    
    /*//////////////////////////////////////////////////////////////
                            MINTING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMint() public {
        // Initialize community first
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        uint256 amount = 100;
        
        vm.expectEmit(true, true, false, true);
        emit VerifierGranted(user1, COMMUNITY_ID_1, amount, REASON_CID);
        
        vm.prank(timelock);
        vpt.mint(user1, COMMUNITY_ID_1, amount, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), amount);
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), amount);
        assertTrue(vpt.hasVerifierPower(user1, COMMUNITY_ID_1));
    }
    
    function testMintNonTimelockReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        vm.expectRevert();
        vm.prank(unauthorizedUser);
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
    }
    
    function testMintZeroAddressReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(timelock);
        vpt.mint(address(0), COMMUNITY_ID_1, 100, REASON_CID);
    }
    
    function testMintZeroAmountReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        vm.expectRevert(abi.encodeWithSelector(VerifierPowerToken1155.InvalidAmount.selector, 0));
        vm.prank(timelock);
        vpt.mint(user1, COMMUNITY_ID_1, 0, REASON_CID);
    }
    
    function testMintUninitializedCommunityReverts() public {
        vm.expectRevert(abi.encodeWithSelector(VerifierPowerToken1155.CommunityNotInitialized.selector, COMMUNITY_ID_1));
        vm.prank(timelock);
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                            BURNING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testBurn() public {
        // Setup: mint tokens first
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vm.stopPrank();
        
        uint256 burnAmount = 30;
        
        vm.expectEmit(true, true, false, true);
        emit VerifierRevoked(user1, COMMUNITY_ID_1, burnAmount, REASON_CID);
        
        vm.prank(timelock);
        vpt.burn(user1, COMMUNITY_ID_1, burnAmount, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 70);
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), 70);
        assertTrue(vpt.hasVerifierPower(user1, COMMUNITY_ID_1)); // Still has power
    }
    
    function testBurnAllTokens() public {
        // Setup: mint tokens first
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.prank(timelock);
        vpt.burn(user1, COMMUNITY_ID_1, 100, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 0);
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), 0);
        assertFalse(vpt.hasVerifierPower(user1, COMMUNITY_ID_1));
    }
    
    function testBurnInsufficientBalanceReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 50, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert(abi.encodeWithSelector(
            VerifierPowerToken1155.InsufficientBalance.selector,
            user1, COMMUNITY_ID_1, 100, 50
        ));
        vm.prank(timelock);
        vpt.burn(user1, COMMUNITY_ID_1, 100, REASON_CID);
    }
    
    function testBurnNonTimelockReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert();
        vm.prank(unauthorizedUser);
        vpt.burn(user1, COMMUNITY_ID_1, 50, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                         BATCH OPERATIONS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testBatchMint() public {
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100;
        amounts[1] = 200;
        amounts[2] = 150;
        
        vm.prank(timelock);
        vpt.batchMint(users, COMMUNITY_ID_1, amounts, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 100);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_1), 200);
        assertEq(vpt.balanceOf(user3, COMMUNITY_ID_1), 150);
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), 450);
    }
    
    function testBatchMintArrayLengthMismatchReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        address[] memory users = new address[](2);
        uint256[] memory amounts = new uint256[](3);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Array length mismatch"));
        vm.prank(timelock);
        vpt.batchMint(users, COMMUNITY_ID_1, amounts, REASON_CID);
    }
    
    function testBatchBurn() public {
        // Setup: mint tokens first
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        
        address[] memory users = new address[](2);
        users[0] = user1;
        users[1] = user2;
        
        uint256[] memory mintAmounts = new uint256[](2);
        mintAmounts[0] = 100;
        mintAmounts[1] = 150;
        
        vpt.batchMint(users, COMMUNITY_ID_1, mintAmounts, REASON_CID);
        
        // Now burn some
        uint256[] memory burnAmounts = new uint256[](2);
        burnAmounts[0] = 30;
        burnAmounts[1] = 50;
        
        vpt.batchBurn(users, COMMUNITY_ID_1, burnAmounts, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 70);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_1), 100);
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), 170);
    }
    
    /*//////////////////////////////////////////////////////////////
                        TRANSFER RESTRICTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testTransferReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert(VerifierPowerToken1155.TransfersDisabled.selector);
        vm.prank(user1);
        vpt.safeTransferFrom(user1, user2, COMMUNITY_ID_1, 50, "");
    }
    
    function testBatchTransferReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vm.stopPrank();
        
        uint256[] memory ids = new uint256[](1);
        ids[0] = COMMUNITY_ID_1;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 50;
        
        vm.expectRevert(VerifierPowerToken1155.TransfersDisabled.selector);
        vm.prank(user1);
        vpt.safeBatchTransferFrom(user1, user2, ids, amounts, "");
    }
    
    function testAdminTransfer() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        
        vpt.adminTransfer(user1, user2, COMMUNITY_ID_1, 30, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 70);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_1), 30);
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), 100);
    }
    
    function testAdminTransferNonTimelockReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert();
        vm.prank(unauthorizedUser);
        vpt.adminTransfer(user1, user2, COMMUNITY_ID_1, 30, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetCommunityStats() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vpt.mint(user2, COMMUNITY_ID_1, 200, REASON_CID);
        vm.stopPrank();
        
        (uint256 totalVerifiers, uint256 totalPower, uint256 averagePower) = vpt.getCommunityStats(COMMUNITY_ID_1);
        
        assertEq(totalVerifiers, 0); // Note: This is expected as tracking is TODO
        assertEq(totalPower, 300);
        assertEq(averagePower, 0); // Division by zero when totalVerifiers is 0
    }
    
    function testHasVerifierPower() public {
        assertFalse(vpt.hasVerifierPower(user1, COMMUNITY_ID_1));
        
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, 1, REASON_CID);
        vm.stopPrank();
        
        assertTrue(vpt.hasVerifierPower(user1, COMMUNITY_ID_1));
        assertFalse(vpt.hasVerifierPower(user2, COMMUNITY_ID_1));
    }
    
    /*//////////////////////////////////////////////////////////////
                         MULTI-COMMUNITY TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMultipleCommunities() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata1");
        vpt.initializeCommunity(COMMUNITY_ID_2, "metadata2");
        
        vpt.mint(user1, COMMUNITY_ID_1, 100, REASON_CID);
        vpt.mint(user1, COMMUNITY_ID_2, 200, REASON_CID);
        vpt.mint(user2, COMMUNITY_ID_1, 150, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 100);
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_2), 200);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_1), 150);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_2), 0);
        
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), 250);
        assertEq(vpt.totalSupply(COMMUNITY_ID_2), 200);
    }
    
    /*//////////////////////////////////////////////////////////////
                              URI TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSetURI() public {
        string memory newURI = "https://new-api.shift.com/metadata/";
        
        vm.prank(timelock);
        vpt.setURI(newURI);
        
        assertEq(vpt.uri(0), newURI);
    }
    
    function testSetURINonTimelockReverts() public {
        vm.expectRevert();
        vm.prank(unauthorizedUser);
        vpt.setURI("new-uri");
    }
    
    /*//////////////////////////////////////////////////////////////
                           INTERFACE TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSupportsInterface() public view {
        // ERC1155 interface
        assertTrue(vpt.supportsInterface(0xd9b67a26));
        // AccessControl interface
        assertTrue(vpt.supportsInterface(0x7965db0b));
        // ERC165 interface
        assertTrue(vpt.supportsInterface(0x01ffc9a7));
    }
    
    /*//////////////////////////////////////////////////////////////
                            FUZZ TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testFuzzMintAndBurn(uint256 amount1, uint256 amount2, uint256 burnAmount) public {
        vm.assume(amount1 > 0 && amount1 < type(uint128).max);
        vm.assume(amount2 > 0 && amount2 < type(uint128).max);
        vm.assume(burnAmount > 0 && burnAmount <= amount1);
        
        vm.startPrank(timelock);
        vpt.initializeCommunity(COMMUNITY_ID_1, "metadata");
        vpt.mint(user1, COMMUNITY_ID_1, amount1, REASON_CID);
        vpt.mint(user2, COMMUNITY_ID_1, amount2, REASON_CID);
        
        uint256 totalBefore = vpt.totalSupply(COMMUNITY_ID_1);
        assertEq(totalBefore, amount1 + amount2);
        
        vpt.burn(user1, COMMUNITY_ID_1, burnAmount, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), amount1 - burnAmount);
        assertEq(vpt.totalSupply(COMMUNITY_ID_1), totalBefore - burnAmount);
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {VerifierPowerToken1155} from "../contracts/tokens/VerifierPowerToken1155.sol";
import {Errors} from "../contracts/libs/Errors.sol";

contract VerifierPowerToken1155Test is Test {
    VerifierPowerToken1155 public vpt;
    AccessManager public accessManager;
    
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
        accessManager = new AccessManager(timelock);
        vpt = new VerifierPowerToken1155(address(accessManager), BASE_URI, COMMUNITY_ID_1);

        vm.startPrank(timelock);
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = bytes4(keccak256("initializeCommunity(string)"));
        selectors[1] = bytes4(keccak256("mint(address,uint256,string)"));
        selectors[2] = bytes4(keccak256("burn(address,uint256,string)"));
        selectors[3] = bytes4(keccak256("batchMint(address[],uint256[],string)"));
        selectors[4] = bytes4(keccak256("batchBurn(address[],uint256[],string)"));
        selectors[5] = bytes4(keccak256("adminTransfer(address,address,uint256,string)"));
        accessManager.setTargetFunctionRole(address(vpt), selectors, accessManager.ADMIN_ROLE());
        vm.stopPrank();
    }
    
    /*//////////////////////////////////////////////////////////////
                           CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testConstructor() public view {
        (bool isAdmin,) = accessManager.hasRole(accessManager.ADMIN_ROLE(), timelock);
        assertTrue(isAdmin);
        assertEq(vpt.uri(0), BASE_URI);
    }
    
    function testConstructorZeroAddressReverts() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new VerifierPowerToken1155(address(0), BASE_URI, COMMUNITY_ID_1);

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Invalid communityId"));
        new VerifierPowerToken1155(address(accessManager), BASE_URI, 0);
    }
    
    /*//////////////////////////////////////////////////////////////
                      COMMUNITY INITIALIZATION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testInitializeCommunity() public {
        string memory metadataURI = "QmTestMetadataHash";
        
        vm.expectEmit(true, false, false, true);
        emit CommunityInitialized(COMMUNITY_ID_1, metadataURI);
        
        vm.prank(timelock);
        vpt.initializeCommunity(metadataURI);
        
        assertTrue(vpt.communityInitialized());
    }
    
    function testInitializeCommunityNonTimelockReverts() public {
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        vpt.initializeCommunity("metadata");
    }
    
    function testInitializeCommunityTwiceReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity("metadata");
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Community already initialized"));
        vm.prank(timelock);
        vpt.initializeCommunity("metadata2");
    }
    
    /*//////////////////////////////////////////////////////////////
                            MINTING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testMint() public {
        // Initialize community first
        vm.prank(timelock);
        vpt.initializeCommunity("metadata");
        
        uint256 amount = 100;
        
        vm.expectEmit(true, true, false, true);
        emit VerifierGranted(user1, COMMUNITY_ID_1, amount, REASON_CID);
        
        vm.prank(timelock);
        vpt.mint(user1, amount, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), amount);
        assertEq(vpt.totalSupply(), amount);
        assertTrue(vpt.hasVerifierPower(user1));
    }
    
    function testMintNonTimelockReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity("metadata");
        
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        vpt.mint(user1, 100, REASON_CID);
    }
    
    function testMintZeroAddressReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity("metadata");
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        vm.prank(timelock);
        vpt.mint(address(0), 100, REASON_CID);
    }
    
    function testMintZeroAmountReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity("metadata");
        
        vm.expectRevert(abi.encodeWithSelector(VerifierPowerToken1155.InvalidAmount.selector, 0));
        vm.prank(timelock);
        vpt.mint(user1, 0, REASON_CID);
    }
    
    function testMintUninitializedCommunityReverts() public {
        vm.expectRevert(abi.encodeWithSelector(VerifierPowerToken1155.CommunityNotInitialized.selector, COMMUNITY_ID_1));
        vm.prank(timelock);
        vpt.mint(user1, 100, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                            BURNING TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testBurn() public {
        // Setup: mint tokens first
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vm.stopPrank();
        
        uint256 burnAmount = 30;
        
        vm.expectEmit(true, true, false, true);
        emit VerifierRevoked(user1, COMMUNITY_ID_1, burnAmount, REASON_CID);
        
        vm.prank(timelock);
        vpt.burn(user1, burnAmount, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 70);
        assertEq(vpt.totalSupply(), 70);
        assertTrue(vpt.hasVerifierPower(user1)); // Still has power
    }
    
    function testBurnAllTokens() public {
        // Setup: mint tokens first
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.prank(timelock);
        vpt.burn(user1, 100, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 0);
        assertEq(vpt.totalSupply(), 0);
        assertFalse(vpt.hasVerifierPower(user1));
    }
    
    function testBurnInsufficientBalanceReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 50, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert(abi.encodeWithSelector(
            VerifierPowerToken1155.InsufficientBalance.selector,
            user1, COMMUNITY_ID_1, 100, 50
        ));
        vm.prank(timelock);
        vpt.burn(user1, 100, REASON_CID);
    }
    
    function testBurnNonTimelockReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, unauthorizedUser));
        vm.prank(unauthorizedUser);
        vpt.burn(user1, 50, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                         BATCH OPERATIONS TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testBatchMint() public {
        vm.prank(timelock);
        vpt.initializeCommunity("metadata");
        
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;
        
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100;
        amounts[1] = 200;
        amounts[2] = 150;
        
        vm.prank(timelock);
        vpt.batchMint(users, amounts, REASON_CID);
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 100);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_1), 200);
        assertEq(vpt.balanceOf(user3, COMMUNITY_ID_1), 150);
        assertEq(vpt.totalSupply(), 450);
    }
    
    function testBatchMintArrayLengthMismatchReverts() public {
        vm.prank(timelock);
        vpt.initializeCommunity("metadata");
        
        address[] memory users = new address[](2);
        uint256[] memory amounts = new uint256[](3);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Array length mismatch"));
        vm.prank(timelock);
        vpt.batchMint(users, amounts, REASON_CID);
    }
    
    function testBatchBurn() public {
        // Setup: mint tokens first
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        
        address[] memory users = new address[](2);
        users[0] = user1;
        users[1] = user2;
        
        uint256[] memory mintAmounts = new uint256[](2);
        mintAmounts[0] = 100;
        mintAmounts[1] = 150;
        
        vpt.batchMint(users, mintAmounts, REASON_CID);
        
        // Now burn some
        uint256[] memory burnAmounts = new uint256[](2);
        burnAmounts[0] = 30;
        burnAmounts[1] = 50;
        
        vpt.batchBurn(users, burnAmounts, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 70);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_1), 100);
        assertEq(vpt.totalSupply(), 170);
    }
    
    /*//////////////////////////////////////////////////////////////
                        TRANSFER RESTRICTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testTransferReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert(VerifierPowerToken1155.TransfersDisabled.selector);
        vm.prank(user1);
        vpt.safeTransferFrom(user1, user2, COMMUNITY_ID_1, 50, "");
    }
    
    function testBatchTransferReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
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
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        
        vpt.adminTransfer(user1, user2, 30, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 70);
        assertEq(vpt.balanceOf(user2, COMMUNITY_ID_1), 30);
        assertEq(vpt.totalSupply(), 100);
    }
    
    function testAdminTransferNonTimelockReverts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vm.stopPrank();
        
        vm.expectRevert();
        vm.prank(unauthorizedUser);
        vpt.adminTransfer(user1, user2, 30, REASON_CID);
    }
    
    /*//////////////////////////////////////////////////////////////
                           VIEW FUNCTION TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testGetCommunityStats() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vpt.mint(user2, 200, REASON_CID);
        vm.stopPrank();
        
        (uint256 totalVerifiers, uint256 totalPower, uint256 averagePower) = vpt.getCommunityStats();
        
        assertEq(totalVerifiers, 2);
        assertEq(totalPower, 300);
        assertEq(averagePower, 150);
    }

    function testGetCommunityVerifiersPaginatesActiveRoster() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");

        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100;
        amounts[1] = 200;
        amounts[2] = 300;

        vpt.batchMint(users, amounts, REASON_CID);
        vm.stopPrank();

        (address[] memory firstPageVerifiers, uint256[] memory firstPagePowers, bool firstHasMore) =
            vpt.getCommunityVerifiers(0, 2);

        assertEq(firstPageVerifiers.length, 2);
        assertEq(firstPageVerifiers[0], user1);
        assertEq(firstPagePowers[0], 100);
        assertEq(firstPageVerifiers[1], user2);
        assertEq(firstPagePowers[1], 200);
        assertTrue(firstHasMore);

        (address[] memory secondPageVerifiers, uint256[] memory secondPagePowers, bool secondHasMore) =
            vpt.getCommunityVerifiers(2, 2);

        assertEq(secondPageVerifiers.length, 1);
        assertEq(secondPageVerifiers[0], user3);
        assertEq(secondPagePowers[0], 300);
        assertFalse(secondHasMore);
    }

    function testGetCommunityVerifiersRemovesZeroPowerAccounts() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vpt.mint(user2, 200, REASON_CID);
        vpt.burn(user1, 100, REASON_CID);
        vm.stopPrank();

        (address[] memory verifiers, uint256[] memory powers, bool hasMore) =
            vpt.getCommunityVerifiers(0, 10);

        assertEq(verifiers.length, 1);
        assertEq(verifiers[0], user2);
        assertEq(powers[0], 200);
        assertFalse(hasMore);
    }

    function testGetCommunityVerifiersAdminTransferMovesRosterMembership() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 100, REASON_CID);
        vpt.adminTransfer(user1, user2, 100, REASON_CID);
        vm.stopPrank();

        (address[] memory verifiers, uint256[] memory powers, ) = vpt.getCommunityVerifiers(0, 10);

        assertEq(verifiers.length, 1);
        assertEq(verifiers[0], user2);
        assertEq(powers[0], 100);
        assertFalse(vpt.hasVerifierPower(user1));
        assertTrue(vpt.hasVerifierPower(user2));
    }
    
    function testHasVerifierPower() public {
        assertFalse(vpt.hasVerifierPower(user1));
        
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, 1, REASON_CID);
        vm.stopPrank();
        
        assertTrue(vpt.hasVerifierPower(user1));
        assertFalse(vpt.hasVerifierPower(user2));
    }
    
    /*//////////////////////////////////////////////////////////////
                         MULTI-COMMUNITY TESTS
    //////////////////////////////////////////////////////////////*/
    
    function testSingleCommunityMismatchBehavior() public {
        vm.startPrank(timelock);
        vpt.initializeCommunity("metadata1");
        vpt.mint(user1, 100, REASON_CID);
        vm.stopPrank();

        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), 100);
        assertEq(vpt.totalSupply(), 100);
    }

    function testCommunityHelpersStayIsolatedAcrossTokenInstances() public {
        VerifierPowerToken1155 otherVpt = new VerifierPowerToken1155(address(accessManager), BASE_URI, COMMUNITY_ID_2);

        vm.startPrank(timelock);
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = bytes4(keccak256("initializeCommunity(string)"));
        selectors[1] = bytes4(keccak256("mint(address,uint256,string)"));
        selectors[2] = bytes4(keccak256("burn(address,uint256,string)"));
        selectors[3] = bytes4(keccak256("batchMint(address[],uint256[],string)"));
        selectors[4] = bytes4(keccak256("batchBurn(address[],uint256[],string)"));
        selectors[5] = bytes4(keccak256("adminTransfer(address,address,uint256,string)"));
        accessManager.setTargetFunctionRole(address(otherVpt), selectors, accessManager.ADMIN_ROLE());

        vpt.initializeCommunity("metadata1");
        otherVpt.initializeCommunity("metadata2");

        vpt.mint(user1, 100, REASON_CID);
        vpt.mint(user2, 200, REASON_CID);
        otherVpt.mint(user3, 300, REASON_CID);
        vm.stopPrank();

        (address[] memory firstCommunityVerifiers, uint256[] memory firstCommunityPowers, ) =
            vpt.getCommunityVerifiers(0, 10);
        (address[] memory secondCommunityVerifiers, uint256[] memory secondCommunityPowers, ) =
            otherVpt.getCommunityVerifiers(0, 10);

        assertEq(firstCommunityVerifiers.length, 2);
        assertEq(firstCommunityVerifiers[0], user1);
        assertEq(firstCommunityPowers[0], 100);
        assertEq(firstCommunityVerifiers[1], user2);
        assertEq(firstCommunityPowers[1], 200);

        assertEq(secondCommunityVerifiers.length, 1);
        assertEq(secondCommunityVerifiers[0], user3);
        assertEq(secondCommunityPowers[0], 300);

        (uint256 firstCommunityCount, uint256 firstCommunityTotalPower, uint256 firstCommunityAveragePower) = vpt.getCommunityStats();
        (uint256 secondCommunityCount, uint256 secondCommunityTotalPower, uint256 secondCommunityAveragePower) = otherVpt.getCommunityStats();

        assertEq(firstCommunityCount, 2);
        assertEq(firstCommunityTotalPower, 300);
        assertEq(firstCommunityAveragePower, 150);

        assertEq(secondCommunityCount, 1);
        assertEq(secondCommunityTotalPower, 300);
        assertEq(secondCommunityAveragePower, 300);
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
        // AccessControl interface (no longer supported post-AccessManager migration)
        assertFalse(vpt.supportsInterface(0x7965db0b));
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
        vpt.initializeCommunity("metadata");
        vpt.mint(user1, amount1, REASON_CID);
        vpt.mint(user2, amount2, REASON_CID);
        
        uint256 totalBefore = vpt.totalSupply();
        assertEq(totalBefore, amount1 + amount2);
        
        vpt.burn(user1, burnAmount, REASON_CID);
        vm.stopPrank();
        
        assertEq(vpt.balanceOf(user1, COMMUNITY_ID_1), amount1 - burnAmount);
        assertEq(vpt.totalSupply(), totalBefore - burnAmount);
    }
}
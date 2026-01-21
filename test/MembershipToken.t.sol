// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {Roles} from "contracts/libs/Roles.sol";

contract MembershipTokenTest is Test {
    MembershipTokenERC20Votes token;
    AccessManager accessManager;
    
    address admin = makeAddr("admin");
    address founder = makeAddr("founder");
    address claimsContract = makeAddr("claims");
    address communityFactory = makeAddr("factory");
    address worker1 = makeAddr("worker1");
    address worker2 = makeAddr("worker2");
    address governance = makeAddr("governance");
    
    uint256 constant COMMUNITY_ID = 1;
    string constant TOKEN_NAME = "Test Community Membership";
    string constant TOKEN_SYMBOL = "MEMBER-1";

    function setUp() public {
        accessManager = new AccessManager(admin);
        vm.startPrank(admin, admin);
        // Deploy MembershipToken
        token = new MembershipTokenERC20Votes(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            COMMUNITY_ID,
            address(accessManager)
        );

        bytes4[] memory minterSelectors = new bytes4[](2);
        minterSelectors[0] = token.mint.selector;
        minterSelectors[1] = token.batchMint.selector;
        accessManager.setTargetFunctionRole(address(token), minterSelectors, token.MINTER_ROLE());
        vm.stopPrank();
    }

    function _grantMinter(address minter) internal {
        vm.startPrank(admin, admin);
        accessManager.grantRole(token.MINTER_ROLE(), minter, 0);
        vm.stopPrank();
    }

    function test_Constructor() public view {
        assertEq(token.name(), TOKEN_NAME);
        assertEq(token.symbol(), TOKEN_SYMBOL);
        assertEq(token.communityId(), COMMUNITY_ID);
        assertEq(token.totalSupply(), 0); // No initial minting
        (bool isAdmin,) = accessManager.hasRole(accessManager.ADMIN_ROLE(), admin);
        assertTrue(isAdmin);
    }

    function test_Constructor_ZeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new MembershipTokenERC20Votes(TOKEN_NAME, TOKEN_SYMBOL, COMMUNITY_ID, address(0));
    }

    function test_Constructor_ZeroCommunityId() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Community ID cannot be zero"));
        new MembershipTokenERC20Votes(TOKEN_NAME, TOKEN_SYMBOL, 0, admin);
    }

    function test_Mint() public {
        _grantMinter(claimsContract);

        vm.startPrank(claimsContract, claimsContract);
        
        uint256 mintAmount = 1000 ether;
        string memory reason = "ValuableAction completion";
        
        vm.expectEmit(true, true, false, true);
        emit MembershipTokenERC20Votes.MembershipTokenMinted(worker1, mintAmount, claimsContract, reason);
        
        token.mint(worker1, mintAmount, reason);
        
        assertEq(token.balanceOf(worker1), mintAmount);
        assertEq(token.totalSupply(), mintAmount);
        
        vm.stopPrank();
    }

    function test_Mint_OnlyMinter() public {
        
        vm.startPrank(worker1, worker1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, worker1));
        token.mint(worker1, 1000 ether, "test");
        
        vm.stopPrank();
    }

    function test_Mint_ZeroAddress() public {
        _grantMinter(claimsContract);
        
        vm.startPrank(claimsContract, claimsContract);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        token.mint(address(0), 1000 ether, "test");
        
        vm.stopPrank();
    }

    function test_Mint_ZeroAmount() public {
        _grantMinter(claimsContract);
        
        vm.startPrank(claimsContract, claimsContract);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Amount cannot be zero"));
        token.mint(worker1, 0, "test");
        
        vm.stopPrank();
    }

    function test_Mint_MaxSupplyCap() public {
        _grantMinter(claimsContract);
        
        vm.startPrank(claimsContract, claimsContract);
        
        // Mint up to max supply
        token.mint(worker1, token.MAX_SUPPLY(), "test");
        
        // Try to mint one more token
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Would exceed max supply"));
        token.mint(worker2, 1, "test");
        
        vm.stopPrank();
    }

    function test_BatchMint() public {
        _grantMinter(communityFactory);
        
        vm.startPrank(communityFactory, communityFactory);
        
        address[] memory recipients = new address[](2);
        recipients[0] = worker1;
        recipients[1] = worker2;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 1000 ether;
        amounts[1] = 500 ether;
        
        string memory reason = "Founder bootstrap";
        
        token.batchMint(recipients, amounts, reason);
        
        assertEq(token.balanceOf(worker1), 1000 ether);
        assertEq(token.balanceOf(worker2), 500 ether);
        assertEq(token.totalSupply(), 1500 ether);
        
        vm.stopPrank();
    }

    function test_BatchMint_ArrayLengthMismatch() public {
        _grantMinter(communityFactory);

        vm.startPrank(communityFactory, communityFactory);
        
        address[] memory recipients = new address[](2);
        recipients[0] = worker1;
        recipients[1] = worker2;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1000 ether;
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Array length mismatch"));
        token.batchMint(recipients, amounts, "test");
        
        vm.stopPrank();
    }

    function test_BatchMint_EmptyArrays() public {
        _grantMinter(communityFactory);
        
        vm.startPrank(communityFactory, communityFactory);
        
        address[] memory recipients = new address[](0);
        uint256[] memory amounts = new uint256[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Empty arrays"));
        token.batchMint(recipients, amounts, "test");
        
        vm.stopPrank();
    }

    function test_GrantMinterRole() public {
        vm.startPrank(admin, admin);
        accessManager.grantRole(token.MINTER_ROLE(), governance, 0);
        (bool isMinter,) = accessManager.hasRole(token.MINTER_ROLE(), governance);
        assertTrue(isMinter);
        vm.stopPrank();
    }

    function test_RevokeMinterRole() public {
        vm.startPrank(admin, admin);
        accessManager.grantRole(token.MINTER_ROLE(), governance, 0);
        accessManager.revokeRole(token.MINTER_ROLE(), governance);
        (bool stillMinter,) = accessManager.hasRole(token.MINTER_ROLE(), governance);
        assertFalse(stillMinter);
        vm.stopPrank();
    }

    function test_EmergencyBurn() public {
        _grantMinter(claimsContract);
        
        // Mint some tokens first
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        vm.startPrank(admin, admin);
        
        token.emergencyBurn(worker1, 500 ether);
        
        assertEq(token.balanceOf(worker1), 500 ether);
        assertEq(token.totalSupply(), 500 ether);
        
        vm.stopPrank();
    }

    function test_EmergencyBurn_OnlyGovernance() public {
        _grantMinter(claimsContract);
        
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        vm.startPrank(worker1, worker1);
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, worker1));
        token.emergencyBurn(worker1, 500 ether);
        
        vm.stopPrank();
    }

    function test_ViewFunctions() public {
        _grantMinter(claimsContract);
        
        // Test remainingSupply
        assertEq(token.remainingSupply(), token.MAX_SUPPLY());
        
        // Mint some tokens
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        assertEq(token.remainingSupply(), token.MAX_SUPPLY() - 1000 ether);
    }

    function test_VotingFunctionality() public {
        _grantMinter(claimsContract);
        
        // Mint tokens to worker
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        // Self-delegate to activate voting power
        vm.prank(worker1);
        token.delegate(worker1);
        
        // Check voting power (should equal balance after delegation)
        assertEq(token.getVotes(worker1), 1000 ether);
        
        // Test delegation to another user
        vm.startPrank(worker1, worker1);
        token.delegate(worker2);
        vm.stopPrank();
        
        // Voting power should transfer to delegate
        assertEq(token.getVotes(worker1), 0);
        assertEq(token.getVotes(worker2), 1000 ether);
    }

    function test_Constants() public view {
        assertEq(token.MAX_SUPPLY(), 100_000_000 ether);
        assertEq(token.MINTER_ROLE(), Roles.MEMBERSHIP_TOKEN_MINTER_ROLE);
        assertEq(token.GOVERNANCE_ROLE(), Roles.MEMBERSHIP_TOKEN_GOVERNANCE_ROLE);
    }
}
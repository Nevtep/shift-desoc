// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {Errors} from "contracts/libs/Errors.sol";

contract MembershipTokenTest is Test {
    MembershipTokenERC20Votes token;
    
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
        vm.startPrank(admin);
        
        // Deploy MembershipToken
        token = new MembershipTokenERC20Votes(
            TOKEN_NAME,
            TOKEN_SYMBOL,
            COMMUNITY_ID,
            admin
        );
        
        vm.stopPrank();
    }

    function test_Constructor() public view {
        assertEq(token.name(), TOKEN_NAME);
        assertEq(token.symbol(), TOKEN_SYMBOL);
        assertEq(token.communityId(), COMMUNITY_ID);
        assertEq(token.totalSupply(), 0); // No initial minting
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(token.GOVERNANCE_ROLE(), admin));
        assertFalse(token.initialized());
    }

    function test_Constructor_ZeroAddress() public {
        vm.expectRevert(Errors.ZeroAddress.selector);
        new MembershipTokenERC20Votes(TOKEN_NAME, TOKEN_SYMBOL, COMMUNITY_ID, address(0));
    }

    function test_Constructor_ZeroCommunityId() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Community ID cannot be zero"));
        new MembershipTokenERC20Votes(TOKEN_NAME, TOKEN_SYMBOL, 0, admin);
    }

    function test_Initialize() public {
        vm.startPrank(admin);
        
        token.initialize(claimsContract, communityFactory);
        
        assertTrue(token.initialized());
        assertTrue(token.hasRole(token.MINTER_ROLE(), claimsContract));
        assertTrue(token.hasRole(token.MINTER_ROLE(), communityFactory));
        
        vm.stopPrank();
    }

    function test_Initialize_OnlyAdmin() public {
        vm.startPrank(founder);
        
        vm.expectRevert();
        token.initialize(claimsContract, communityFactory);
        
        vm.stopPrank();
    }

    function test_Initialize_ZeroAddress() public {
        vm.startPrank(admin);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        token.initialize(address(0), communityFactory);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        token.initialize(claimsContract, address(0));
        
        vm.stopPrank();
    }

    function test_Initialize_AlreadyInitialized() public {
        vm.startPrank(admin);
        
        token.initialize(claimsContract, communityFactory);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Already initialized"));
        token.initialize(claimsContract, communityFactory);
        
        vm.stopPrank();
    }

    function test_Mint() public {
        // Initialize first
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(claimsContract);
        
        uint256 mintAmount = 1000 ether;
        string memory reason = "ValuableAction completion";
        
        vm.expectEmit(true, true, false, true);
        emit MembershipTokenERC20Votes.TokensMintedForWork(worker1, mintAmount, claimsContract, reason);
        
        token.mint(worker1, mintAmount, reason);
        
        assertEq(token.balanceOf(worker1), mintAmount);
        assertEq(token.totalSupply(), mintAmount);
        
        vm.stopPrank();
    }

    function test_Mint_OnlyMinter() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(worker1);
        
        vm.expectRevert();
        token.mint(worker1, 1000 ether, "test");
        
        vm.stopPrank();
    }

    function test_Mint_ZeroAddress() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(claimsContract);
        
        vm.expectRevert(Errors.ZeroAddress.selector);
        token.mint(address(0), 1000 ether, "test");
        
        vm.stopPrank();
    }

    function test_Mint_ZeroAmount() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(claimsContract);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Amount cannot be zero"));
        token.mint(worker1, 0, "test");
        
        vm.stopPrank();
    }

    function test_Mint_MaxSupplyCap() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(claimsContract);
        
        // Mint up to max supply
        token.mint(worker1, token.MAX_SUPPLY(), "test");
        
        // Try to mint one more token
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Would exceed max supply"));
        token.mint(worker2, 1, "test");
        
        vm.stopPrank();
    }

    function test_BatchMint() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(communityFactory);
        
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
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(communityFactory);
        
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
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.startPrank(communityFactory);
        
        address[] memory recipients = new address[](0);
        uint256[] memory amounts = new uint256[](0);
        
        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Empty arrays"));
        token.batchMint(recipients, amounts, "test");
        
        vm.stopPrank();
    }

    function test_GrantMinterRole() public {
        vm.startPrank(admin);
        
        token.initialize(claimsContract, communityFactory);
        
        vm.expectEmit(true, false, false, true);
        emit MembershipTokenERC20Votes.MinterRoleUpdated(governance, true, admin);
        
        token.grantMinterRole(governance);
        
        assertTrue(token.hasRole(token.MINTER_ROLE(), governance));
        
        vm.stopPrank();
    }

    function test_RevokeMinterRole() public {
        vm.startPrank(admin);
        
        token.initialize(claimsContract, communityFactory);
        token.grantMinterRole(governance);
        
        vm.expectEmit(true, false, false, true);
        emit MembershipTokenERC20Votes.MinterRoleUpdated(governance, false, admin);
        
        token.revokeMinterRole(governance);
        
        assertFalse(token.hasRole(token.MINTER_ROLE(), governance));
        
        vm.stopPrank();
    }

    function test_EmergencyBurn() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        // Mint some tokens first
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        vm.startPrank(admin);
        
        token.emergencyBurn(worker1, 500 ether);
        
        assertEq(token.balanceOf(worker1), 500 ether);
        assertEq(token.totalSupply(), 500 ether);
        
        vm.stopPrank();
    }

    function test_EmergencyBurn_OnlyGovernance() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        vm.startPrank(worker1);
        
        vm.expectRevert();
        token.emergencyBurn(worker1, 500 ether);
        
        vm.stopPrank();
    }

    function test_ViewFunctions() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        // Test remainingSupply
        assertEq(token.remainingSupply(), token.MAX_SUPPLY());
        
        // Mint some tokens
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        assertEq(token.remainingSupply(), token.MAX_SUPPLY() - 1000 ether);
        
        // Test isMinter
        assertTrue(token.isMinter(claimsContract));
        assertFalse(token.isMinter(worker1));
        
        // Test getMinters
        address[] memory minters = token.getMinters();
        assertEq(minters.length, 2);
        assertEq(minters[0], claimsContract);
        assertEq(minters[1], communityFactory);
    }

    function test_VotingFunctionality() public {
        vm.prank(admin);
        token.initialize(claimsContract, communityFactory);
        
        // Mint tokens to worker
        vm.prank(claimsContract);
        token.mint(worker1, 1000 ether, "test");
        
        // Self-delegate to activate voting power
        vm.prank(worker1);
        token.delegate(worker1);
        
        // Check voting power (should equal balance after delegation)
        assertEq(token.getVotes(worker1), 1000 ether);
        
        // Test delegation to another user
        vm.startPrank(worker1);
        token.delegate(worker2);
        vm.stopPrank();
        
        // Voting power should transfer to delegate
        assertEq(token.getVotes(worker1), 0);
        assertEq(token.getVotes(worker2), 1000 ether);
    }

    function test_Constants() public view {
        assertEq(token.MAX_SUPPLY(), 100_000_000 ether);
        assertEq(token.MINTER_ROLE(), keccak256("MINTER_ROLE"));
        assertEq(token.GOVERNANCE_ROLE(), keccak256("GOVERNANCE_ROLE"));
    }
}
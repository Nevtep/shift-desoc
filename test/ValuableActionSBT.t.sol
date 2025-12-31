// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Types} from "../contracts/libs/Types.sol";
import {ValuableActionSBT} from "../contracts/modules/ValuableActionSBT.sol";

contract ValuableActionSBTTest is Test {
    ValuableActionSBT public valuableActionSBT;

    address public owner = makeAddr("owner");
    address public manager = makeAddr("manager");
    address public governance = makeAddr("governance");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        valuableActionSBT = new ValuableActionSBT(owner, manager, governance);
    }

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    function testConstructorSetsRolesAndCounters() public view {
        assertTrue(valuableActionSBT.hasRole(valuableActionSBT.DEFAULT_ADMIN_ROLE(), owner));
        assertTrue(valuableActionSBT.hasRole(valuableActionSBT.MANAGER_ROLE(), manager));
        assertTrue(valuableActionSBT.hasRole(valuableActionSBT.GOVERNANCE_ROLE(), governance));
        assertEq(valuableActionSBT.nextTokenId(), 1);
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
                           MINT ENGAGEMENT
    //////////////////////////////////////////////////////////////*/
    function testMintEngagementWorkSubtype() public {
        bytes memory metadata = bytes("{engagement:1}");

        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintEngagement(
            alice,
            1,
            Types.EngagementSubtype.WORK,
            bytes32("ACTION1"),
            metadata
        );

        assertEq(tokenId, 1);
        ValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.WORK));
        assertEq(data.communityId, 1);
        assertEq(data.actionTypeId, bytes32("ACTION1"));
        assertEq(data.roleTypeId, bytes32(0));
        assertEq(data.cohortId, bytes32(0));
        assertEq(data.points, 0);
        assertEq(data.weight, 0);
        assertEq(data.endedAt, 0);
        assertEq(data.verifier, address(0));
        assertEq(valuableActionSBT.ownerOf(tokenId), alice);
    }

    function testMintEngagementRoleStoresRoleType() public {
        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintEngagement(
            alice,
            2,
            Types.EngagementSubtype.ROLE,
            bytes32("ROLE-ADMIN"),
            ""
        );

        ValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.ROLE));
        assertEq(data.actionTypeId, bytes32(0));
        assertEq(data.roleTypeId, bytes32("ROLE-ADMIN"));
    }

    function testMintEngagementInvalidInputsRevert() public {
        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintEngagement(address(0), 1, Types.EngagementSubtype.WORK, bytes32("A"), "");

        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintEngagement(alice, 0, Types.EngagementSubtype.WORK, bytes32("A"), "");

        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintEngagement(alice, 1, Types.EngagementSubtype.WORK, bytes32(0), "");
    }

    /*//////////////////////////////////////////////////////////////
                             MINT POSITION
    //////////////////////////////////////////////////////////////*/
    function testMintPositionStoresData() public {
        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintPosition(alice, 3, bytes32("POSITION"), 50, bytes("meta"));

        ValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.POSITION));
        assertEq(data.communityId, 3);
        assertEq(data.roleTypeId, bytes32("POSITION"));
        assertEq(data.points, 50);
    }

    function testMintPositionInvalidInputsRevert() public {
        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintPosition(alice, 0, bytes32("POSITION"), 1, "");

        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintPosition(alice, 1, bytes32(0), 1, "");
    }

    /*//////////////////////////////////////////////////////////////
                           MINT INVESTMENT
    //////////////////////////////////////////////////////////////*/
    function testMintInvestmentStoresData() public {
        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintInvestment(bob, 4, bytes32("COHORT"), 100, bytes("invest"));

        ValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.INVESTMENT));
        assertEq(data.communityId, 4);
        assertEq(data.cohortId, bytes32("COHORT"));
        assertEq(data.weight, 100);
    }

    function testMintInvestmentInvalidInputsRevert() public {
        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintInvestment(bob, 0, bytes32("COHORT"), 1, "");

        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintInvestment(bob, 1, bytes32(0), 1, "");
    }

    /*//////////////////////////////////////////////////////////////
                              METADATA
    //////////////////////////////////////////////////////////////*/
    function testUpdateTokenURI() public {
        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintEngagement(alice, 1, Types.EngagementSubtype.WORK, bytes32("ACTION1"), "");

        vm.prank(manager);
        valuableActionSBT.updateTokenURI(tokenId, "ipfs://example");

        assertEq(valuableActionSBT.tokenURI(tokenId), "ipfs://example");
    }

    function testSetEndedAt() public {
        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintPosition(alice, 1, bytes32("POSITION"), 10, "");

        vm.prank(manager);
        valuableActionSBT.setEndedAt(tokenId, 1234);

        ValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        assertEq(data.endedAt, 1234);
    }

    function testSetEndedAtNonexistentReverts() public {
        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.setEndedAt(99, 1);
    }

    /*//////////////////////////////////////////////////////////////
                              SOULBOUND
    //////////////////////////////////////////////////////////////*/
    function testSoulboundTransferReverts() public {
        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintEngagement(alice, 1, Types.EngagementSubtype.WORK, bytes32("ACTION1"), "");

        vm.prank(alice);
        vm.expectRevert(ValuableActionSBT.Soulbound.selector);
        valuableActionSBT.transferFrom(alice, bob, tokenId);
    }

    function testSoulboundApproveReverts() public {
        vm.prank(manager);
        uint256 tokenId = valuableActionSBT.mintEngagement(alice, 1, Types.EngagementSubtype.WORK, bytes32("ACTION1"), "");

        vm.prank(alice);
        vm.expectRevert(ValuableActionSBT.Soulbound.selector);
        valuableActionSBT.approve(bob, tokenId);
    }

    function testSoulboundSetApprovalForAllReverts() public {
        vm.prank(manager);
        valuableActionSBT.mintEngagement(alice, 1, Types.EngagementSubtype.WORK, bytes32("ACTION1"), "");

        vm.prank(alice);
        vm.expectRevert(ValuableActionSBT.Soulbound.selector);
        valuableActionSBT.setApprovalForAll(bob, true);
    }
}

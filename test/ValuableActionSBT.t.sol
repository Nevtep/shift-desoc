// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {Types} from "../contracts/libs/Types.sol";
import {ValuableActionSBT} from "../contracts/modules/ValuableActionSBT.sol";
import {Roles} from "../contracts/libs/Roles.sol";

contract ValuableActionSBTTest is Test {
    ValuableActionSBT public valuableActionSBT;
    AccessManager public accessManager;

    address public owner = makeAddr("owner");
    address public manager = makeAddr("manager");
    address public governance = makeAddr("governance");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        accessManager = new AccessManager(owner);
        valuableActionSBT = new ValuableActionSBT(address(accessManager));

        vm.startPrank(owner);
        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = valuableActionSBT.mintEngagement.selector;
        selectors[1] = valuableActionSBT.mintPosition.selector;
        selectors[2] = valuableActionSBT.mintInvestment.selector;
        selectors[3] = valuableActionSBT.setEndedAt.selector;
        selectors[4] = valuableActionSBT.closePositionToken.selector;
        selectors[5] = valuableActionSBT.updateTokenURI.selector;
        accessManager.setTargetFunctionRole(address(valuableActionSBT), selectors, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, manager, 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, governance, 0);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                          CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/
    function testConstructorSetsRolesAndCounters() public view {
        (bool isAdmin,) = accessManager.hasRole(accessManager.ADMIN_ROLE(), owner);
        assertTrue(isAdmin);
        (bool isManager,) = accessManager.hasRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, manager);
        assertTrue(isManager);
        assertEq(valuableActionSBT.nextTokenId(), 1);
    }

    function testConstructorZeroAddressReverts() public {
        vm.expectRevert();
        new ValuableActionSBT(address(0));
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
        assertEq(data.cohortId, 0);
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
        uint256 tokenId = valuableActionSBT.mintInvestment(bob, 4, 1, 100, bytes("invest"));

        ValuableActionSBT.TokenData memory data = valuableActionSBT.getTokenData(tokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.INVESTMENT));
        assertEq(data.communityId, 4);
        assertEq(data.cohortId, 1);
        assertEq(data.weight, 100);
    }

    function testMintInvestmentInvalidInputsRevert() public {
        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintInvestment(bob, 0, 1, 1, "");

        vm.prank(manager);
        vm.expectRevert();
        valuableActionSBT.mintInvestment(bob, 1, 0, 1, "");
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

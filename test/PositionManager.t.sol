// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {PositionManager} from "contracts/modules/PositionManager.sol";

contract CommunityRegistryMock {
    struct ModuleAddresses {
        address governor;
        address timelock;
        address requestHub;
        address draftsManager;
        address engagementsManager;
        address valuableActionRegistry;
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionSBT;
        address treasuryVault;
        address treasuryAdapter;
        address communityToken;
        address paramController;
    }

    mapping(uint256 => ModuleAddresses) internal modulesByCommunity;

    function setModuleAddresses(uint256 communityId, ModuleAddresses calldata modules) external {
        modulesByCommunity[communityId] = modules;
    }

    function getCommunityModules(uint256 communityId) external view returns (ModuleAddresses memory) {
        return modulesByCommunity[communityId];
    }
}

contract RevenueRouterMock {
    uint256 public lastRegistered;
    uint256 public lastUnregistered;

    function registerPosition(uint256 tokenId) external {
        lastRegistered = tokenId;
    }

    function unregisterPosition(uint256 tokenId) external {
        lastUnregistered = tokenId;
    }
}

contract PositionManagerTest is Test {
    ValuableActionRegistry registry;
    ValuableActionSBT sbt;
    PositionManager manager;
    CommunityRegistryMock communityRegistry;
    RevenueRouterMock router;

    address governance = makeAddr("governance");
    address moderator = makeAddr("moderator");
    address user = makeAddr("user");

    uint256 constant COMMUNITY_ID = 1;
    bytes32 constant ROLE_TYPE = bytes32("role:ops");

    function setUp() public {
        communityRegistry = new CommunityRegistryMock();
        registry = new ValuableActionRegistry(governance, address(communityRegistry));
        sbt = new ValuableActionSBT(governance, governance, governance);
        manager = new PositionManager(governance, address(registry), address(sbt));
        router = new RevenueRouterMock();

        communityRegistry.setModuleAddresses(
            COMMUNITY_ID,
            CommunityRegistryMock.ModuleAddresses({
                governor: address(0xBEEF),
                timelock: governance,
                requestHub: address(0),
                draftsManager: address(0),
                engagementsManager: address(0),
                valuableActionRegistry: address(registry),
                verifierPowerToken: address(0),
                verifierElection: address(0),
                verifierManager: address(0),
                valuableActionSBT: address(0),
                treasuryVault: address(0),
                treasuryAdapter: address(0),
                communityToken: address(0),
                paramController: address(0)
            })
        );

        vm.startPrank(governance);
        registry.setValuableActionSBT(address(sbt));
        sbt.grantRole(sbt.MANAGER_ROLE(), address(registry));
        registry.setIssuanceModule(address(manager), true);
        manager.setRevenueRouter(address(router));
        manager.setModerator(moderator, true);
        manager.definePositionType(ROLE_TYPE, COMMUNITY_ID, 10, true);
        vm.stopPrank();
    }

    function testDefinePositionTypeByModerator() public {
        bytes32 newRole = bytes32("role:new");
        vm.prank(moderator);
        manager.definePositionType(newRole, COMMUNITY_ID, 5, true);

        (,, uint32 points, bool active) = manager.positionTypes(newRole);
        assertEq(points, 5);
        assertTrue(active);
    }

    function testApplyAndApproveFlow() public {
        vm.prank(user);
        uint256 appId = manager.applyForPosition(ROLE_TYPE, bytes("evidence"));
        assertEq(appId, 1);

        vm.prank(governance);
        uint256 positionTokenId = manager.approveApplication(appId, bytes("metadata"));
        assertEq(positionTokenId, 1);
        assertEq(router.lastRegistered(), positionTokenId);

        ValuableActionSBT.TokenData memory data = sbt.getTokenData(positionTokenId);
        assertEq(uint256(data.kind), uint256(ValuableActionSBT.TokenKind.POSITION));
        assertEq(data.communityId, COMMUNITY_ID);
        assertEq(data.roleTypeId, ROLE_TYPE);
        assertEq(data.points, 10);
        assertEq(data.endedAt, 0);
    }

    function testCloseSuccessMintsRole() public {
        vm.prank(user);
        uint256 appId = manager.applyForPosition(ROLE_TYPE, bytes("evidence"));

        vm.prank(governance);
        uint256 positionTokenId = manager.approveApplication(appId, bytes("metadata"));
        ValuableActionSBT.TokenData memory beforeClose = sbt.getTokenData(positionTokenId);

        vm.warp(1000);
        vm.prank(governance);
        uint256 roleTokenId = manager.closePosition(positionTokenId, PositionManager.CloseOutcome.SUCCESS, bytes("role"));

        assertGt(roleTokenId, 0);

        ValuableActionSBT.TokenData memory posData = sbt.getTokenData(positionTokenId);
        ValuableActionSBT.TokenData memory roleData = sbt.getTokenData(roleTokenId);

        assertEq(posData.endedAt, block.timestamp);
        assertEq(posData.closeOutcome, uint8(PositionManager.CloseOutcome.SUCCESS));
        assertEq(uint256(roleData.kind), uint256(ValuableActionSBT.TokenKind.ROLE));
        assertEq(roleData.roleTypeId, ROLE_TYPE);
        assertEq(roleData.communityId, COMMUNITY_ID);
        assertEq(roleData.points, beforeClose.points);
        assertEq(roleData.issuedAt, beforeClose.issuedAt);
        assertEq(roleData.endedAt, posData.endedAt);
        assertEq(router.lastUnregistered(), positionTokenId);
    }

    function testCloseNeutralNoRole() public {
        vm.prank(user);
        uint256 appId = manager.applyForPosition(ROLE_TYPE, bytes("evidence"));

        vm.prank(governance);
        uint256 positionTokenId = manager.approveApplication(appId, bytes("metadata"));

        uint256 nextBefore = sbt.nextTokenId();

        vm.prank(governance);
        uint256 roleTokenId = manager.closePosition(positionTokenId, PositionManager.CloseOutcome.NEUTRAL, "");

        assertEq(roleTokenId, 0);
        assertEq(sbt.nextTokenId(), nextBefore); // no new token minted

        ValuableActionSBT.TokenData memory posData = sbt.getTokenData(positionTokenId);
        assertEq(posData.closeOutcome, uint8(PositionManager.CloseOutcome.NEUTRAL));
        assertGt(posData.endedAt, 0);
    }

    function testCannotCloseTwice() public {
        vm.prank(user);
        uint256 appId = manager.applyForPosition(ROLE_TYPE, bytes("evidence"));
        vm.prank(governance);
        uint256 positionTokenId = manager.approveApplication(appId, bytes("metadata"));

        vm.prank(governance);
        manager.closePosition(positionTokenId, PositionManager.CloseOutcome.NEGATIVE, "");

        vm.expectRevert(abi.encodeWithSelector(Errors.InvalidInput.selector, "Position already closed"));
        vm.prank(governance);
        manager.closePosition(positionTokenId, PositionManager.CloseOutcome.NEUTRAL, "");
    }

    function testUnauthorizedActionsRevert() public {
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        vm.prank(user);
        manager.definePositionType(bytes32("x"), COMMUNITY_ID, 1, true);

        vm.prank(user);
        uint256 appId = manager.applyForPosition(ROLE_TYPE, bytes("evidence"));
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        vm.prank(user);
        manager.approveApplication(appId, "");

        vm.prank(governance);
        uint256 positionTokenId = manager.approveApplication(appId, "meta");
        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, user));
        vm.prank(user);
        manager.closePosition(positionTokenId, PositionManager.CloseOutcome.SUCCESS, "");
    }
}

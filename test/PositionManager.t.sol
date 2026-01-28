// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AccessManager} from "@openzeppelin/contracts/access/manager/AccessManager.sol";
import {IAccessManaged} from "@openzeppelin/contracts/access/manager/IAccessManaged.sol";
import {ValuableActionRegistry} from "contracts/modules/ValuableActionRegistry.sol";
import {ValuableActionSBT} from "contracts/modules/ValuableActionSBT.sol";
import {Types} from "contracts/libs/Types.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {PositionManager} from "contracts/modules/PositionManager.sol";
import {Roles} from "contracts/libs/Roles.sol";

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
    AccessManager accessManager;
    CommunityRegistryMock communityRegistry;
    RevenueRouterMock router;

    address governance = makeAddr("governance");
    address moderator = makeAddr("moderator");
    address user = makeAddr("user");

    uint256 constant COMMUNITY_ID = 1;
    bytes32 constant ROLE_TYPE = bytes32("role:ops");
    uint64 constant MOD_ROLE = 1;

    function setUp() public {
        communityRegistry = new CommunityRegistryMock();
        accessManager = new AccessManager(governance);
        registry = new ValuableActionRegistry(address(accessManager), address(communityRegistry), governance);
        sbt = new ValuableActionSBT(address(accessManager));
        manager = new PositionManager(address(accessManager), address(registry), address(sbt));
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

        vm.startPrank(governance, governance);
        bytes4[] memory sbtSelectors = new bytes4[](6);
        sbtSelectors[0] = sbt.mintEngagement.selector;
        sbtSelectors[1] = sbt.mintPosition.selector;
        sbtSelectors[2] = sbt.mintInvestment.selector;
        sbtSelectors[3] = sbt.setEndedAt.selector;
        sbtSelectors[4] = sbt.closePositionToken.selector;
        sbtSelectors[5] = sbt.mintRoleFromPosition.selector;
        accessManager.setTargetFunctionRole(address(sbt), sbtSelectors, Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE);
        registry.setValuableActionSBT(address(sbt));
        accessManager.grantRole(Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE, address(registry), 0);
        accessManager.grantRole(Roles.VALUABLE_ACTION_REGISTRY_ISSUER_ROLE, address(manager), 0);
        registry.setIssuanceModule(address(manager), true);
        manager.setRevenueRouter(address(router));
        manager.definePositionType(ROLE_TYPE, COMMUNITY_ID, 10, true);
        vm.stopPrank();

        vm.startPrank(governance, governance);
        accessManager.grantRole(MOD_ROLE, moderator, 0);
        accessManager.grantRole(MOD_ROLE, governance, 0);
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = manager.definePositionType.selector;
        selectors[1] = manager.approveApplication.selector;
        selectors[2] = manager.closePosition.selector;
        accessManager.setTargetFunctionRole(address(manager), selectors, MOD_ROLE);
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
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user));
        vm.prank(user);
        manager.definePositionType(bytes32("x"), COMMUNITY_ID, 1, true);

        vm.prank(user);
        uint256 appId = manager.applyForPosition(ROLE_TYPE, bytes("evidence"));
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user));
        vm.prank(user);
        manager.approveApplication(appId, "");

        vm.prank(governance);
        uint256 positionTokenId = manager.approveApplication(appId, "meta");
        vm.expectRevert(abi.encodeWithSelector(IAccessManaged.AccessManagedUnauthorized.selector, user));
        vm.prank(user);
        manager.closePosition(positionTokenId, PositionManager.CloseOutcome.SUCCESS, "");
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Errors} from "contracts/libs/Errors.sol";
import {ShiftAccessManager} from "contracts/core/ShiftAccessManager.sol";
import {BootstrapCoordinator} from "contracts/core/BootstrapCoordinator.sol";

contract BootstrapCoordinatorTargetMock {
    function setValue(uint256) external {}
    function setFlag(bool) external {}
}

contract BootstrapCoordinatorTest is Test {
    ShiftAccessManager internal accessManager;
    BootstrapCoordinator internal coordinator;
    BootstrapCoordinatorTargetMock internal target;

    address internal operator = address(0xA11CE);
    address internal grantee = address(0xBEEF);
    uint64 internal constant CUSTOM_ROLE = 4242;

    function setUp() public {
        accessManager = new ShiftAccessManager(address(this));
        coordinator = new BootstrapCoordinator();
        target = new BootstrapCoordinatorTargetMock();

        uint64 adminRole = accessManager.ADMIN_ROLE();
        accessManager.grantRole(adminRole, operator, 0);
    }

    function testConfigureAccessManagerRevertsWhenCallerIsNotAdmin() public {
        BootstrapCoordinator.TargetRoleConfig[] memory selectorConfigs = _selectorConfigs(CUSTOM_ROLE);
        BootstrapCoordinator.RoleGrant[] memory grants = _grants();

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, grantee));
        vm.prank(grantee);
        coordinator.configureAccessManager(address(accessManager), selectorConfigs, grants);
    }

    function testConfigureAccessManagerRevertsWhenCoordinatorMissingAdminRole() public {
        BootstrapCoordinator.TargetRoleConfig[] memory selectorConfigs = _selectorConfigs(CUSTOM_ROLE);
        BootstrapCoordinator.RoleGrant[] memory grants = _grants();

        vm.expectRevert(abi.encodeWithSelector(Errors.NotAuthorized.selector, address(coordinator)));
        vm.prank(operator);
        coordinator.configureAccessManager(address(accessManager), selectorConfigs, grants);
    }

    function testConfigureAccessManagerBatchesSelectorsAndGrants() public {
        uint64 adminRole = accessManager.ADMIN_ROLE();
        accessManager.grantRole(adminRole, address(coordinator), 0);

        BootstrapCoordinator.TargetRoleConfig[] memory selectorConfigs = _selectorConfigs(CUSTOM_ROLE);
        BootstrapCoordinator.RoleGrant[] memory grants = _grants();

        vm.prank(operator);
        coordinator.configureAccessManager(address(accessManager), selectorConfigs, grants);

        uint64 roleForSetValue = accessManager.getTargetFunctionRole(address(target), target.setValue.selector);
        uint64 roleForSetFlag = accessManager.getTargetFunctionRole(address(target), target.setFlag.selector);
        assertEq(roleForSetValue, CUSTOM_ROLE);
        assertEq(roleForSetFlag, CUSTOM_ROLE);

        (bool hasMembership,) = accessManager.hasRole(CUSTOM_ROLE, grantee);
        assertTrue(hasMembership);
    }

    function _selectorConfigs(uint64 roleId)
        internal
        view
        returns (BootstrapCoordinator.TargetRoleConfig[] memory selectorConfigs)
    {
        selectorConfigs = new BootstrapCoordinator.TargetRoleConfig[](1);

        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = target.setValue.selector;
        selectors[1] = target.setFlag.selector;

        selectorConfigs[0] = BootstrapCoordinator.TargetRoleConfig({
            target: address(target),
            selectors: selectors,
            role: roleId
        });
    }

    function _grants() internal view returns (BootstrapCoordinator.RoleGrant[] memory grants) {
        grants = new BootstrapCoordinator.RoleGrant[](1);
        grants[0] = BootstrapCoordinator.RoleGrant({role: CUSTOM_ROLE, account: grantee, executionDelay: 0});
    }
}

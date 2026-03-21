// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

interface IAccessManagerBootstrap {
    function ADMIN_ROLE() external view returns (uint64);

    function hasRole(uint64 roleId, address account) external view returns (bool isMember, uint32 executionDelay);

    function setTargetFunctionRole(address target, bytes4[] calldata selectors, uint64 roleId) external;

    function grantRole(uint64 roleId, address account, uint32 executionDelay) external;
}

/// @title BootstrapCoordinator
/// @notice Batches AccessManager selector-role assignments and role grants in a single call.
/// @dev Caller must currently hold ADMIN_ROLE on the AccessManager, and this coordinator
///      must also hold ADMIN_ROLE to execute the writes.
contract BootstrapCoordinator {
    struct TargetRoleConfig {
        address target;
        bytes4[] selectors;
        uint64 role;
    }

    struct RoleGrant {
        uint64 role;
        address account;
        uint32 executionDelay;
    }

    event AccessManagerBootstrapped(
        address indexed accessManager,
        address indexed operator,
        uint256 selectorConfigCount,
        uint256 roleGrantCount
    );

    /// @notice Configure selector roles and grants on a target AccessManager.
    /// @param accessManager Address of the AccessManager to configure.
    /// @param selectorConfigs Selector-role assignments to apply.
    /// @param roleGrants Role memberships to ensure.
    function configureAccessManager(
        address accessManager,
        TargetRoleConfig[] calldata selectorConfigs,
        RoleGrant[] calldata roleGrants
    ) external {
        if (accessManager == address(0)) revert Errors.ZeroAddress();

        IAccessManagerBootstrap manager = IAccessManagerBootstrap(accessManager);
        uint64 adminRole = manager.ADMIN_ROLE();

        (bool callerIsAdmin,) = manager.hasRole(adminRole, msg.sender);
        if (!callerIsAdmin) revert Errors.NotAuthorized(msg.sender);

        (bool coordinatorIsAdmin,) = manager.hasRole(adminRole, address(this));
        if (!coordinatorIsAdmin) revert Errors.NotAuthorized(address(this));

        for (uint256 i = 0; i < selectorConfigs.length; i++) {
            TargetRoleConfig calldata cfg = selectorConfigs[i];
            if (cfg.target == address(0)) revert Errors.ZeroAddress();
            if (cfg.selectors.length == 0) revert Errors.InvalidInput("Empty selector config");

            manager.setTargetFunctionRole(cfg.target, cfg.selectors, cfg.role);
        }

        for (uint256 i = 0; i < roleGrants.length; i++) {
            RoleGrant calldata grantCfg = roleGrants[i];
            if (grantCfg.account == address(0)) revert Errors.ZeroAddress();

            (bool hasMembership,) = manager.hasRole(grantCfg.role, grantCfg.account);
            if (!hasMembership) {
                manager.grantRole(grantCfg.role, grantCfg.account, grantCfg.executionDelay);
            }
        }

        emit AccessManagerBootstrapped(accessManager, msg.sender, selectorConfigs.length, roleGrants.length);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

interface IAccessManagerBootstrap {
    function ADMIN_ROLE() external view returns (uint64);

    function hasRole(uint64 roleId, address account) external view returns (bool isMember, uint32 executionDelay);

    function setTargetFunctionRole(address target, bytes4[] calldata selectors, uint64 roleId) external;

    function grantRole(uint64 roleId, address account, uint32 executionDelay) external;
}

interface IValuableActionRegistryBootstrap {
    function valuableActionSBT() external view returns (address);

    function isIssuanceModule(address module) external view returns (bool);

    function founderWhitelist(address founder) external view returns (bool);

    function setValuableActionSBT(address sbt) external;

    function setIssuanceModule(address module, bool allowed) external;

    function addFounder(address founder) external;
}

interface IVerifierPowerTokenBootstrap {
    function communityInitialized() external view returns (bool);

    function initializeCommunity(string calldata metadataURI) external;
}

interface IRevenueRouterBootstrap {
    function communityTreasuries() external view returns (address);

    function supportedTokens(address token) external view returns (bool);

    function setCommunityTreasury(address treasury) external;

    function setSupportedToken(address token, bool supported) external;
}

interface ITreasuryAdapterBootstrap {
    function tokenAllowed(address token) external view returns (bool);

    function destinationAllowed(address destination) external view returns (bool);

    function capBps(address token) external view returns (uint16);

    function setTokenAllowed(address token, bool allowed) external;

    function setDestinationAllowed(address destination, bool allowed) external;

    function setCapBps(address token, uint16 capBpsValue) external;
}

interface IMarketplaceBootstrap {
    function communityActive() external view returns (bool);

    function communityTokens() external view returns (address);

    function setCommunityActive(bool active) external;

    function setCommunityToken(address token) external;
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

    struct RuntimeBootstrapConfig {
        uint256 communityId;
        address valuableActionRegistry;
        address verifierPowerToken;
        address requestHub;
        address founder;
        address valuableActionSBT;
        address revenueRouter;
        address treasuryAdapter;
        address marketplace;
        address communityToken;
        address treasuryVault;
        address[] supportedTokens;
        uint16 tokenCapBps;
        string verifierMetadataURI;
    }

    event AccessManagerBootstrapped(
        address indexed accessManager,
        address indexed operator,
        uint256 selectorConfigCount,
        uint256 roleGrantCount
    );

    event RuntimeBootstrapped(address indexed operator, uint256 indexed communityId, uint256 supportedTokenCount);

    /// @notice Configure selector roles and grants on a target AccessManager.
    /// @param accessManager Address of the AccessManager to configure.
    /// @param selectorConfigs Selector-role assignments to apply.
    /// @param roleGrants Role memberships to ensure.
    function configureAccessManager(
        address accessManager,
        TargetRoleConfig[] calldata selectorConfigs,
        RoleGrant[] calldata roleGrants
    ) external {
        IAccessManagerBootstrap manager = _requireAdminPair(accessManager);

        _applyAccessManagerConfig(manager, selectorConfigs, roleGrants, accessManager);
    }

    /// @notice Configure AccessManager and all community runtime defaults in one transaction.
    /// @dev Intended for fresh community deployment to avoid post-bootstrap reconciliation tx.
    function bootstrapAccessAndRuntime(
        address accessManager,
        TargetRoleConfig[] calldata selectorConfigs,
        RoleGrant[] calldata roleGrants,
        RuntimeBootstrapConfig calldata runtimeConfig
    ) external {
        IAccessManagerBootstrap manager = _requireAdminPair(accessManager);

        _applyAccessManagerConfig(manager, selectorConfigs, roleGrants, accessManager);
        _applyRuntimeBootstrap(runtimeConfig);

        emit RuntimeBootstrapped(msg.sender, runtimeConfig.communityId, runtimeConfig.supportedTokens.length);
    }

    function _requireAdminPair(address accessManager) internal view returns (IAccessManagerBootstrap manager) {
        if (accessManager == address(0)) revert Errors.ZeroAddress();

        manager = IAccessManagerBootstrap(accessManager);
        uint64 adminRole = manager.ADMIN_ROLE();

        (bool callerIsAdmin,) = manager.hasRole(adminRole, msg.sender);
        if (!callerIsAdmin) revert Errors.NotAuthorized(msg.sender);

        (bool coordinatorIsAdmin,) = manager.hasRole(adminRole, address(this));
        if (!coordinatorIsAdmin) revert Errors.NotAuthorized(address(this));
    }

    function _applyAccessManagerConfig(
        IAccessManagerBootstrap manager,
        TargetRoleConfig[] calldata selectorConfigs,
        RoleGrant[] calldata roleGrants,
        address accessManager
    ) internal {

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

    function _applyRuntimeBootstrap(RuntimeBootstrapConfig calldata cfg) internal {
        if (cfg.communityId == 0) revert Errors.InvalidInput("Invalid communityId");
        if (cfg.valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (cfg.verifierPowerToken == address(0)) revert Errors.ZeroAddress();
        if (cfg.requestHub == address(0)) revert Errors.ZeroAddress();
        if (cfg.founder == address(0)) revert Errors.ZeroAddress();
        if (cfg.valuableActionSBT == address(0)) revert Errors.ZeroAddress();
        if (cfg.revenueRouter == address(0)) revert Errors.ZeroAddress();
        if (cfg.treasuryAdapter == address(0)) revert Errors.ZeroAddress();
        if (cfg.marketplace == address(0)) revert Errors.ZeroAddress();
        if (cfg.communityToken == address(0)) revert Errors.ZeroAddress();
        if (cfg.treasuryVault == address(0)) revert Errors.ZeroAddress();
        if (cfg.tokenCapBps > 10_000) revert Errors.InvalidInput("Invalid token cap bps");

        IValuableActionRegistryBootstrap registry = IValuableActionRegistryBootstrap(cfg.valuableActionRegistry);
        if (registry.valuableActionSBT() != cfg.valuableActionSBT) {
            registry.setValuableActionSBT(cfg.valuableActionSBT);
        }

        if (!registry.isIssuanceModule(cfg.requestHub)) {
            registry.setIssuanceModule(cfg.requestHub, true);
        }

        if (!registry.founderWhitelist(cfg.founder)) {
            registry.addFounder(cfg.founder);
        }

        IVerifierPowerTokenBootstrap vpt = IVerifierPowerTokenBootstrap(cfg.verifierPowerToken);
        if (!vpt.communityInitialized()) {
            vpt.initializeCommunity(cfg.verifierMetadataURI);
        }

        IRevenueRouterBootstrap router = IRevenueRouterBootstrap(cfg.revenueRouter);
        if (router.communityTreasuries() != cfg.treasuryVault) {
            router.setCommunityTreasury(cfg.treasuryVault);
        }

        ITreasuryAdapterBootstrap adapter = ITreasuryAdapterBootstrap(cfg.treasuryAdapter);
        for (uint256 i = 0; i < cfg.supportedTokens.length; i++) {
            address token = cfg.supportedTokens[i];
            if (token == address(0)) revert Errors.ZeroAddress();

            if (!router.supportedTokens(token)) {
                router.setSupportedToken(token, true);
            }

            if (!adapter.tokenAllowed(token)) {
                adapter.setTokenAllowed(token, true);
            }

            if (adapter.capBps(token) != cfg.tokenCapBps) {
                adapter.setCapBps(token, cfg.tokenCapBps);
            }
        }

        if (!adapter.destinationAllowed(cfg.requestHub)) {
            adapter.setDestinationAllowed(cfg.requestHub, true);
        }

        IMarketplaceBootstrap marketplace = IMarketplaceBootstrap(cfg.marketplace);
        if (!marketplace.communityActive()) {
            marketplace.setCommunityActive(true);
        }

        if (marketplace.communityTokens() != cfg.communityToken) {
            marketplace.setCommunityToken(cfg.communityToken);
        }
    }
}

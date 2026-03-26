// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal interface for CommunityRegistry used by modules that need governance and module lookups
interface ICommunityRegistry {
    struct ModuleAddresses {
        address accessManager;
        address membershipToken;
        address governor;
        address timelock;
        address countingMultiChoice;
        address requestHub;
        address draftsManager;
        address engagementsManager;
        address valuableActionRegistry;
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionSBT;
        address positionManager;
        address credentialManager;
        address cohortRegistry;
        address investmentCohortManager;
        address revenueRouter;
        address treasuryVault;
        address treasuryAdapter;
        address communityToken;
        address paramController;
        address commerceDisputes;
        address marketplace;
        address housingManager;
        address projectFactory;
    }

    function getTimelock(uint256 communityId) external view returns (address);
    function communityAdmins(uint256 communityId, address account) external view returns (bool);
    function getCommunityModules(uint256 communityId) external view returns (ModuleAddresses memory);
}

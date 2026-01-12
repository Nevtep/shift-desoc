// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICommunityRegistry} from "contracts/modules/interfaces/ICommunityRegistry.sol";

contract MockCommunityRegistry is ICommunityRegistry {
    mapping(uint256 => address) public timelocks;
    mapping(uint256 => mapping(address => bool)) public communityAdmins;
    mapping(uint256 => ModuleAddresses) internal modulesByCommunity;

    function setTimelock(uint256 communityId, address timelock) external {
        timelocks[communityId] = timelock;
    }

    function setAdmin(uint256 communityId, address admin, bool isAdmin) external {
        communityAdmins[communityId][admin] = isAdmin;
    }

    function setCommunityModules(uint256 communityId, ModuleAddresses calldata modules) external {
        modulesByCommunity[communityId] = modules;
    }

    function getTimelock(uint256 communityId) external view returns (address) {
        return timelocks[communityId];
    }

    function getCommunityModules(uint256 communityId) external view returns (ModuleAddresses memory) {
        return modulesByCommunity[communityId];
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

contract CoordinationLayerFactory {
    struct Deployment {
        address requestHub;
        address draftsManager;
    }

    mapping(address => Deployment) public lastDeploymentByCaller;

    event CoordinationLayerDeployed(
        address indexed caller,
        uint256 indexed communityId,
        address requestHub,
        address draftsManager
    );

    function deployLayer(
        uint256 communityId,
        address communityRegistry,
        address valuableActionRegistry,
        address governor,
        address accessManager,
        bytes calldata requestHubCreationCode,
        bytes calldata draftsManagerCreationCode
    ) external returns (Deployment memory deployment) {
        if (communityId == 0) revert Errors.InvalidInput("communityId required");
        if (communityRegistry == address(0)) revert Errors.ZeroAddress();
        if (valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (governor == address(0)) revert Errors.ZeroAddress();
        if (accessManager == address(0)) revert Errors.ZeroAddress();

        deployment.requestHub = _deployWithArgs(
            requestHubCreationCode,
            abi.encode(communityRegistry, valuableActionRegistry)
        );

        deployment.draftsManager = _deployWithArgs(
            draftsManagerCreationCode,
            abi.encode(communityRegistry, governor, accessManager, communityId)
        );

        lastDeploymentByCaller[msg.sender] = deployment;

        emit CoordinationLayerDeployed(msg.sender, communityId, deployment.requestHub, deployment.draftsManager);
    }

    function _deployWithArgs(bytes calldata creationCode, bytes memory encodedArgs) internal returns (address deployed) {
        bytes memory initCode = abi.encodePacked(creationCode, encodedArgs);
        deployed = _deploy(initCode);
    }

    function _deploy(bytes memory initCode) internal returns (address deployed) {
        if (initCode.length == 0) revert Errors.InvalidInput("empty init code");
        assembly ("memory-safe") {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        if (deployed == address(0)) revert Errors.InvalidInput("create failed");
    }
}

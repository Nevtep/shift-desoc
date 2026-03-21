// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

contract CommerceLayerFactory {
    struct Deployment {
        address commerceDisputes;
        address marketplace;
        address housingManager;
        address projectFactory;
    }

    mapping(address => Deployment) public lastDeploymentByCaller;

    event CommerceLayerDeployed(
        address indexed caller,
        uint256 indexed communityId,
        address commerceDisputes,
        address marketplace,
        address housingManager,
        address projectFactory
    );

    function deployLayer(
        uint256 communityId,
        address accessManager,
        address stablecoin,
        address revenueRouter,
        bytes calldata commerceDisputesCreationCode,
        bytes calldata marketplaceCreationCode,
        bytes calldata housingManagerCreationCode,
        bytes calldata projectFactoryCreationCode
    ) external returns (Deployment memory deployment) {
        if (communityId == 0) revert Errors.InvalidInput("communityId required");
        if (accessManager == address(0)) revert Errors.ZeroAddress();
        if (stablecoin == address(0)) revert Errors.ZeroAddress();
        if (revenueRouter == address(0)) revert Errors.ZeroAddress();

        deployment.commerceDisputes = _deployWithArgs(commerceDisputesCreationCode, abi.encode(accessManager, communityId));

        deployment.marketplace = _deployWithArgs(
            marketplaceCreationCode,
            abi.encode(accessManager, deployment.commerceDisputes, revenueRouter, communityId)
        );

        deployment.housingManager = _deployWithArgs(
            housingManagerCreationCode,
            abi.encode(accessManager, stablecoin, communityId)
        );

        deployment.projectFactory = _deployWithArgs(projectFactoryCreationCode, abi.encode(communityId));

        lastDeploymentByCaller[msg.sender] = deployment;

        emit CommerceLayerDeployed(
            msg.sender,
            communityId,
            deployment.commerceDisputes,
            deployment.marketplace,
            deployment.housingManager,
            deployment.projectFactory
        );
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

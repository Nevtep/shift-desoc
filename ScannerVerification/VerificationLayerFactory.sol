// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

contract VerificationLayerFactory {
    struct Deployment {
        address verifierPowerToken;
        address verifierElection;
        address verifierManager;
        address valuableActionRegistry;
        address valuableActionSBT;
        address engagements;
        address positionManager;
        address credentialManager;
    }

    mapping(address => Deployment) public lastDeploymentByCaller;

    event VerificationLayerDeployed(
        address indexed caller,
        uint256 indexed communityId,
        address verifierPowerToken,
        address verifierElection,
        address verifierManager,
        address valuableActionRegistry,
        address valuableActionSBT,
        address engagements,
        address positionManager,
        address credentialManager
    );

    function deployLayer(
        uint256 communityId,
        address accessManager,
        address communityRegistry,
        address timelock,
        address paramController,
        address membershipToken,
        string calldata vptMetadataURI,
        bytes calldata verifierPowerTokenCreationCode,
        bytes calldata verifierElectionCreationCode,
        bytes calldata verifierManagerCreationCode,
        bytes calldata valuableActionRegistryCreationCode,
        bytes calldata valuableActionSBTCreationCode,
        bytes calldata engagementsCreationCode,
        bytes calldata positionManagerCreationCode,
        bytes calldata credentialManagerCreationCode
    ) external returns (Deployment memory deployment) {
        if (communityId == 0) revert Errors.InvalidInput("communityId required");
        if (accessManager == address(0)) revert Errors.ZeroAddress();
        if (communityRegistry == address(0)) revert Errors.ZeroAddress();
        if (timelock == address(0)) revert Errors.ZeroAddress();
        if (paramController == address(0)) revert Errors.ZeroAddress();
        if (membershipToken == address(0)) revert Errors.ZeroAddress();

        deployment.verifierPowerToken = _deployWithArgs(
            verifierPowerTokenCreationCode,
            abi.encode(accessManager, vptMetadataURI, communityId)
        );

        deployment.verifierElection = _deployWithArgs(
            verifierElectionCreationCode,
            abi.encode(accessManager, deployment.verifierPowerToken, communityId)
        );

        deployment.verifierManager = _deployWithArgs(
            verifierManagerCreationCode,
            abi.encode(accessManager, deployment.verifierElection, paramController, communityId)
        );

        deployment.valuableActionRegistry = _deployWithArgs(
            valuableActionRegistryCreationCode,
            abi.encode(accessManager, communityRegistry, timelock, communityId)
        );

        deployment.valuableActionSBT = _deployWithArgs(
            valuableActionSBTCreationCode,
            abi.encode(accessManager, communityId)
        );

        deployment.engagements = _deployWithArgs(
            engagementsCreationCode,
            abi.encode(
                accessManager,
                deployment.valuableActionRegistry,
                deployment.verifierManager,
                deployment.valuableActionSBT,
                membershipToken,
                communityId
            )
        );

        deployment.positionManager = _deployWithArgs(
            positionManagerCreationCode,
            abi.encode(accessManager, deployment.valuableActionRegistry, deployment.valuableActionSBT, communityId)
        );

        deployment.credentialManager = _deployWithArgs(
            credentialManagerCreationCode,
            abi.encode(accessManager, deployment.valuableActionRegistry, deployment.valuableActionSBT, communityId)
        );

        lastDeploymentByCaller[msg.sender] = deployment;

        emit VerificationLayerDeployed(
            msg.sender,
            communityId,
            deployment.verifierPowerToken,
            deployment.verifierElection,
            deployment.verifierManager,
            deployment.valuableActionRegistry,
            deployment.valuableActionSBT,
            deployment.engagements,
            deployment.positionManager,
            deployment.credentialManager
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

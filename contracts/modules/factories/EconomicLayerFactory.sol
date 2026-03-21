// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "contracts/libs/Errors.sol";

contract EconomicLayerFactory {
    struct Deployment {
        address cohortRegistry;
        address investmentCohortManager;
        address revenueRouter;
        address communityToken;
        address treasuryAdapter;
    }

    mapping(address => Deployment) public lastDeploymentByCaller;

    event EconomicLayerDeployed(
        address indexed caller,
        uint256 indexed communityId,
        address cohortRegistry,
        address investmentCohortManager,
        address revenueRouter,
        address communityToken,
        address treasuryAdapter
    );

    function deployLayer(
        uint256 communityId,
        string calldata communityName,
        address accessManager,
        address paramController,
        address communityRegistry,
        address valuableActionRegistry,
        address valuableActionSBT,
        address treasuryStableToken,
        address treasuryVault,
        bytes calldata cohortRegistryCreationCode,
        bytes calldata investmentCohortManagerCreationCode,
        bytes calldata revenueRouterCreationCode,
        bytes calldata communityTokenCreationCode,
        bytes calldata treasuryAdapterCreationCode
    ) external returns (Deployment memory deployment) {
        if (communityId == 0) revert Errors.InvalidInput("communityId required");
        if (bytes(communityName).length == 0) revert Errors.InvalidInput("communityName required");
        if (accessManager == address(0)) revert Errors.ZeroAddress();
        if (paramController == address(0)) revert Errors.ZeroAddress();
        if (communityRegistry == address(0)) revert Errors.ZeroAddress();
        if (valuableActionRegistry == address(0)) revert Errors.ZeroAddress();
        if (valuableActionSBT == address(0)) revert Errors.ZeroAddress();
        if (treasuryStableToken == address(0)) revert Errors.ZeroAddress();
        if (treasuryVault == address(0)) revert Errors.ZeroAddress();

        deployment.cohortRegistry = _deployWithArgs(cohortRegistryCreationCode, abi.encode(accessManager, communityId));

        deployment.investmentCohortManager = _deployWithArgs(
            investmentCohortManagerCreationCode,
            abi.encode(
                accessManager,
                deployment.cohortRegistry,
                valuableActionRegistry,
                valuableActionSBT,
                communityId
            )
        );

        deployment.revenueRouter = _deployWithArgs(
            revenueRouterCreationCode,
            abi.encode(accessManager, paramController, deployment.cohortRegistry, valuableActionSBT, communityId)
        );

        deployment.communityToken = _deployWithArgs(
            communityTokenCreationCode,
            abi.encode(
                treasuryStableToken,
                communityId,
                string.concat(communityName, " Token"),
                string.concat("SCT-", _toString(communityId)),
                treasuryVault,
                1000000 ether,
                paramController,
                accessManager
            )
        );

        deployment.treasuryAdapter = _deployWithArgs(
            treasuryAdapterCreationCode,
            abi.encode(accessManager, communityRegistry, communityId)
        );

        lastDeploymentByCaller[msg.sender] = deployment;

        emit EconomicLayerDeployed(
            msg.sender,
            communityId,
            deployment.cohortRegistry,
            deployment.investmentCohortManager,
            deployment.revenueRouter,
            deployment.communityToken,
            deployment.treasuryAdapter
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

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}

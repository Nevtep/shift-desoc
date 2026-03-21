// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Errors} from "./Errors.sol";

contract GovernanceLayerFactory {
    struct Deployment {
        address membershipToken;
        address timelock;
        address governor;
        address countingMultiChoice;
    }

    mapping(address => Deployment) public lastDeploymentByCaller;

    event GovernanceLayerDeployed(
        address indexed caller,
        uint256 indexed communityId,
        address membershipToken,
        address timelock,
        address governor,
        address countingMultiChoice
    );

    function deployLayer(
        uint256 communityId,
        string calldata communityName,
        address accessManager,
        uint256 executionDelay,
        address timelockAdmin,
        bytes calldata membershipTokenCreationCode,
        bytes calldata timelockCreationCode,
        bytes calldata governorCreationCode,
        bytes calldata countingMultiChoiceCreationCode
    ) external returns (Deployment memory deployment) {
        if (communityId == 0) revert Errors.InvalidInput("communityId required");
        if (bytes(communityName).length == 0) revert Errors.InvalidInput("communityName required");
        if (accessManager == address(0)) revert Errors.ZeroAddress();
        if (timelockAdmin == address(0)) revert Errors.ZeroAddress();
        if (executionDelay > type(uint32).max) revert Errors.InvalidInput("executionDelay exceeds uint32");

        string memory symbol = string.concat("sMEM-", _toString(communityId));

        deployment.membershipToken = _deployWithArgs(
            membershipTokenCreationCode,
            abi.encode(string.concat(communityName, " Membership"), symbol, communityId, accessManager)
        );

        deployment.timelock = _deployWithArgs(
            timelockCreationCode,
            abi.encode(executionDelay, new address[](0), new address[](0), timelockAdmin)
        );

        deployment.governor = _deployWithArgs(
            governorCreationCode,
            abi.encode(deployment.membershipToken, accessManager, uint32(executionDelay))
        );

        deployment.countingMultiChoice = _deployWithArgs(
            countingMultiChoiceCreationCode,
            abi.encode(deployment.governor)
        );

        lastDeploymentByCaller[msg.sender] = deployment;

        emit GovernanceLayerDeployed(
            msg.sender,
            communityId,
            deployment.membershipToken,
            deployment.timelock,
            deployment.governor,
            deployment.countingMultiChoice
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

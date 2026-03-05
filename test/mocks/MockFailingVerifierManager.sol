// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockFailingVerifierManager {
    function selectJurors(
        uint256,
        uint256,
        uint256,
        uint256,
        bool
    ) external pure returns (address[] memory) {
        revert("mock juror selection failure");
    }

    function reportFraud(
        uint256,
        uint256,
        address[] calldata,
        string calldata
    ) external pure {
        revert("mock fraud reporting failure");
    }
}

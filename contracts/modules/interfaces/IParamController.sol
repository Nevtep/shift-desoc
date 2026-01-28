// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IParamController
/// @notice ParamController interface for revenue policy and verifier parameters.
interface IParamController {
    function getRevenuePolicy(uint256 communityId)
        external
        view
        returns (uint16 minTreasuryBps, uint16 minPositionsBps, uint8 spilloverTarget, uint16 spilloverSplitBpsToTreasury);

    function getBool(uint256 communityId, bytes32 key) external view returns (bool);

    function getUint256(uint256 communityId, bytes32 key) external view returns (uint256);
}

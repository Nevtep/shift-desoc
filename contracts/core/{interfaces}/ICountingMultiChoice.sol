// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICountingMultiChoice {
    event VoteCastMulti(uint256 indexed proposalId, address indexed voter, uint256[] weights, uint256 weightUsed, string reason);
    function enableMulti(uint256 proposalId, uint8 options) external;
    function castVoteMulti(uint256 proposalId, address voter, uint256 weight, uint256[] calldata weights, string calldata reason) external returns (uint256);
    function optionTotals(uint256 proposalId) external view returns (uint256[] memory);
    function numOptionsOf(uint256 proposalId) external view returns (uint8);
}

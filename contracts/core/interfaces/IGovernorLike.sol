// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGovernorLike {
    function propose(
        address[] memory t, 
        uint256[] memory v, 
        bytes[] memory c, 
        string memory d
    ) external returns (uint256);
    
    function proposeMultiChoice(
        address[] memory t, 
        uint256[] memory v, 
        bytes[] memory c, 
        string memory d, 
        uint8 numOptions
    ) external returns (uint256);
}

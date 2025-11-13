// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TreasuryAdapter {
    error NotConfigured();
    function execute(address, uint256, bytes calldata, uint8) external pure returns (bool) {
        // Fase 2: Safe/Zodiac
        revert NotConfigured();
    }
}

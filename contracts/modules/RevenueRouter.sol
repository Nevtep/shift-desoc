// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RevenueRouter {
    // Split por defecto: 50/30/20 (workers/treasury/investors)
    uint16 public workersBps = 5000;
    uint16 public treasuryBps = 3000;
    uint16 public investorsBps = 2000;

    event RevenueReceived(address indexed token, uint256 amount);
    event RevenueSplit(uint256 workers, uint256 treasury, uint256 investors);

    function onRevenue(address token, uint256 amount) external {
        // TODO: recibir fondos del Marketplace y distribuir (acumular contabilidad en MVP)
        emit RevenueReceived(token, amount);
        emit RevenueSplit(amount * workersBps/10000, amount * treasuryBps/10000, amount * investorsBps/10000);
    }
}

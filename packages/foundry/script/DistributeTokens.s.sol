// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Token Distribution Script
 * @notice Distributes tokens from deployer to test users for E2E testing
 * Prerequisites:
 * 1. Contracts must be deployed first (run DeployMVP.s.sol)
 * 2. Update .env with contract addresses and user addresses
 * 3. Fund user addresses with Sepolia ETH for gas
 */
contract DistributeTokens is Script {
    IERC20 token;
    
    function run() external {
        // Load deployed token address
        token = IERC20(vm.envAddress("TOKEN"));
        
        // Load test user addresses
        address user1 = vm.envAddress("USER1_ADDRESS");
        address user2 = vm.envAddress("USER2_ADDRESS");
        address user3 = vm.envAddress("USER3_ADDRESS");
        address user4 = vm.envAddress("USER4_ADDRESS");
        address user5 = vm.envAddress("USER5_ADDRESS");
        
        console.log("Distributing tokens for E2E testing...");
        console.log("Token contract:", address(token));
        
        uint256 tokenAmount = 1000 * 1e18; // 1000 tokens each
        
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        // Check deployer balance
        uint256 deployerBalance = token.balanceOf(msg.sender);
        console.log("Deployer balance:", deployerBalance / 1e18, "tokens");
        
        require(deployerBalance >= tokenAmount * 5, "Insufficient deployer balance");
        
        // Distribute tokens to each user
        console.log("Distributing", tokenAmount / 1e18, "tokens to each user...");
        
        token.transfer(user1, tokenAmount);
        console.log("Sent to User1:", user1);
        
        token.transfer(user2, tokenAmount);
        console.log("Sent to User2:", user2);
        
        token.transfer(user3, tokenAmount);
        console.log("Sent to User3:", user3);
        
        token.transfer(user4, tokenAmount);
        console.log("Sent to User4:", user4);
        
        token.transfer(user5, tokenAmount);
        console.log("Sent to User5:", user5);
        
        vm.stopBroadcast();
        
        console.log("Token distribution completed!");
        console.log("Next steps:");
        console.log("1. Each user should delegate voting power to themselves");
        console.log("2. Run the E2E governance test script");
    }
}
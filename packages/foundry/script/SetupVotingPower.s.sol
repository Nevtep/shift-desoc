// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Setup Voting Power Script
 * @notice Each user delegates voting power to themselves
 * Run this script 5 times, once for each user private key
 */
contract SetupVotingPower is Script {
    IVotes token;
    IERC20 tokenERC20;
    
    function run() external {
        // Load deployed token address
        address tokenAddress = vm.envAddress("TOKEN");
        token = IVotes(tokenAddress);
        tokenERC20 = IERC20(tokenAddress);
        
        console.log("Setting up voting power...");
        console.log("Token contract:", tokenAddress);
        
        // The private key used determines which user is delegating
        uint256 userPrivateKey = vm.envUint("USER_PRIVATE_KEY");
        address userAddress = vm.addr(userPrivateKey);
        
        vm.startBroadcast(userPrivateKey);
        
        // Check token balance
        uint256 balance = tokenERC20.balanceOf(userAddress);
        console.log("User:", userAddress);
        console.log("Token balance:", balance / 1e18);
        
        // Delegate to self
        token.delegate(userAddress);
        
        vm.stopBroadcast();
        
        // Check voting power
        uint256 votingPower = token.getVotes(userAddress);
        console.log("Voting power:", votingPower / 1e18);
        console.log("Delegation completed!");
    }
}
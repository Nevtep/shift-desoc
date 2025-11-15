// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

// Core contracts
import {MembershipTokenERC20Votes} from "contracts/tokens/MembershipTokenERC20Votes.sol";
import {ShiftGovernor} from "contracts/core/ShiftGovernor.sol";
import {CountingMultiChoice} from "contracts/core/CountingMultiChoice.sol";
import {CommunityRegistry} from "contracts/modules/CommunityRegistry.sol";
import {RequestHub} from "contracts/modules/RequestHub.sol";
import {DraftsManager} from "contracts/modules/DraftsManager.sol";
import {ActionTypeRegistry} from "contracts/modules/ActionTypeRegistry.sol";

// OpenZeppelin
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

contract DeploySepoliaMVP is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying Shift DeSoc MVP for End-to-End Testing...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        // Step 1: Deploy Core Governance Infrastructure
        console.log("");
        console.log("=== CORE GOVERNANCE INFRASTRUCTURE ===");
        
        // Deploy Membership Token
        console.log("Deploying MembershipTokenERC20Votes...");
        MembershipTokenERC20Votes token = new MembershipTokenERC20Votes("Shift Membership", "sMEM");
        console.log("Token deployed to:", address(token));

        // Deploy Timelock (1 hour delay for testing)
        console.log("Deploying TimelockController...");
        address[] memory proposers = new address[](0);
        address[] memory executors = new address[](0);
        TimelockController timelock = new TimelockController(3600, proposers, executors, address(0));
        console.log("Timelock deployed to:", address(timelock));

        // Deploy Governor
        console.log("Deploying ShiftGovernor...");
        ShiftGovernor governor = new ShiftGovernor(address(token), address(timelock));
        console.log("Governor deployed to:", address(governor));

        // Deploy CountingMultiChoice
        console.log("Deploying CountingMultiChoice...");
        CountingMultiChoice multiChoice = new CountingMultiChoice();
        console.log("CountingMultiChoice deployed to:", address(multiChoice));

        // Step 2: Deploy Community Coordination Layer
        console.log("");
        console.log("=== COMMUNITY COORDINATION LAYER ===");

        // Deploy CommunityRegistry
        console.log("Deploying CommunityRegistry...");
        address deployer = vm.addr(deployerPrivateKey);
        CommunityRegistry registry = new CommunityRegistry(deployer);
        console.log("CommunityRegistry deployed to:", address(registry));

        // Deploy RequestHub
        console.log("Deploying RequestHub...");
        RequestHub requestHub = new RequestHub(address(registry));
        console.log("RequestHub deployed to:", address(requestHub));

        // Deploy DraftsManager
        console.log("Deploying DraftsManager...");
        DraftsManager draftsManager = new DraftsManager(address(registry), address(governor));
        console.log("DraftsManager deployed to:", address(draftsManager));

        // Step 3: Deploy Work Verification System
        console.log("");
        console.log("=== WORK VERIFICATION SYSTEM ===");

        // Deploy ActionTypeRegistry
        console.log("Deploying ActionTypeRegistry...");
        ActionTypeRegistry actionRegistry = new ActionTypeRegistry(address(governor));
        console.log("ActionTypeRegistry deployed to:", address(actionRegistry));

        // Step 4: Setup Test Community
        console.log("");
        console.log("=== SETTING UP TEST COMMUNITY ===");
        
        console.log("Creating test community...");
        uint256 communityId = registry.registerCommunity(
            "Test Community",                    // name
            "Community for end-to-end testing", // description
            "ipfs://test-metadata",             // metadataURI
            0                                   // parentCommunityId (0 = root)
        );
        console.log("Test community created with ID:", communityId);

        // Set module addresses for the community
        console.log("Setting module addresses...");
        registry.setModuleAddress(communityId, keccak256("governor"), address(governor));
        registry.setModuleAddress(communityId, keccak256("timelock"), address(timelock));
        registry.setModuleAddress(communityId, keccak256("requestHub"), address(requestHub));
        registry.setModuleAddress(communityId, keccak256("draftsManager"), address(draftsManager));
        registry.setModuleAddress(communityId, keccak256("actionTypeRegistry"), address(actionRegistry));
        console.log("Module addresses configured");

        // Step 5: Deploy Summary
        console.log("");
        console.log("DEPLOYMENT SUMMARY");
        console.log("==================================================");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("");
        console.log("Contract Addresses:");
        console.log("Token:", address(token));
        console.log("Timelock:", address(timelock));
        console.log("Governor:", address(governor));
        console.log("CountingMulti:", address(multiChoice));
        console.log("CommunityRegistry:", address(registry));
        console.log("RequestHub:", address(requestHub));
        console.log("DraftsManager:", address(draftsManager));
        console.log("ActionTypeRegistry:", address(actionRegistry));

        console.log("");
        console.log("Test Community Setup:");
        console.log("Community ID:", communityId);
        console.log("Name: Test Community");
        console.log("Creator:", vm.addr(deployerPrivateKey));

        vm.stopBroadcast();

        // Save addresses to file for e2e testing
        console.log("");
        console.log("Copy these addresses to your .env file:");
        console.log('TOKEN="%s"', address(token));
        console.log('TIMELOCK="%s"', address(timelock));
        console.log('GOVERNOR="%s"', address(governor));
        console.log('COUNTING_MULTI="%s"', address(multiChoice));
        console.log('COMMUNITY_REGISTRY="%s"', address(registry));
        console.log('REQUEST_HUB="%s"', address(requestHub));
        console.log('DRAFTS_MANAGER="%s"', address(draftsManager));
        console.log('ACTION_TYPE_REGISTRY="%s"', address(actionRegistry));
        console.log('COMMUNITY_ID="%s"', communityId);
    }
}
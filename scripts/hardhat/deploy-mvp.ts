import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Shift DeSoc MVP for End-to-End Testing...");
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  // Step 1: Deploy Core Governance Infrastructure
  console.log("\n=== CORE GOVERNANCE INFRASTRUCTURE ===");
  
  // Deploy Membership Token
  console.log("\n📄 Deploying MembershipTokenERC20Votes...");
  const Token = await ethers.getContractFactory("MembershipTokenERC20Votes");
  const token = await Token.deploy("Shift Membership", "sMEM");
  await token.waitForDeployment();
  console.log("✅ Token deployed to:", await token.getAddress());

  // Deploy Timelock (1 hour delay for testing)
  console.log("\n⏰ Deploying TimelockController...");
  const Timelock = await ethers.getContractFactory("TimelockController");
  const timelock = await Timelock.deploy(3600, [], [], ethers.ZeroAddress);
  await timelock.waitForDeployment();
  console.log("✅ Timelock deployed to:", await timelock.getAddress());

  // Deploy Governor
  console.log("\n🏛️ Deploying ShiftGovernor...");
  const Gov = await ethers.getContractFactory("ShiftGovernor");
  const gov = await Gov.deploy(await token.getAddress(), await timelock.getAddress());
  await gov.waitForDeployment();
  console.log("✅ Governor deployed to:", await gov.getAddress());

  // Deploy CountingMultiChoice
  console.log("\n🗳️ Deploying CountingMultiChoice...");
  const Multi = await ethers.getContractFactory("CountingMultiChoice");
  const multi = await Multi.deploy();
  await multi.waitForDeployment();
  console.log("✅ CountingMultiChoice deployed to:", await multi.getAddress());

  // Step 2: Deploy Community Coordination Layer
  console.log("\n=== COMMUNITY COORDINATION LAYER ===");

  // Deploy CommunityRegistry
  console.log("\n🌐 Deploying CommunityRegistry...");
  const Registry = await ethers.getContractFactory("CommunityRegistry");
  const registry = await Registry.deploy(deployer.address); // initialAdmin
  await registry.waitForDeployment();
  console.log("✅ CommunityRegistry deployed to:", await registry.getAddress());

  // Deploy RequestHub
  console.log("\n💬 Deploying RequestHub...");
  const RequestHub = await ethers.getContractFactory("RequestHub");
  const requestHub = await RequestHub.deploy(await registry.getAddress());
  await requestHub.waitForDeployment();
  console.log("✅ RequestHub deployed to:", await requestHub.getAddress());

  // Deploy DraftsManager
  console.log("\n📝 Deploying DraftsManager...");
  const Drafts = await ethers.getContractFactory("DraftsManager");
  const drafts = await Drafts.deploy(
    await registry.getAddress(),
    await gov.getAddress() // DraftsManager needs governor address
  );
  await drafts.waitForDeployment();
  console.log("✅ DraftsManager deployed to:", await drafts.getAddress());

  // Step 3: Deploy Work Verification System
  console.log("\n=== WORK VERIFICATION SYSTEM ===");

  // Deploy ActionTypeRegistry
  console.log("\n⚙️ Deploying ActionTypeRegistry...");
  const ActionRegistry = await ethers.getContractFactory("ActionTypeRegistry");
  const actionRegistry = await ActionRegistry.deploy(await gov.getAddress()); // governance address
  await actionRegistry.waitForDeployment();
  console.log("✅ ActionTypeRegistry deployed to:", await actionRegistry.getAddress());

  // Step 4: Initialize Connections
  console.log("\n=== INITIALIZING CONNECTIONS ===");

  // Initialize CountingMultiChoice in Governor via governance
  console.log("\n🔗 Setting up Governor → CountingMultiChoice connection...");
  console.log("⚠️  This requires a governance proposal after deployment");

  // Step 5: Setup Test Community
  console.log("\n=== SETTING UP TEST COMMUNITY ===");
  
  console.log("\n🏠 Creating test community...");
  const createTx = await registry.registerCommunity(
    "Test Community",                    // name
    "Community for end-to-end testing", // description
    "ipfs://test-metadata",             // metadataURI
    0                                   // parentCommunityId (0 = root)
  );
  await createTx.wait();
  console.log("✅ Test community created with ID: 1");

  // Set module addresses for the community
  console.log("\n🔧 Setting module addresses...");
  const moduleUpdates = [
    { key: ethers.keccak256(ethers.toUtf8Bytes("governor")), address: await gov.getAddress() },
    { key: ethers.keccak256(ethers.toUtf8Bytes("timelock")), address: await timelock.getAddress() },
    { key: ethers.keccak256(ethers.toUtf8Bytes("requestHub")), address: await requestHub.getAddress() },
    { key: ethers.keccak256(ethers.toUtf8Bytes("draftsManager")), address: await drafts.getAddress() },
    { key: ethers.keccak256(ethers.toUtf8Bytes("actionTypeRegistry")), address: await actionRegistry.getAddress() }
  ];

  for (const module of moduleUpdates) {
    const setModuleTx = await registry.setModuleAddress(1, module.key, module.address);
    await setModuleTx.wait();
  }
  console.log("✅ Module addresses configured");

  // Step 6: Deploy Summary and Next Steps
  console.log("\n🎯 DEPLOYMENT SUMMARY");
  console.log("=".repeat(50));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Deployer:", deployer.address);
  console.log("\n📋 Contract Addresses:");
  console.log("├── Token:", await token.getAddress());
  console.log("├── Timelock:", await timelock.getAddress());
  console.log("├── Governor:", await gov.getAddress());
  console.log("├── CountingMulti:", await multi.getAddress());
  console.log("├── CommunityRegistry:", await registry.getAddress());
  console.log("├── RequestHub:", await requestHub.getAddress());
  console.log("├── DraftsManager:", await drafts.getAddress());
  console.log("└── ActionTypeRegistry:", await actionRegistry.getAddress());

  console.log("\n🏠 Test Community Setup:");
  console.log("├── Community ID: 1");
  console.log("├── Name: Test Community");
  console.log("└── Creator:", deployer.address);

  console.log("\n📋 NEXT STEPS FOR END-TO-END TESTING:");
  console.log("=".repeat(50));
  console.log("1. 🔗 Connect CountingMultiChoice to Governor via governance proposal");
  console.log("2. 🪙 Mint tokens to test users (user1-user5)");
  console.log("3. 👥 Have users 2-5 join the community (get tokens)");
  console.log("4. 📝 User1 creates a request for ActionType funding");
  console.log("5. 📄 User2 creates a draft with ActionType creation calldata");
  console.log("6. 💬 Users 3-5 discuss on the request and draft");
  console.log("7. 🗳️ Draft escalates to proposal, 3/5 users vote");
  console.log("8. ⚡ Execute proposal to create the ActionType");

  console.log("\n💡 Key Testing Addresses Needed:");
  console.log("├── user1 (community creator & proposer)");
  console.log("├── user2 (draft creator)");
  console.log("├── user3 (voter & discussant)");
  console.log("├── user4 (voter & discussant)");
  console.log("└── user5 (voter & discussant)");

  console.log("\n⚠️  IMPORTANT GOVERNANCE CONNECTION:");
  console.log("After deployment, run a governance proposal to connect CountingMultiChoice:");
  console.log(`await gov.propose(`);
  console.log(`  ["${await gov.getAddress()}"],`);
  console.log(`  [0],`);
  console.log(`  [gov.interface.encodeFunctionData("setCountingMulti", ["${await multi.getAddress()}"])],`);
  console.log(`  "Connect MultiChoice Counting Module"`);
  console.log(`);`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
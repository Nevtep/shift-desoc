import { ethers } from "hardhat";

/**
 * Create New Community with Single Founder
 *
 * This script creates a new community using the deployed CommunityFactory.
 * Prerequisites: Master infrastructure must be deployed first.
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("🏠 Creating New Shift Community...");
  console.log("Founder/Deployer:", deployer.address);
  console.log(
    "Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
  );

  // =================================================================
  // CONFIGURATION - Update these addresses from master deployment
  // =================================================================

  // TODO: Update these addresses after running deploy-master-infrastructure.ts
  const COMMUNITY_FACTORY_ADDRESS = "0x..."; // From master deployment
  const COMMUNITY_REGISTRY_ADDRESS = "0x..."; // From master deployment

  if (
    COMMUNITY_FACTORY_ADDRESS === "0x..." ||
    COMMUNITY_REGISTRY_ADDRESS === "0x..."
  ) {
    console.error(
      "❌ Please update COMMUNITY_FACTORY_ADDRESS and COMMUNITY_REGISTRY_ADDRESS from master deployment",
    );
    process.exit(1);
  }

  // Community Configuration
  const COMMUNITY_CONFIG = {
    name: "Pioneers Community",
    description:
      "First community on Shift DeSoc - focused on building the future of decentralized coordination",
    metadataURI: "ipfs://QmPioneersCommunityMetadata123", // TODO: Upload real metadata
    parentCommunityId: 0, // 0 = root community

    // Governance Parameters
    governanceParams: {
      debateWindow: 24 * 60 * 60, // 1 day for debate
      voteWindow: 72 * 60 * 60, // 3 days for voting
      executionDelay: 24 * 60 * 60, // 1 day before execution
      minSeniority: 0, // No minimum age requirement initially
      minSBTs: 0, // No minimum SBT requirement initially
      proposalThreshold: ethers.parseEther("100"), // 100 tokens to create proposal
      revenueSplit: [5000, 3000, 2000], // 50% workers, 30% treasury, 20% investors
      feeOnWithdraw: 100, // 1% fee on withdrawals (100 basis points)
    },
  };

  // =================================================================
  // STEP 1: Connect to deployed contracts
  // =================================================================

  console.log("\n=== CONNECTING TO CONTRACTS ===");

  const communityFactory = await ethers.getContractAt(
    "CommunityFactory",
    COMMUNITY_FACTORY_ADDRESS,
  );
  const communityRegistry = await ethers.getContractAt(
    "CommunityRegistry",
    COMMUNITY_REGISTRY_ADDRESS,
  );

  console.log("✅ Connected to CommunityFactory:", COMMUNITY_FACTORY_ADDRESS);
  console.log("✅ Connected to CommunityRegistry:", COMMUNITY_REGISTRY_ADDRESS);

  // =================================================================
  // STEP 2: Create the community
  // =================================================================

  console.log("\n=== CREATING COMMUNITY ===");

  console.log(`📝 Community Name: ${COMMUNITY_CONFIG.name}`);
  console.log(`📝 Description: ${COMMUNITY_CONFIG.description}`);
  console.log(`👤 Founder: ${deployer.address}`);
  console.log(`⚙️ Governance Params:`, COMMUNITY_CONFIG.governanceParams);

  // Execute community creation
  console.log("\n🚀 Calling CommunityFactory.createCommunity()...");
  const createTx = await communityFactory.createCommunity(
    COMMUNITY_CONFIG.name,
    COMMUNITY_CONFIG.description,
    COMMUNITY_CONFIG.metadataURI,
    COMMUNITY_CONFIG.governanceParams,
    COMMUNITY_CONFIG.parentCommunityId,
  );

  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await createTx.wait();
  console.log("✅ Community creation transaction confirmed!");

  // =================================================================
  // STEP 3: Extract community ID and addresses from events
  // =================================================================

  console.log("\n=== EXTRACTING DEPLOYMENT INFO ===");

  // Find CommunityDeployed event
  const communityDeployedEvent = receipt?.logs?.find((log: any) => {
    try {
      const parsed = communityFactory.interface.parseLog(log);
      return parsed?.name === "CommunityDeployed";
    } catch {
      return false;
    }
  });

  if (!communityDeployedEvent) {
    console.error("❌ Could not find CommunityDeployed event");
    process.exit(1);
  }

  const parsedEvent = communityFactory.interface.parseLog(
    communityDeployedEvent,
  );
  const communityId = parsedEvent?.args?.communityId;
  const governorAddress = parsedEvent?.args?.governor;
  const timelockAddress = parsedEvent?.args?.timelock;
  const membershipTokenAddress = parsedEvent?.args?.membershipToken;
  const valuableActionRegistryAddress =
    parsedEvent?.args?.valuableActionRegistry;

  console.log("🆔 Community ID:", communityId?.toString());
  console.log("🏛️ Governor:", governorAddress);
  console.log("⏰ Timelock:", timelockAddress);
  console.log("🪙 MembershipToken:", membershipTokenAddress);
  console.log("⚙️ ValuableActionRegistry:", valuableActionRegistryAddress);

  // =================================================================
  // STEP 4: Fetch additional module addresses from registry
  // =================================================================

  console.log("\n=== FETCHING MODULE ADDRESSES ===");

  try {
    const modules = await communityRegistry.getCommunityModules(communityId);

    console.log("📋 All Module Addresses:");
    console.log("├── Governor:", modules.governor);
    console.log("├── Timelock:", modules.timelock);
    console.log("├── RequestHub:", modules.requestHub);
    console.log("├── DraftsManager:", modules.draftsManager);
    console.log("├── Engagements:", modules.engagementsManager);
    console.log("├── ValuableActionRegistry:", modules.valuableActionRegistry);
    console.log("├── VerifierPool:", modules.verifierPool);
    console.log("├── WorkerSBT:", modules.workerSBT);
    console.log("├── CommunityToken:", modules.communityToken);
    console.log("└── TreasuryAdapter:", modules.treasuryAdapter);
  } catch (error) {
    console.warn("⚠️ Could not fetch all module addresses:", error);
  }

  // =================================================================
  // STEP 5: Verify founder setup
  // =================================================================

  console.log("\n=== VERIFYING FOUNDER SETUP ===");

  if (membershipTokenAddress) {
    const membershipToken = await ethers.getContractAt(
      "MembershipTokenERC20Votes",
      membershipTokenAddress,
    );

    try {
      const founderBalance = await membershipToken.balanceOf(deployer.address);
      const totalSupply = await membershipToken.totalSupply();

      console.log(
        "👤 Founder Token Balance:",
        ethers.formatEther(founderBalance),
      );
      console.log("📊 Total Supply:", ethers.formatEther(totalSupply));
      console.log(
        "🗳️ Voting Power:",
        ethers.formatEther(await membershipToken.getVotes(deployer.address)),
      );

      if (founderBalance > 0) {
        console.log("✅ Founder successfully bootstrapped with tokens!");
      } else {
        console.log("⚠️ Founder has no tokens - this may indicate an issue");
      }
    } catch (error) {
      console.warn("⚠️ Could not verify founder token balance:", error);
    }
  }

  // =================================================================
  // COMMUNITY CREATION SUMMARY
  // =================================================================

  console.log("\n🎉 COMMUNITY CREATION SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Transaction Hash:", createTx.hash);
  console.log("Gas Used:", receipt?.gasUsed?.toString() || "Unknown");

  console.log("\n🏠 COMMUNITY DETAILS:");
  console.log("├── ID:", communityId?.toString());
  console.log("├── Name:", COMMUNITY_CONFIG.name);
  console.log("├── Founder:", deployer.address);
  console.log("└── Parent ID:", COMMUNITY_CONFIG.parentCommunityId);

  console.log("\n🏛️ GOVERNANCE INFRASTRUCTURE:");
  console.log("├── Governor:", governorAddress);
  console.log("├── Timelock:", timelockAddress);
  console.log("├── MembershipToken:", membershipTokenAddress);
  console.log("└── ValuableActionRegistry:", valuableActionRegistryAddress);

  console.log("\n📋 FOUNDER NEXT STEPS:");
  console.log("=".repeat(40));
  console.log("1. 📝 Create initial ValuableActions via governance");
  console.log("2. 👥 Invite community members and distribute tokens");
  console.log("3. 💬 Post first request in RequestHub");
  console.log("4. 📄 Create first draft with governance proposals");
  console.log("5. 🗳️ Conduct first governance vote");
  console.log("6. 🎖️ Start worker verification through Engagements system");

  console.log("\n🔗 USEFUL COMMANDS:");
  console.log(`// Connect to community contracts`);
  console.log(
    `const governor = await ethers.getContractAt("ShiftGovernor", "${governorAddress}");`,
  );
  console.log(
    `const membershipToken = await ethers.getContractAt("MembershipTokenERC20Votes", "${membershipTokenAddress}");`,
  );
  console.log(
    `const communityRegistry = await ethers.getContractAt("CommunityRegistry", "${COMMUNITY_REGISTRY_ADDRESS}");`,
  );

  console.log("\n💾 SAVE THESE ADDRESSES FOR UI:");
  const addressesForUI = {
    communityId: communityId?.toString(),
    communityRegistry: COMMUNITY_REGISTRY_ADDRESS,
    communityFactory: COMMUNITY_FACTORY_ADDRESS,
    governor: governorAddress,
    timelock: timelockAddress,
    membershipToken: membershipTokenAddress,
    valuableActionRegistry: valuableActionRegistryAddress,
  };

  console.log(JSON.stringify(addressesForUI, null, 2));

  return addressesForUI;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

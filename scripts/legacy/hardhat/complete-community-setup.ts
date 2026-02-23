import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";
import { Roles } from "../../roles";

/**
 * Continue Community Setup - Complete the setup that failed
 */

async function main() {
  const addresses = JSON.parse(
    readFileSync(join(__dirname, "deployed-addresses.json"), "utf8"),
  );
  const [deployer] = await ethers.getSigners();

  const accessManagerAddress =
    addresses.accessManager ?? process.env.ACCESS_MANAGER ?? "";
  if (!accessManagerAddress) {
    throw new Error("AccessManager address missing (add to deployed-addresses.json or set ACCESS_MANAGER)");
  }
  const accessManager = await ethers.getContractAt(
    "AccessManager",
    accessManagerAddress,
  );

  console.log("🔧 Continuing Community Setup...");
  console.log("Deployer:", deployer.address);

  // Community contract addresses (from the previous successful deployment)
  const communityAddresses = {
    communityId: 1,
    governor: "0x42362f0f2Cdd96902848e21d878927234C5C9425",
    timelock: "0xF140d690BadDf50C3a1006AD587298Eed61ADCfA",
    membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
    valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
    engagements: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
    verifierPool: "0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B",
    workerSBT: "0x8dA98a7ab4c487CFeD390c4C41c411213b1A6562",
    requestHub: "0xc7d1d9db153e45f14ef3EbD86f02e986F1a18eCA",
    draftsManager: "0xdd90c64f78D82cc6FD60DF756d96EFd6F4395c07",
    communityToken: "0x9352b89B39D7b0e6255935A8053Df37393013371",
  };

  // Connect to contracts
  const communityRegistry = await ethers.getContractAt(
    "CommunityRegistry",
    addresses.communityRegistry,
  );
  const governor = await ethers.getContractAt(
    "ShiftGovernor",
    communityAddresses.governor,
  );
  const timelock = await ethers.getContractAt(
    "TimelockController",
    communityAddresses.timelock,
  );
  const membershipToken = await ethers.getContractAt(
    "MembershipTokenERC20Votes",
    communityAddresses.membershipToken,
  );
  const engagements = await ethers.getContractAt(
    "Engagements",
    communityAddresses.engagements,
  );
  const verifierPool = await ethers.getContractAt(
    "VerifierPool",
    communityAddresses.verifierPool,
  );
  const workerSBT = await ethers.getContractAt(
    "WorkerSBT",
    communityAddresses.workerSBT,
  );
  const accessManagerAddressForLog = await accessManager.getAddress();
  console.log("AccessManager:", accessManagerAddressForLog);

  console.log("✅ Connected to all contracts");

  // =================================================================
  // STEP 1: Set Module Addresses in Registry (try one by one)
  // =================================================================

  console.log("\n🔧 Setting module addresses in registry...");

  const moduleUpdates = [
    { key: "governor", address: communityAddresses.governor },
    { key: "timelock", address: communityAddresses.timelock },
    { key: "membershipToken", address: communityAddresses.membershipToken },
    { key: "requestHub", address: communityAddresses.requestHub },
    { key: "draftsManager", address: communityAddresses.draftsManager },
    { key: "engagementsManager", address: communityAddresses.engagements },
    {
      key: "valuableActionRegistry",
      address: communityAddresses.valuableActionRegistry,
    },
    { key: "verifierPool", address: communityAddresses.verifierPool },
    { key: "workerSBT", address: communityAddresses.workerSBT },
    { key: "communityToken", address: communityAddresses.communityToken },
  ];

  for (const module of moduleUpdates) {
    try {
      console.log(`📝 Setting ${module.key}...`);
      const keyHash = ethers.keccak256(ethers.toUtf8Bytes(module.key));
      await communityRegistry.setModuleAddress(
        communityAddresses.communityId,
        keyHash,
        module.address,
      );
      console.log(`✅ ${module.key} set successfully`);
    } catch (error) {
      console.log(`❌ Failed to set ${module.key}:`, error.message);
    }
  }

  // =================================================================
  // STEP 2: Setup Governance Permissions
  // =================================================================

  console.log("\n=== SETTING UP PERMISSIONS ===");

  try {
    // Grant governor roles on timelock
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();

    console.log("\n🔐 Setting up timelock permissions...");

    const hasProposerRole = await timelock.hasRole(
      PROPOSER_ROLE,
      communityAddresses.governor,
    );
    if (!hasProposerRole) {
      await timelock.grantRole(PROPOSER_ROLE, communityAddresses.governor);
      console.log("✅ Governor granted PROPOSER_ROLE");
    } else {
      console.log("✅ Governor already has PROPOSER_ROLE");
    }

    const hasExecutorRole = await timelock.hasRole(
      EXECUTOR_ROLE,
      communityAddresses.governor,
    );
    if (!hasExecutorRole) {
      await timelock.grantRole(EXECUTOR_ROLE, communityAddresses.governor);
      console.log("✅ Governor granted EXECUTOR_ROLE");
    } else {
      console.log("✅ Governor already has EXECUTOR_ROLE");
    }
  } catch (error) {
    console.log("❌ Error setting timelock permissions:", error.message);
  }

  try {
    // Setup CountingMultiChoice connection
    console.log("\n🗳️ Setting up multi-choice voting...");
    const currentMultiCounter = await governor.multiCounter();

    if (currentMultiCounter === ethers.ZeroAddress) {
      await governor.initCountingMulti(addresses.countingMultiChoice);
      console.log("✅ CountingMultiChoice connected to governor");
    } else {
      console.log(
        "✅ CountingMultiChoice already connected:",
        currentMultiCounter,
      );
    }
  } catch (error) {
    console.log("❌ Error setting CountingMultiChoice:", error.message);
  }

  try {
    // Grant minter role to Engagements contract
    console.log("\n🪙 Setting up token minting permissions...");
    const MINTER_ROLE = await membershipToken.MINTER_ROLE();

    const hasMinterRole = await accessManager.hasRole(
      MINTER_ROLE,
      communityAddresses.engagements,
    );
    if (!hasMinterRole) {
      await accessManager.grantRole(
        MINTER_ROLE,
        communityAddresses.engagements,
        0,
      );
      console.log("✅ Engagements contract granted minter role");
    } else {
      console.log("✅ Engagements already has minter role");
    }
  } catch (error) {
    console.log("❌ Error setting minter permissions:", error.message);
  }

  try {
    // Update WorkerSBT manager to Engagements
    console.log("\n🎖️ Setting up WorkerSBT permissions...");
    const MANAGER_ROLE = Roles.VALUABLE_ACTION_SBT_MANAGER_ROLE;

    const hasManagerRole = await accessManager.hasRole(
      MANAGER_ROLE,
      communityAddresses.engagements,
    );
    if (!hasManagerRole) {
      await accessManager.grantRole(
        MANAGER_ROLE,
        communityAddresses.engagements,
        0,
      );
      console.log("✅ Engagements contract granted WorkerSBT manager role");
    } else {
      console.log("✅ Engagements already has WorkerSBT manager role");
    }
  } catch (error) {
    console.log("❌ Error setting WorkerSBT permissions:", error.message);
  }

  try {
    // Set VerifierPool engagements contract (legacy hook)
    console.log("\n👥 Setting up VerifierPool...");
    const currentClaimsContract = await verifierPool.claimsContract();

    if (currentClaimsContract === ethers.ZeroAddress) {
      await verifierPool.setClaimsContract(communityAddresses.engagements);
      console.log("✅ VerifierPool connected to Engagements");
    } else {
      console.log(
        "✅ VerifierPool already connected to:",
        currentClaimsContract,
      );
    }
  } catch (error) {
    console.log("❌ Error setting VerifierPool:", error.message);
  }

  // =================================================================
  // STEP 3: Founder Bootstrap
  // =================================================================

  console.log("\n=== FOUNDER BOOTSTRAP ===");

  try {
    const FOUNDER_INITIAL_TOKENS = ethers.parseEther("10000");

    console.log("\n🪙 Checking founder token balance...");
    const currentBalance = await membershipToken.balanceOf(deployer.address);

    if (currentBalance < FOUNDER_INITIAL_TOKENS) {
      console.log("Minting initial tokens to founder...");
      await membershipToken.mint(
        deployer.address,
        FOUNDER_INITIAL_TOKENS - currentBalance,
      );
    } else {
      console.log("Founder already has sufficient tokens");
    }

    // Delegate voting power to self
    const currentDelegate = await membershipToken.delegates(deployer.address);
    if (currentDelegate !== deployer.address) {
      console.log("Delegating voting power to self...");
      await membershipToken.delegate(deployer.address);
    }

    const founderBalance = await membershipToken.balanceOf(deployer.address);
    const votingPower = await membershipToken.getVotes(deployer.address);

    console.log("✅ Founder tokens:", ethers.formatEther(founderBalance));
    console.log("✅ Founder voting power:", ethers.formatEther(votingPower));
  } catch (error) {
    console.log("❌ Error in founder bootstrap:", error.message);
  }

  try {
    // Renounce temporary admin roles
    console.log("\n🔐 Checking timelock admin status...");
    const DEFAULT_ADMIN_ROLE = await timelock.DEFAULT_ADMIN_ROLE();
    const hasTimelockAdmin = await timelock.hasRole(
      DEFAULT_ADMIN_ROLE,
      deployer.address,
    );

    if (hasTimelockAdmin) {
      console.log("Renouncing timelock admin role...");
      await timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
      console.log("✅ Renounced timelock admin role");
    } else {
      console.log("✅ Already renounced timelock admin role");
    }
  } catch (error) {
    console.log("❌ Error renouncing admin role:", error.message);
  }

  // =================================================================
  // FINAL STATUS CHECK
  // =================================================================

  console.log("\n🎉 COMMUNITY SETUP COMPLETED");
  console.log("=".repeat(50));

  console.log("\n📋 FINAL STATUS:");
  console.log("├── Community ID:", communityAddresses.communityId);
  console.log("├── Founder:", deployer.address);
  console.log(
    "├── Balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
  );
  console.log("└── Network:", (await ethers.provider.getNetwork()).name);

  console.log("\n🏛️ GOVERNANCE READY:");
  console.log("├── Governor:", communityAddresses.governor);
  console.log("├── Timelock:", communityAddresses.timelock);
  console.log("├── MembershipToken:", communityAddresses.membershipToken);
  console.log("└── CountingMultiChoice:", addresses.countingMultiChoice);

  console.log("\n💾 COMPLETE ADDRESS SET:");
  console.log(
    JSON.stringify(
      {
        ...communityAddresses,
        communityRegistry: addresses.communityRegistry,
        countingMultiChoice: addresses.countingMultiChoice,
      },
      null,
      2,
    ),
  );

  return communityAddresses;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

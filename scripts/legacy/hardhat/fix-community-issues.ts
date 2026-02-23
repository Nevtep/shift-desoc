import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Fix remaining issues from community setup
 */

async function main() {
  const addresses = JSON.parse(
    readFileSync(join(__dirname, "deployed-addresses.json"), "utf8"),
  );
  const [deployer] = await ethers.getSigners();

  console.log("🔧 Fixing remaining community setup issues...");
  console.log("Deployer:", deployer.address);

  // Community contract addresses
  const communityId = 1;
  const communityAddresses = {
    governor: "0x42362f0f2Cdd96902848e21d878927234C5C9425",
    timelock: "0xF140d690BadDf50C3a1006AD587298Eed61ADCfA",
    membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
    valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
    claims: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
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
  const membershipToken = await ethers.getContractAt(
    "MembershipTokenERC20Votes",
    communityAddresses.membershipToken,
  );
  const verifierPool = await ethers.getContractAt(
    "VerifierPool",
    communityAddresses.verifierPool,
  );

  // =================================================================
  // FIX 1: Debug setModuleAddress issues
  // =================================================================

  console.log("\n🔍 Debugging setModuleAddress issues...");

  // Check if these modules are already set
  const membershipTokenKey = ethers.keccak256(
    ethers.toUtf8Bytes("membershipToken"),
  );
  const valuableActionRegistryKey = ethers.keccak256(
    ethers.toUtf8Bytes("valuableActionRegistry"),
  );

  try {
    const existingMembershipToken = await communityRegistry.getModuleAddress(
      communityId,
      membershipTokenKey,
    );
    console.log(
      "Current membershipToken in registry:",
      existingMembershipToken,
    );

    if (existingMembershipToken === ethers.ZeroAddress) {
      console.log("Trying to set membershipToken...");
      const tx = await communityRegistry.setModuleAddress(
        communityId,
        membershipTokenKey,
        communityAddresses.membershipToken,
      );
      await tx.wait();
      console.log("✅ MembershipToken set successfully");
    } else {
      console.log("✅ MembershipToken already set");
    }
  } catch (error: any) {
    console.log("❌ MembershipToken set failed:", error.message);
  }

  try {
    const existingRegistry = await communityRegistry.getModuleAddress(
      communityId,
      valuableActionRegistryKey,
    );
    console.log(
      "Current valuableActionRegistry in registry:",
      existingRegistry,
    );

    if (existingRegistry === ethers.ZeroAddress) {
      console.log("Trying to set valuableActionRegistry...");
      const tx = await communityRegistry.setModuleAddress(
        communityId,
        valuableActionRegistryKey,
        communityAddresses.valuableActionRegistry,
      );
      await tx.wait();
      console.log("✅ ValuableActionRegistry set successfully");
    } else {
      console.log("✅ ValuableActionRegistry already set");
    }
  } catch (error: any) {
    console.log("❌ ValuableActionRegistry set failed:", error.message);
  }

  // =================================================================
  // FIX 2: VerifierPool setClaimsContract
  // =================================================================

  console.log("\n🔧 Fixing VerifierPool...");

  try {
    const currentClaims = await verifierPool.claimsContract();
    console.log("Current Claims contract in VerifierPool:", currentClaims);

    if (currentClaims === ethers.ZeroAddress) {
      console.log("Setting Claims contract...");
      const tx = await verifierPool.setClaimsContract(
        communityAddresses.claims,
      );
      await tx.wait();
      console.log("✅ VerifierPool Claims contract set");
    } else {
      console.log("✅ VerifierPool Claims already set");
    }
  } catch (error: any) {
    console.log("❌ VerifierPool setClaimsContract failed:", error.message);
  }

  // =================================================================
  // FIX 3: Founder token minting (using safe mint)
  // =================================================================

  console.log("\n🪙 Fixing founder token minting...");

  try {
    const MINTER_ROLE = await membershipToken.MINTER_ROLE();
    const hasMinterRole = await membershipToken.hasRole(
      MINTER_ROLE,
      deployer.address,
    );

    if (!hasMinterRole) {
      console.log("Granting minter role to deployer...");
      await membershipToken.grantRole(MINTER_ROLE, deployer.address);
    }

    const currentBalance = await membershipToken.balanceOf(deployer.address);
    const targetBalance = ethers.parseEther("10000");

    console.log("Current balance:", ethers.formatEther(currentBalance));
    console.log("Target balance:", ethers.formatEther(targetBalance));

    if (currentBalance < targetBalance) {
      const amountToMint = targetBalance - currentBalance;
      console.log("Minting amount:", ethers.formatEther(amountToMint));

      // Use safeMint instead of mint
      const tx = await membershipToken.safeMint(deployer.address, amountToMint);
      await tx.wait();
      console.log("✅ Tokens minted successfully");
    } else {
      console.log("✅ Founder already has sufficient tokens");
    }

    // Delegate voting power
    const currentDelegate = await membershipToken.delegates(deployer.address);
    if (currentDelegate !== deployer.address) {
      console.log("Delegating voting power...");
      const tx = await membershipToken.delegate(deployer.address);
      await tx.wait();
      console.log("✅ Voting power delegated");
    }

    // Final balances
    const finalBalance = await membershipToken.balanceOf(deployer.address);
    const votingPower = await membershipToken.getVotes(deployer.address);

    console.log("✅ Final token balance:", ethers.formatEther(finalBalance));
    console.log("✅ Final voting power:", ethers.formatEther(votingPower));
  } catch (error: any) {
    console.log("❌ Token minting error:", error.message);
  }

  // =================================================================
  // FINAL VERIFICATION
  // =================================================================

  console.log("\n🎉 FINAL VERIFICATION");
  console.log("=".repeat(50));

  // Check all module addresses
  const moduleKeys = [
    "governor",
    "timelock",
    "membershipToken",
    "requestHub",
    "draftsManager",
    "claimsManager",
    "valuableActionRegistry",
    "verifierPool",
    "workerSBT",
    "communityToken",
  ];

  console.log("\n📋 Module Address Status:");
  for (const key of moduleKeys) {
    try {
      const keyHash = ethers.keccak256(ethers.toUtf8Bytes(key));
      const address = await communityRegistry.getModuleAddress(
        communityId,
        keyHash,
      );
      const status = address === ethers.ZeroAddress ? "❌ NOT SET" : "✅ SET";
      console.log(`├── ${key}: ${status} (${address})`);
    } catch (error) {
      console.log(`├── ${key}: ❌ ERROR`);
    }
  }

  // Check governance readiness
  console.log("\n🏛️ Governance Status:");
  try {
    const proposalThreshold = await ethers
      .getContractAt("ShiftGovernor", communityAddresses.governor)
      .then((g) => g.proposalThreshold());
    const votingDelay = await ethers
      .getContractAt("ShiftGovernor", communityAddresses.governor)
      .then((g) => g.votingDelay());
    const votingPeriod = await ethers
      .getContractAt("ShiftGovernor", communityAddresses.governor)
      .then((g) => g.votingPeriod());

    console.log(
      "├── Proposal threshold:",
      ethers.formatEther(proposalThreshold),
    );
    console.log("├── Voting delay:", votingDelay.toString(), "blocks");
    console.log("└── Voting period:", votingPeriod.toString(), "blocks");
  } catch (error) {
    console.log("❌ Error checking governance parameters");
  }

  console.log("\n💰 Economic Status:");
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  const tokenBalance = await membershipToken.balanceOf(deployer.address);
  const votingPower = await membershipToken.getVotes(deployer.address);

  console.log("├── ETH Balance:", ethers.formatEther(ethBalance));
  console.log("├── MembershipToken Balance:", ethers.formatEther(tokenBalance));
  console.log("└── Voting Power:", ethers.formatEther(votingPower));

  return {
    communityId,
    addresses: communityAddresses,
    registry: addresses.communityRegistry,
    countingMultiChoice: addresses.countingMultiChoice,
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

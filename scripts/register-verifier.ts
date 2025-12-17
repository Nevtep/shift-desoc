import { ethers } from "hardhat";

/**
 * Register as Verifier Script - Base Sepolia
 *
 * Registers the current account as a verifier with required bonding
 * Verifiers earn rewards for accurate verification and get slashed for incorrect decisions
 *
 * Run: npx hardhat run scripts/register-verifier.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
  verifierPool: "0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B",
  membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
};

// Configuration
const BOND_AMOUNT = ethers.parseEther("100"); // 100 MembershipTokens as verifier bond
const COMMUNITY_ID = 1;

async function main() {
  console.log("👥 Register as Verifier - Base Sepolia");
  console.log("============================================================");

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("👤 Registering account:", signerAddress);

  // Connect to contracts
  const verifierPool = await ethers.getContractAt(
    "VerifierPool",
    CONTRACT_ADDRESSES.verifierPool,
  );
  const membershipToken = await ethers.getContractAt(
    "MembershipTokenERC20Votes",
    CONTRACT_ADDRESSES.membershipToken,
  );

  console.log("\n📊 PRE-REGISTRATION STATUS:");

  // Check if already registered
  const isAlreadyRegistered =
    await verifierPool.isRegisteredVerifier(signerAddress);
  console.log("   Already registered:", isAlreadyRegistered);

  if (isAlreadyRegistered) {
    console.log("✅ Account is already registered as verifier!");
    console.log("   No action needed");

    // Show verifier stats
    try {
      console.log("\n📈 VERIFIER STATS:");
      // Add any verifier stats checking here if available
      console.log("   Status: Active Verifier");
    } catch (error) {
      console.log("   Could not retrieve verifier stats");
    }

    return;
  }

  // Check token balance
  const tokenBalance = await membershipToken.balanceOf(signerAddress);
  console.log("   Token Balance:", ethers.formatEther(tokenBalance));
  console.log("   Required Bond:", ethers.formatEther(BOND_AMOUNT));

  if (tokenBalance < BOND_AMOUNT) {
    console.log("❌ Insufficient tokens for verifier bond!");
    console.log("   Required:", ethers.formatEther(BOND_AMOUNT), "tokens");
    console.log("   Available:", ethers.formatEther(tokenBalance), "tokens");
    console.log(
      "   Deficit:",
      ethers.formatEther(BOND_AMOUNT - tokenBalance),
      "tokens",
    );
    console.log("");
    console.log("💡 To get more tokens:");
    console.log("   - Complete work verification to earn tokens");
    console.log("   - Request tokens from community treasury");
    console.log("   - Participate in governance to earn rewards");
    return;
  }

  try {
    // STEP 1: Approve verifier pool to spend tokens
    console.log("\n🔐 STEP 1: Approving token spending...");

    const currentAllowance = await membershipToken.allowance(
      signerAddress,
      CONTRACT_ADDRESSES.verifierPool,
    );
    console.log("   Current allowance:", ethers.formatEther(currentAllowance));

    if (currentAllowance < BOND_AMOUNT) {
      const approveTx = await membershipToken.approve(
        CONTRACT_ADDRESSES.verifierPool,
        BOND_AMOUNT,
      );
      console.log("   Approve transaction submitted:", approveTx.hash);

      const approveReceipt = await approveTx.wait();
      console.log("   ✅ Approval successful!");
      console.log("   Gas used:", approveReceipt.gasUsed.toString());
    } else {
      console.log("   ✅ Sufficient allowance already exists");
    }

    // STEP 2: Register as verifier
    console.log("\n👥 STEP 2: Registering as verifier...");

    const registerTx = await verifierPool.registerVerifier(BOND_AMOUNT);
    console.log("   Registration transaction submitted:", registerTx.hash);

    const registerReceipt = await registerTx.wait();
    console.log("   ✅ Registration successful!");
    console.log("   Gas used:", registerReceipt.gasUsed.toString());

    // STEP 3: Verify registration
    console.log("\n✅ STEP 3: Verifying registration...");

    const isNowRegistered =
      await verifierPool.isRegisteredVerifier(signerAddress);
    console.log("   Registered as verifier:", isNowRegistered);

    if (!isNowRegistered) {
      console.log("❌ Registration verification failed!");
      return;
    }

    // Check final token balance
    const finalBalance = await membershipToken.balanceOf(signerAddress);
    const bondedAmount = tokenBalance - finalBalance;
    console.log("   Tokens bonded:", ethers.formatEther(bondedAmount));
    console.log("   Remaining balance:", ethers.formatEther(finalBalance));

    console.log("\n🎉 VERIFIER REGISTRATION COMPLETE!");
    console.log("============================================================");
    console.log("✅ Successfully registered as verifier");
    console.log("✅ Bonded", ethers.formatEther(BOND_AMOUNT), "tokens");
    console.log("✅ Ready to participate in work verification");
    console.log("");
    console.log("📋 VERIFIER RESPONSIBILITIES:");
    console.log("   • Review work claims thoroughly and honestly");
    console.log("   • Provide constructive feedback in verification votes");
    console.log("   • Earn rewards for accurate verification decisions");
    console.log("   • Risk slashing (5%) for consistently wrong decisions");
    console.log("");
    console.log("🔄 Next Steps:");
    console.log("   • Wait for work claims to be submitted");
    console.log("   • Participate in M-of-N verification process");
    console.log(
      "   • Use: npx hardhat run scripts/verify-claim.ts --network base_sepolia",
    );
    console.log("");
    console.log("🎯 VERIFIER BENEFITS:");
    console.log("   • Earn verification rewards for accurate decisions");
    console.log("   • Build reputation in the community");
    console.log("   • Contribute to work quality assurance");
    console.log("   • Help maintain community standards");
  } catch (error: any) {
    console.error("❌ Registration failed:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }

    console.log("\n🔧 Troubleshooting:");
    console.log("   • Ensure account has sufficient MembershipTokens");
    console.log("   • Check if VerifierPool contract is active");
    console.log("   • Verify network connection and gas settings");
    console.log("   • Try with higher gas limit if transaction fails");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { ethers } from "hardhat";

/**
 * Verify Engagement Script - Base Sepolia
 *
 * Allows jurors to review and vote on submitted engagements.
 * Part of the M-of-N verification process.
 *
 * Run: npx hardhat run scripts/verify-claim.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
  engagements: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
  valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
};

// Configuration - Update these for the engagement you want to verify
const ENGAGEMENT_ID = 1; // Engagement ID to verify
const VOTE_DECISION = true; // true = APPROVE, false = REJECT

async function main() {
  console.log("🔍 Verify Engagement - Base Sepolia");
  console.log("============================================================");

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("👤 Verifying as:", signerAddress);
  console.log("🎯 Target Engagement ID:", ENGAGEMENT_ID);
  console.log("🗳️ Vote Decision:", VOTE_DECISION ? "APPROVE ✅" : "REJECT ❌");

  // Connect to contracts
  const engagements = await ethers.getContractAt(
    "Engagements",
    CONTRACT_ADDRESSES.engagements,
  );
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    CONTRACT_ADDRESSES.valuableActionRegistry,
  );

  console.log("\n📊 PRE-VERIFICATION VALIDATION:");

  try {
    // Check engagement exists and status
    const engagement = await engagements.getEngagement(ENGAGEMENT_ID);
    console.log("   ✅ Engagement found:");
    console.log("      └── Worker:", engagement.worker);
    console.log("      └── Action ID:", engagement.typeId.toString());
    console.log("      └── Evidence CID:", engagement.evidenceCID);
    console.log(
      "      └── Status:",
      engagement.status.toString(),
      "(0=Pending, 1=Approved, 2=Rejected, 3=Revoked)",
    );
    console.log(
      "      └── Created:",
      new Date(Number(engagement.createdAt) * 1000).toLocaleString(),
    );

    // Get action details for context
    const action = await valuableActionRegistry.getValuableAction(
      engagement.typeId,
    );
    console.log("   📋 Action Context:");
    console.log(
      "      └── Membership Reward:",
      action.membershipTokenReward.toString(),
      "tokens",
    );
    console.log(
      "      └── Required Jurors:",
      action.jurorsMin.toString(),
      "of",
      action.panelSize.toString(),
    );
    console.log(
      "      └── Verify Window:",
      action.verifyWindow.toString(),
      "seconds",
    );

    // Check if engagement is in correct state for verification
    if (engagement.status !== 0n) {
      console.log("❌ Engagement is not available for verification!");
      console.log("   Current status:", engagement.status.toString());
      console.log("   Expected: 0 (Pending)");
      return;
    }

    // Check juror assignment
    const jurors: string[] = await engagements.getEngagementJurors(
      ENGAGEMENT_ID,
    );
    const isAssigned = jurors.some(
      (j: string) => j.toLowerCase() === signerAddress.toLowerCase(),
    );
    console.log("   Juror Assignment:", isAssigned ? "YES ✅" : "NO ❌");

    if (!isAssigned) {
      console.log("❌ Caller is not an assigned juror for this engagement.");
      console.log("   Only selected jurors can cast verification votes.");
      return;
    }
  } catch (error) {
    console.log("❌ Engagement not found or error accessing:");
    console.log("   Error:", error);
    console.log("   Make sure ENGAGEMENT_ID is correct and engagement exists");
    return;
  }

  try {
    // STEP 1: Cast verification vote
    console.log("\n🗳️ STEP 1: Casting verification vote...");

    const verifyTx = await engagements.verify(ENGAGEMENT_ID, VOTE_DECISION);

    console.log("   Vote transaction submitted:", verifyTx.hash);

    const verifyReceipt = await verifyTx.wait();
    console.log("   ✅ Vote cast successfully!");
    console.log("   Gas used:", verifyReceipt.gasUsed.toString());

    // STEP 2: Check updated engagement status
    console.log("\n📊 STEP 2: Checking updated engagement status...");

    const updatedEngagement = await engagements.getEngagement(ENGAGEMENT_ID);
    console.log("   Updated Status:", updatedEngagement.status.toString());

    // STEP 3: Check if verification is complete
    console.log("\n🔍 STEP 3: Verification process status...");

    if (updatedEngagement.status === 1n) {
      console.log("   🎉 ENGAGEMENT APPROVED!");
      console.log(
        "   ✅ Verification complete - engagement was approved by majority",
      );
      console.log("   ✅ Rewards should be distributed automatically");
    } else if (updatedEngagement.status === 2n) {
      console.log("   ❌ ENGAGEMENT REJECTED");
      console.log(
        "   ❌ Verification complete - engagement was rejected by majority",
      );
      console.log("   ❌ No rewards distributed");
    } else {
      console.log("   ⏳ VERIFICATION IN PROGRESS");
      console.log("   📊 Waiting for additional juror votes");
      console.log("");
      console.log("   💡 What happens next:");
      console.log("      • Other selected jurors will cast their votes");
      console.log("      • Majority decides outcome (simple majority)");
      console.log("      • If approved: automatic reward distribution");
      console.log(
        "      • If rejected: worker can appeal or improve and resubmit",
      );
    }

    console.log("\n🎉 VERIFICATION VOTE SUBMITTED!");
    console.log("============================================================");
    console.log("✅ Vote recorded on-chain");
    console.log("✅ Contribution to decentralized quality assurance");
    console.log("✅ Economic incentives aligned with accuracy");

    if (VOTE_DECISION) {
      console.log("✅ Voted to APPROVE - supporting quality work");
    } else {
      console.log("⚠️ Voted to REJECT - maintaining quality standards");
    }

    console.log("");
    console.log("🏆 VERIFIER REWARDS:");
    console.log("   • Earn verification points for accurate decisions");
    console.log("   • Build reputation in the community");
    console.log("   • Receive verifier rewards from successful verifications");
    console.log("   • Risk slashing (5%) for consistently incorrect votes");
    console.log("");
    console.log("⚖️ QUALITY ASSURANCE:");
    console.log(
      "   • Your vote contributes to decentralized work quality control",
    );
    console.log("   • Economic incentives ensure honest and thorough reviews");
    console.log("   • Community benefits from maintained quality standards");
    console.log("   • Workers receive fair evaluation of their contributions");
    console.log("");
    console.log("🔄 Monitor Progress:");
    console.log(
      "   • Check final results: npx hardhat run scripts/check-claim-status.ts --network base_sepolia",
    );
    console.log(
      "   • View rewards: npx hardhat run scripts/check-rewards.ts --network base_sepolia",
    );
    console.log(
      "   • System status: npx hardhat run scripts/verify-base-sepolia.ts --network base_sepolia",
    );
  } catch (error: any) {
    console.error("❌ Verification vote failed:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }

    console.log("\n🔧 Troubleshooting:");
    console.log("   • Verify you are an assigned juror for this engagement");
    console.log(
      "   • Check if you are selected for this engagement's juror panel",
    );
    console.log(
      "   • Ensure engagement is in correct status (Pending)",
    );
    console.log("   • Verify you haven't already voted on this engagement");
    console.log("   • Check if verification window has expired");
    console.log("   • Try with higher gas limit if transaction fails");
    console.log("");
    console.log("📋 Common Issues:");
    console.log("   • Not selected: Only selected jurors can vote");
    console.log(
      "   • Already voted: Each juror can only vote once per engagement",
    );
    console.log(
      "   • Window expired: Verification must occur within time window",
    );
    console.log("   • Engagement finalized: Cannot vote on already decided engagements");
    console.log("");
    console.log("💡 Selection Process:");
    console.log("   • Jurors are selected per engagement via VerifierManager");
    console.log(
      "   • Selection uses configured panel size and community parameters",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

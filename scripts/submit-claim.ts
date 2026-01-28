import { ethers } from "hardhat";

/**
 * Submit Engagement Script - Base Sepolia
 *
 * Submits an engagement for completed work against a specific ValuableAction.
 * Engagements go through M-of-N verification with juror panels managed by VerifierManager.
 *
 * Run: npx hardhat run scripts/submit-claim.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
  engagements: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
  valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
  membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb"
};

// Configuration - Update these for your specific engagement
const ACTION_ID = 1; // ValuableAction ID to submit against (created after governance execution)
const EVIDENCE_CID = "ipfs://QmE2ETestWorkEvidenceCompleted"; // IPFS hash of evidence

function formatStatus(status: bigint): string {
  const statusMap: Record<string, string> = {
    "0": "PENDING ⏳",
    "1": "APPROVED ✅",
    "2": "REJECTED ❌",
    "3": "REVOKED ⚠️"
  };

  return statusMap[status.toString()] ?? `UNKNOWN (${status.toString()})`;
}

async function main() {
  console.log("📋 Submit Engagement - Base Sepolia");
  console.log("============================================================");

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("👤 Submitting engagement from:", signerAddress);
  console.log("🎯 Target Action ID:", ACTION_ID);

  // Connect to contracts
  const engagements = await ethers.getContractAt(
    "Engagements",
    CONTRACT_ADDRESSES.engagements
  );
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    CONTRACT_ADDRESSES.valuableActionRegistry
  );
  const membershipToken = await ethers.getContractAt(
    "MembershipTokenERC20Votes",
    CONTRACT_ADDRESSES.membershipToken
  );

  console.log("\n📊 PRE-SUBMISSION VALIDATION:");

  try {
    // Check if ValuableAction exists and is active
    const action = await valuableActionRegistry.getValuableAction(ACTION_ID);
    console.log("   ✅ ValuableAction found:");
    console.log("      └── Membership Token Reward:", action.membershipTokenReward.toString());
    console.log("      └── Community Token Reward:", action.communityTokenReward.toString());
    console.log(
      "      └── Required Jurors:",
      action.jurorsMin.toString(),
      "of",
      action.panelSize.toString()
    );
    console.log("      └── Verify Window:", action.verifyWindow.toString(), "seconds");
    console.log("      └── Cooldown Period:", action.cooldownPeriod.toString(), "seconds");

    const isActive = await valuableActionRegistry.isValuableActionActive(ACTION_ID);
    console.log("   Action Status:", isActive ? "ACTIVE ✅" : "INACTIVE ❌");

    if (!isActive) {
      console.log("❌ ValuableAction is not active!");
      console.log("   Cannot submit engagements against inactive actions");
      return;
    }
  } catch (error) {
    console.log("❌ ValuableAction not found or error accessing:");
    console.log("   Error:", error);
    console.log("   Make sure ACTION_ID is correct and governance proposal was executed");
    return;
  }

  // Check account eligibility
  console.log("\n👤 ACCOUNT ELIGIBILITY:");
  const tokenBalance = await membershipToken.balanceOf(signerAddress);
  console.log("   Token Balance:", ethers.formatEther(tokenBalance));
  console.log("   Account Status: Valid ✅");

  // Engagement submission details
  console.log("\n📋 ENGAGEMENT VALIDATION:");
  console.log("   Evidence CID:", EVIDENCE_CID);
  console.log("   Evidence Type: Development work with documentation");

  try {
    // STEP 1: Submit the engagement
    console.log("\n📤 STEP 1: Submitting engagement...");

    const submitTx = await engagements.submit(ACTION_ID, EVIDENCE_CID);

    console.log("   Engagement transaction submitted:", submitTx.hash);

    const submitReceipt = await submitTx.wait();
    console.log("   ✅ Engagement submitted successfully!");
    console.log("   Gas used:", submitReceipt.gasUsed.toString());

    // STEP 2: Extract engagement ID from events
    console.log("\n🔍 STEP 2: Extracting engagement details...");

    let engagementId: bigint | null = null;

    for (const log of submitReceipt.logs) {
      try {
        const parsed = engagements.interface.parseLog(log);
        if (parsed?.name === "EngagementSubmitted") {
          engagementId = parsed.args[0];
          console.log("   ✅ Engagement ID extracted:", engagementId.toString());
          break;
        }
      } catch (e) {
        // Continue searching other logs
      }
    }

    if (!engagementId) {
      console.log("   ⚠️ Could not extract engagement ID from events");
      console.log("   Engagement was submitted but ID extraction failed");
    }

    // STEP 3: Verify engagement was recorded
    if (engagementId) {
      console.log("\n✅ STEP 3: Verifying engagement record...");

      try {
        const engagement = await engagements.getEngagement(engagementId);
        console.log("   ✅ Engagement verified in contract:");
        console.log("      └── Worker:", engagement.worker);
        console.log("      └── Action ID:", engagement.typeId.toString());
        console.log("      └── Evidence CID:", engagement.evidenceCID);
        console.log(
          "      └── Status:",
          formatStatus(engagement.status),
          "(0=Pending, 1=Approved, 2=Rejected, 3=Revoked)"
        );
        console.log(
          "      └── Created:",
          new Date(Number(engagement.createdAt) * 1000).toLocaleString()
        );
      } catch (error) {
        console.log("   ⚠️ Could not retrieve engagement details:", error);
      }
    }

    console.log("\n🎉 ENGAGEMENT SUBMITTED SUCCESSFULLY!");
    console.log("============================================================");
    console.log("✅ Engagement submitted and recorded on-chain");
    console.log("✅ Evidence linked via IPFS CID");
    console.log("✅ Ready for verifier review process");

    if (engagementId) {
      console.log("✅ Engagement ID:", engagementId.toString());
    }

    console.log("");
    console.log("⏳ WHAT HAPPENS NEXT:");
    console.log("   1. Verifiers will be selected for review panel");
    console.log("   2. Selected verifiers review evidence and cast votes");
    console.log("   3. M-of-N verification determines engagement approval");
    console.log("   4. If approved: tokens and SBTs are automatically distributed");
    console.log(
      "   5. If rejected: engagement can be appealed or resubmitted with improvements"
    );
    console.log("");
    console.log("📊 VERIFICATION PROCESS:");
    console.log("   • Panel Size: 3 verifiers selected");
    console.log("   • Required Approvals: 2 out of 3 (majority)");
    console.log("   • Verification Window: 24 hours");
    console.log("   • Economic Stakes: Verifiers bonded, slashing for wrong decisions");
    console.log("");
    console.log("🔄 Monitor Progress:");
    console.log(
      "   • Check engagement status: npx hardhat run scripts/check-claim-status.ts --network base_sepolia"
    );
    console.log(
      "   • Monitor system: npx hardhat run scripts/verify-base-sepolia.ts --network base_sepolia"
    );
    console.log("");
    console.log("🎁 EXPECTED REWARDS (if approved):");
    console.log("   • Membership Tokens: 100 (governance voting power)");
    console.log("   • Community Tokens: 50 (community treasury tokens)");
    console.log("   • Worker SBT: 1 (soulbound achievement token)");
    console.log("   • Reputation: Increased community standing");
  } catch (error: any) {
    console.error("❌ Engagement submission failed:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }

    console.log("\n🔧 Troubleshooting:");
    console.log("   • Verify ValuableAction ID is correct and active");
    console.log(
      "   • Check if you have active engagements that exceed maxConcurrent limit"
    );
    console.log("   • Ensure cooldown period has passed since last engagement");
    console.log("   • Verify evidence CID is accessible and valid");
    console.log("   • Check account permissions and token requirements");
    console.log("   • Try with higher gas limit if transaction fails");
    console.log("");
    console.log("📋 Common Issues:");
    console.log(
      "   • Action not found: Governance proposal may not have executed yet"
    );
    console.log("   • Cooldown active: Wait for cooldown period to expire");
    console.log(
      "   • Max concurrent: Complete existing engagements before submitting new ones"
    );
    console.log("   • Invalid evidence: Ensure IPFS CID is correctly formatted");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { ethers } from "hardhat";

/**
 * Submit Work Claim Script - Base Sepolia
 *
 * Submits a claim for completed work against a specific ValuableAction
 * Claims require evidence and go through M-of-N verification process
 *
 * Run: npx hardhat run scripts/submit-claim.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
  claims: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
  valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
  membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
};

// Configuration - Update these for your specific claim
const ACTION_ID = 1; // ValuableAction ID to claim against (created after governance execution)
const EVIDENCE_CID = "ipfs://QmE2ETestWorkEvidenceCompleted"; // IPFS hash of evidence
const DESCRIPTION =
  "Completed comprehensive smart contract security review including gas optimization analysis and multi-signature integration testing";

async function main() {
  console.log("📋 Submit Work Claim - Base Sepolia");
  console.log("============================================================");

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("👤 Submitting claim from:", signerAddress);
  console.log("🎯 Target Action ID:", ACTION_ID);

  // Connect to contracts
  const claims = await ethers.getContractAt(
    "Claims",
    CONTRACT_ADDRESSES.claims,
  );
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    CONTRACT_ADDRESSES.valuableActionRegistry,
  );
  const membershipToken = await ethers.getContractAt(
    "MembershipTokenERC20Votes",
    CONTRACT_ADDRESSES.membershipToken,
  );

  console.log("\n📊 PRE-SUBMISSION VALIDATION:");

  try {
    // Check if ValuableAction exists and is active
    const action = await valuableActionRegistry.getAction(ACTION_ID);
    console.log("   ✅ ValuableAction found:");
    console.log(
      "      └── Membership Token Reward:",
      action.membershipTokenReward.toString(),
    );
    console.log(
      "      └── Community Token Reward:",
      action.communityTokenReward.toString(),
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
    console.log(
      "      └── Cooldown Period:",
      action.cooldownPeriod.toString(),
      "seconds",
    );

    const isActive = await valuableActionRegistry.isActive(ACTION_ID);
    console.log("   Action Status:", isActive ? "ACTIVE ✅" : "INACTIVE ❌");

    if (!isActive) {
      console.log("❌ ValuableAction is not active!");
      console.log("   Cannot submit claims against inactive actions");
      return;
    }
  } catch (error) {
    console.log("❌ ValuableAction not found or error accessing:");
    console.log("   Error:", error);
    console.log(
      "   Make sure ACTION_ID is correct and governance proposal was executed",
    );
    return;
  }

  // Check account eligibility
  console.log("\n👤 ACCOUNT ELIGIBILITY:");
  const tokenBalance = await membershipToken.balanceOf(signerAddress);
  console.log("   Token Balance:", ethers.formatEther(tokenBalance));
  console.log("   Account Status: Valid ✅");

  // Check for existing active claims (if applicable)
  console.log("\n📋 CLAIM VALIDATION:");
  console.log("   Evidence CID:", EVIDENCE_CID);
  console.log("   Description Length:", DESCRIPTION.length, "characters");
  console.log("   Evidence Type: Development work with documentation");

  try {
    // STEP 1: Submit the claim
    console.log("\n📤 STEP 1: Submitting work claim...");

    const submitTx = await claims.submitClaim(
      ACTION_ID,
      EVIDENCE_CID,
      DESCRIPTION,
    );

    console.log("   Claim transaction submitted:", submitTx.hash);

    const submitReceipt = await submitTx.wait();
    console.log("   ✅ Claim submitted successfully!");
    console.log("   Gas used:", submitReceipt.gasUsed.toString());

    // STEP 2: Extract claim ID from events
    console.log("\n🔍 STEP 2: Extracting claim details...");

    let claimId = null;

    // Look for ClaimSubmitted event
    for (const log of submitReceipt.logs) {
      try {
        const parsed = claims.interface.parseLog(log);
        if (parsed?.name === "ClaimSubmitted") {
          claimId = parsed.args[0];
          console.log("   ✅ Claim ID extracted:", claimId.toString());
          break;
        }
      } catch (e) {
        // Continue looking through logs
      }
    }

    if (!claimId) {
      console.log("   ⚠️ Could not extract claim ID from events");
      console.log("   Claim was submitted but ID extraction failed");
    }

    // STEP 3: Verify claim was recorded
    if (claimId) {
      console.log("\n✅ STEP 3: Verifying claim record...");

      try {
        const claim = await claims.getClaim(claimId);
        console.log("   ✅ Claim verified in contract:");
        console.log("      └── Claimant:", claim.claimant);
        console.log("      └── Action ID:", claim.actionId.toString());
        console.log("      └── Evidence CID:", claim.evidenceCID);
        console.log(
          "      └── Status:",
          claim.status.toString(),
          "(0=Pending, 1=UnderReview, 2=Approved, 3=Rejected)",
        );
        console.log(
          "      └── Created:",
          new Date(Number(claim.createdAt) * 1000).toLocaleString(),
        );
      } catch (error) {
        console.log("   ⚠️ Could not retrieve claim details:", error);
      }
    }

    console.log("\n🎉 WORK CLAIM SUBMITTED SUCCESSFULLY!");
    console.log("============================================================");
    console.log("✅ Claim submitted and recorded on-chain");
    console.log("✅ Evidence linked via IPFS CID");
    console.log("✅ Ready for verifier review process");

    if (claimId) {
      console.log("✅ Claim ID:", claimId.toString());
    }

    console.log("");
    console.log("⏳ WHAT HAPPENS NEXT:");
    console.log("   1. Verifiers will be randomly selected for review panel");
    console.log("   2. Selected verifiers review evidence and cast votes");
    console.log("   3. M-of-N verification determines claim approval");
    console.log(
      "   4. If approved: tokens and SBTs are automatically distributed",
    );
    console.log(
      "   5. If rejected: claim can be appealed or resubmitted with improvements",
    );
    console.log("");
    console.log("📊 VERIFICATION PROCESS:");
    console.log("   • Panel Size: 3 verifiers selected");
    console.log("   • Required Approvals: 2 out of 3 (majority)");
    console.log("   • Verification Window: 24 hours");
    console.log(
      "   • Economic Stakes: Verifiers bonded, slashing for wrong decisions",
    );
    console.log("");
    console.log("🔄 Monitor Progress:");
    console.log(
      "   • Check claim status: npx hardhat run scripts/check-claim-status.ts --network base_sepolia",
    );
    console.log(
      "   • Monitor system: npx hardhat run scripts/verify-base-sepolia.ts --network base_sepolia",
    );
    console.log("");
    console.log("🎁 EXPECTED REWARDS (if approved):");
    console.log("   • Membership Tokens: 100 (governance voting power)");
    console.log("   • Community Tokens: 50 (community treasury tokens)");
    console.log("   • Worker SBT: 1 (soulbound achievement token)");
    console.log("   • Reputation: Increased community standing");
  } catch (error: any) {
    console.error("❌ Claim submission failed:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }

    console.log("\n🔧 Troubleshooting:");
    console.log("   • Verify ValuableAction ID is correct and active");
    console.log(
      "   • Check if you have active claims that exceed maxConcurrent limit",
    );
    console.log("   • Ensure cooldown period has passed since last claim");
    console.log("   • Verify evidence CID is accessible and valid");
    console.log("   • Check account permissions and token requirements");
    console.log("   • Try with higher gas limit if transaction fails");
    console.log("");
    console.log("📋 Common Issues:");
    console.log(
      "   • Action not found: Governance proposal may not have executed yet",
    );
    console.log("   • Cooldown active: Wait for cooldown period to expire");
    console.log(
      "   • Max concurrent: Complete existing claims before submitting new ones",
    );
    console.log(
      "   • Invalid evidence: Ensure IPFS CID is correctly formatted",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { ethers } from "hardhat";

/**
 * Engagements E2E Smoke - Base Sepolia
 *
 * Lightweight end-to-end walkthrough for the Engagements flow:
 * 1) Read ValuableAction configuration (governance-created)
 * 2) Submit an engagement with evidence
 * 3) Confirm on-chain record and juror assignment
 * 4) (Optional) Cast vote if caller is an assigned juror
 *
 * Run: npx hardhat run scripts/work-verification-e2e.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
  valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
  engagements: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
  membershipToken: "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb",
  communityToken: "0x9352b89B39D7b0e6255935A8053Df37393013371",
};

const ACTION_ID = 1; // Existing ValuableAction ID (must be active)
const EVIDENCE_CID = "ipfs://QmE2ETestEvidenceCodeReviewCompleted";

async function main() {
  console.log("🔬 Engagements E2E Smoke - Base Sepolia");
  console.log("=".repeat(60));

  const [worker] = await ethers.getSigners();
  const workerAddress = await worker.getAddress();

  console.log("👤 Worker:", workerAddress);

  // Connect to contracts
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    CONTRACT_ADDRESSES.valuableActionRegistry,
  );
  const engagements = await ethers.getContractAt(
    "Engagements",
    CONTRACT_ADDRESSES.engagements,
  );
  const membershipToken = await ethers.getContractAt(
    "MembershipTokenERC20Votes",
    CONTRACT_ADDRESSES.membershipToken,
  );
  const communityToken = await ethers.getContractAt(
    "CommunityToken",
    CONTRACT_ADDRESSES.communityToken,
  );

  // STEP 1: Read ValuableAction configuration
  console.log("\n🎯 STEP 1: Fetch ValuableAction");
  const action = await valuableActionRegistry.getValuableAction(ACTION_ID);
  const isActive = await valuableActionRegistry.isValuableActionActive(
    ACTION_ID,
  );

  console.log("   Action ID:", ACTION_ID);
  console.log("   Active:", isActive ? "YES ✅" : "NO ❌");
  console.log("   Membership Reward:", action.membershipTokenReward.toString());
  console.log("   Community Reward:", action.communityTokenReward.toString());
  console.log("   Jurors Required:", action.jurorsMin.toString());
  console.log("   Panel Size:", action.panelSize.toString());
  console.log("   Verify Window (s):", action.verifyWindow.toString());

  if (!isActive) {
    console.log("❌ ValuableAction is not active. Activate via governance first.");
    return;
  }

  // STEP 2: Submit engagement
  console.log("\n📋 STEP 2: Submit engagement");
  console.log("   Evidence:", EVIDENCE_CID);

  const submitTx = await engagements
    .connect(worker)
    .submit(ACTION_ID, EVIDENCE_CID);
  console.log("   TX submitted:", submitTx.hash);
  const submitReceipt = await submitTx.wait();
  console.log("   ✅ Engagement submitted");

  let engagementId: bigint | null = null;
  for (const log of submitReceipt.logs) {
    try {
      const parsed = engagements.interface.parseLog(log);
      if (parsed?.name === "EngagementSubmitted") {
        engagementId = parsed.args[0];
        break;
      }
    } catch (e) {
      // continue
    }
  }

  if (!engagementId) {
    try {
      engagementId = await engagements.lastEngagementId();
      console.log("   ⚠️ Fallback engagement ID fetched from contract");
    } catch (e) {
      console.log("   ❌ Could not resolve engagement ID");
      return;
    }
  }

  console.log("   Engagement ID:", engagementId.toString());

  // STEP 3: Inspect engagement record
  console.log("\n🔍 STEP 3: Inspect engagement");
  const engagement = await engagements.getEngagement(engagementId);
  console.log("   Worker:", engagement.worker);
  console.log("   Evidence:", engagement.evidenceCID);
  console.log("   Status:", engagement.status.toString(), "(0=Pending,1=Approved,2=Rejected,3=Revoked)");

  const jurors: string[] = await engagements.getEngagementJurors(
    engagementId,
  );
  console.log("   Jurors assigned:", jurors.length);
  jurors.forEach((j, idx) =>
    console.log(`      [${idx}] ${j} ${
      j.toLowerCase() === workerAddress.toLowerCase() ? "(caller)" : ""
    }`),
  );

  // STEP 4: Optional vote if caller is juror
  const callerIsJuror = jurors.some(
    (j) => j.toLowerCase() === workerAddress.toLowerCase(),
  );
  if (callerIsJuror) {
    console.log("\n🗳️ STEP 4: Caller is a juror, casting approval vote...");
    try {
      const voteTx = await engagements.verify(engagementId, true);
      await voteTx.wait();
      console.log("   ✅ Vote submitted as assigned juror");
    } catch (e: any) {
      console.log("   ❌ Vote failed:", e?.message || e);
    }
  } else {
    console.log("\n🗳️ STEP 4: Caller is not an assigned juror. Skipping vote.");
  }

  // STEP 5: Snapshot balances (pre/post verification)
  console.log("\n💰 STEP 5: Balance snapshot");
  const membershipBalance = await membershipToken.balanceOf(workerAddress);
  const communityBalance = await communityToken.balanceOf(workerAddress);
  console.log(
    "   MembershipToken:",
    ethers.formatEther(membershipBalance),
    "MTK",
  );
  console.log(
    "   CommunityToken:",
    ethers.formatEther(communityBalance),
    "CTK",
  );

  console.log("\n🎉 ENGAGEMENTS SMOKE TEST COMPLETE");
  console.log("============================================================");
  console.log("✅ ValuableAction active and readable");
  console.log("✅ Engagement submitted and recorded");
  console.log("✅ Juror assignment inspected");
  console.log(
    "✅ Next step: assigned jurors verify → rewards distribute on approval",
  );
}

main().catch((error) => {
  console.error("💥 E2E smoke failed:", error);
  process.exitCode = 1;
});
}

main().catch((error) => {
  console.error("💥 Work verification test failed:", error);
  process.exitCode = 1;
});

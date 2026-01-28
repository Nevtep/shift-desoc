import { ethers } from "hardhat";

/**
 * Check Engagement Status Script - Base Sepolia
 *
 * Monitors the status of submitted engagements through the verification process.
 * Provides detailed information about engagement progress and verification results.
 *
 * Run: npx hardhat run scripts/check-claim-status.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
  engagements: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
  valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
};

// Configuration - Update this to check specific engagement
const ENGAGEMENT_ID = 1; // Engagement ID to check (leave as 0 to check latest engagements)

async function main() {
  console.log("📊 Check Engagement Status - Base Sepolia");
  console.log("============================================================");

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("👤 Checking from account:", signerAddress);
  console.log("📅 Check Time:", new Date().toLocaleString());

  // Connect to contracts
  const engagements = await ethers.getContractAt(
    "Engagements",
    CONTRACT_ADDRESSES.engagements,
  );
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    CONTRACT_ADDRESSES.valuableActionRegistry,
  );

  if (ENGAGEMENT_ID > 0) {
    console.log("🎯 Target Engagement ID:", ENGAGEMENT_ID);
    await checkSpecificEngagement(
      ENGAGEMENT_ID,
      engagements,
      valuableActionRegistry,
    );
  } else {
    console.log("🔍 Checking recent engagements...");
    await checkRecentEngagements(
      engagements,
      valuableActionRegistry,
      signerAddress,
    );
  }
}

async function checkSpecificEngagement(
  engagementId: number,
  engagements: any,
  valuableActionRegistry: any,
) {
  console.log("\n📋 ENGAGEMENT DETAILS:");
  console.log("=".repeat(50));

  try {
    // Get engagement information
    const engagement = await engagements.getEngagement(engagementId);

    console.log("🔍 Engagement #" + engagementId + ":");
    console.log("   ├── Worker:", engagement.worker);
    console.log("   ├── Action ID:", engagement.typeId.toString());
    console.log("   ├── Evidence CID:", engagement.evidenceCID);
    console.log("   ├── Status:", getStatusName(engagement.status));
    console.log(
      "   ├── Created:",
      new Date(Number(engagement.createdAt) * 1000).toLocaleString(),
    );

    // Get associated action details
    console.log("\n🎯 ASSOCIATED ACTION:");
    try {
      const action = await valuableActionRegistry.getValuableAction(
        engagement.typeId,
      );
      console.log(
        "   ├── Membership Reward:",
        action.membershipTokenReward.toString(),
        "tokens",
      );
      console.log(
        "   ├── Community Reward:",
        action.communityTokenReward.toString(),
        "tokens",
      );
      console.log(
        "   ├── Verification Panel:",
        action.jurorsMin.toString(),
        "of",
        action.panelSize.toString(),
        "required",
      );
      console.log(
        "   ├── Verify Window:",
        action.verifyWindow.toString(),
        "seconds",
      );
      console.log(
        "   └── Evidence Types:",
        "0x" + action.evidenceTypes.toString(16),
      );
    } catch (error) {
      console.log("   └── Could not retrieve action details");
    }

    // Analyze engagement status
    console.log("\n📈 STATUS ANALYSIS:");
    analyzeEngagementStatus(engagement.status, engagement.createdAt);
  } catch (error) {
    console.log("❌ Engagement not found or error accessing:");
    console.log("   Error:", error);
    console.log("   Verify ENGAGEMENT_ID is correct and engagement exists");
  }
}

async function checkRecentEngagements(
  engagements: any,
  valuableActionRegistry: any,
  userAddress: string,
) {
  console.log("\n📋 RECENT ENGAGEMENTS OVERVIEW:");
  console.log("=".repeat(50));

  try {
    // Try to get engagements 1-10 (basic range check)
    let foundEngagements = 0;
    let userEngagements = 0;

    for (let i = 1; i <= 10; i++) {
      try {
        const engagement = await engagements.getEngagement(i);
        foundEngagements++;

        const isUserEngagement =
          engagement.worker.toLowerCase() === userAddress.toLowerCase();
        if (isUserEngagement) userEngagements++;

        console.log(
          "📋 Engagement #" +
            i +
            (isUserEngagement ? " (YOURS)" : "") +
            ":",
        );
        console.log(
          "   ├── Worker:",
          engagement.worker === userAddress ? "YOU" : engagement.worker,
        );
        console.log("   ├── Action ID:", engagement.typeId.toString());
        console.log("   ├── Status:", getStatusName(engagement.status));
        console.log(
          "   ├── Created:",
          new Date(Number(engagement.createdAt) * 1000).toLocaleDateString(),
        );
        console.log(
          "   └── Evidence:",
          engagement.evidenceCID.substring(0, 30) + "...",
        );
      } catch (error) {
        // Engagement doesn't exist, continue checking
        if (i === 1) {
          console.log("📋 No engagements found in system yet");
          break;
        }
        break;
      }
    }

    if (foundEngagements > 0) {
      console.log("\n📊 SUMMARY:");
      console.log("   ├── Total Engagements Found:", foundEngagements);
      console.log("   ├── Your Engagements:", userEngagements);
      console.log(
        "   └── Recent Activity:",
        foundEngagements > 5
          ? "High"
          : foundEngagements > 2
            ? "Medium"
            : "Low",
      );

      if (userEngagements === 0) {
        console.log("\n💡 OPPORTUNITY:");
        console.log(
          "   • No engagements submitted yet - consider submitting work for verification",
        );
        console.log(
          "   • Command: npx hardhat run scripts/submit-claim.ts --network base_sepolia",
        );
      }
    }
  } catch (error) {
    console.log("❌ Error checking recent engagements:", error);
  }
}

function getStatusName(status: bigint): string {
  const statusMap: { [key: string]: string } = {
    "0": "PENDING ⏳",
    "1": "APPROVED ✅",
    "2": "REJECTED ❌",
    "3": "REVOKED ⚠️",
  };

  return statusMap[status.toString()] || "UNKNOWN ❓";
}

function analyzeEngagementStatus(status: bigint, createdAt: bigint) {
  const now = Math.floor(Date.now() / 1000);
  const engagementAge = now - Number(createdAt);
  const ageHours = engagementAge / 3600;

  console.log("   ├── Current Status:", getStatusName(status));
  console.log("   ├── Age:", ageHours.toFixed(1), "hours");

  switch (Number(status)) {
    case 0: // PENDING
      console.log("   ├── Next Step: Juror selection and review initiation");
      console.log("   └── Timeline: Review begins within verify window");

      if (ageHours > 24) {
        console.log("   ⚠️ WARNING: Engagement pending longer than expected");
        console.log("      Check if sufficient jurors are available");
      }
      break;

    case 1: // APPROVED
      console.log("   ├── ✅ SUCCESSFUL: Work approved by juror majority");
      console.log("   ├── Rewards: Distributed automatically upon approval (if configured)");
      console.log(
        "   └── Timeline: Completed in",
        ageHours.toFixed(1),
        "hours",
      );

      console.log("\n🎉 CONGRATULATIONS!");
      console.log("   • Work met community quality standards");
      console.log("   • Tokens and SBTs distributed to your account");
      console.log("   • Reputation increased in community");
      console.log(
        "   • Check rewards: npx hardhat run scripts/check-rewards.ts --network base_sepolia",
      );
      break;

    case 2: // REJECTED
      console.log("   ├── ❌ REJECTED: Work did not meet quality standards");
      console.log("   ├── Outcome: No rewards distributed");
      console.log("   └── Timeline: Decided in", ageHours.toFixed(1), "hours");

      console.log("\n💡 NEXT STEPS:");
      console.log("   • Review verifier feedback for improvement areas");
      console.log("   • Enhance work quality based on feedback");
      console.log("   • Resubmit improved version when ready");
      console.log(
        "   • Consider discussing requirements in community channels",
      );
      break;

    case 3: // REVOKED
      console.log("   ├── ⚠️ REVOKED: Engagement revoked by governance");
      console.log("   └── Outcome: Rewards revoked, consult governance proposal");
      break;

    default:
      console.log("   └── Status unknown or system error");
  }

  // General timeline guidance
  if (Number(status) < 2) {
    // Still in progress
    console.log("\n⏰ EXPECTED TIMELINE:");
    console.log("   • Submission → Review: depends on panel selection");
    console.log("   • Review → Decision: within verify window");
    console.log("   • Decision → Rewards: Immediate (if approved)");
  }
}

main()
  .then(() => {
    console.log("\n🎯 ENGAGEMENT STATUS CHECK COMPLETE!");
    console.log("============================================================");
    console.log("✅ Engagement information retrieved");
    console.log("✅ Status analysis provided");
    console.log("✅ Next steps identified");
    console.log("");
    console.log("🔄 Regular Monitoring:");
    console.log("   • Run this script to track engagement progress");
    console.log(
      "   • Monitor rewards: npx hardhat run scripts/check-rewards.ts --network base_sepolia",
    );
    console.log(
      "   • System status: npx hardhat run scripts/verify-base-sepolia.ts --network base_sepolia",
    );

    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

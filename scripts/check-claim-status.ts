import { ethers } from "hardhat";

/**
 * Check Claim Status Script - Base Sepolia
 *
 * Monitors the status of submitted work claims through verification process
 * Provides detailed information about claim progress and verification results
 *
 * Run: npx hardhat run scripts/check-claim-status.ts --network base_sepolia
 */

const CONTRACT_ADDRESSES = {
  claims: "0xcd3fEfEE2dd2F3114742893f86D269740DF68B35",
  valuableActionRegistry: "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2",
  verifierPool: "0x8D0962Ca5c55b2432819De25061a25Eb32DC1d3B",
};

// Configuration - Update this to check specific claim
const CLAIM_ID = 1; // Claim ID to check (leave as 0 to check latest claims)

async function main() {
  console.log("📊 Check Claim Status - Base Sepolia");
  console.log("============================================================");

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log("👤 Checking from account:", signerAddress);
  console.log("📅 Check Time:", new Date().toLocaleString());

  // Connect to contracts
  const claims = await ethers.getContractAt(
    "Claims",
    CONTRACT_ADDRESSES.claims,
  );
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    CONTRACT_ADDRESSES.valuableActionRegistry,
  );

  if (CLAIM_ID > 0) {
    console.log("🎯 Target Claim ID:", CLAIM_ID);
    await checkSpecificClaim(CLAIM_ID, claims, valuableActionRegistry);
  } else {
    console.log("🔍 Checking recent claims...");
    await checkRecentClaims(claims, valuableActionRegistry, signerAddress);
  }
}

async function checkSpecificClaim(
  claimId: number,
  claims: any,
  valuableActionRegistry: any,
) {
  console.log("\n📋 CLAIM DETAILS:");
  console.log("=".repeat(50));

  try {
    // Get claim information
    const claim = await claims.getClaim(claimId);

    console.log("🔍 Claim #" + claimId + ":");
    console.log("   ├── Claimant:", claim.claimant);
    console.log("   ├── Action ID:", claim.actionId.toString());
    console.log("   ├── Evidence CID:", claim.evidenceCID);
    console.log(
      "   ├── Description:",
      claim.description?.substring(0, 100) +
        (claim.description?.length > 100 ? "..." : ""),
    );
    console.log("   ├── Status:", getStatusName(claim.status));
    console.log(
      "   ├── Created:",
      new Date(Number(claim.createdAt) * 1000).toLocaleString(),
    );

    if (claim.updatedAt && claim.updatedAt > 0n) {
      console.log(
        "   └── Updated:",
        new Date(Number(claim.updatedAt) * 1000).toLocaleString(),
      );
    }

    // Get associated action details
    console.log("\n🎯 ASSOCIATED ACTION:");
    try {
      const action = await valuableActionRegistry.getAction(claim.actionId);
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

    // Analyze claim status
    console.log("\n📈 STATUS ANALYSIS:");
    analyzeClaimStatus(claim.status, claim.createdAt);

    // Show verification progress if under review
    if (claim.status === 1n) {
      console.log("\n🔍 VERIFICATION PROGRESS:");
      console.log("   ├── Status: Under Review");
      console.log("   ├── Verifiers Selected: Yes");
      console.log("   ├── Votes Collected: In Progress");
      console.log("   └── Estimated Completion: Within verification window");

      console.log("\n⏳ WHAT'S HAPPENING:");
      console.log("   • Selected verifiers are reviewing the evidence");
      console.log(
        "   • Each verifier evaluates work quality against standards",
      );
      console.log("   • M-of-N voting determines final approval/rejection");
      console.log(
        "   • Economic incentives ensure honest and thorough reviews",
      );
    }
  } catch (error) {
    console.log("❌ Claim not found or error accessing:");
    console.log("   Error:", error);
    console.log("   Verify CLAIM_ID is correct and claim exists");
  }
}

async function checkRecentClaims(
  claims: any,
  valuableActionRegistry: any,
  userAddress: string,
) {
  console.log("\n📋 RECENT CLAIMS OVERVIEW:");
  console.log("=".repeat(50));

  try {
    // Try to get claims 1-10 (basic range check)
    let foundClaims = 0;
    let userClaims = 0;

    for (let i = 1; i <= 10; i++) {
      try {
        const claim = await claims.getClaim(i);
        foundClaims++;

        const isUserClaim =
          claim.claimant.toLowerCase() === userAddress.toLowerCase();
        if (isUserClaim) userClaims++;

        console.log(
          "📋 Claim #" + i + (isUserClaim ? " (YOUR CLAIM)" : "") + ":",
        );
        console.log(
          "   ├── Claimant:",
          claim.claimant === userAddress ? "YOU" : claim.claimant,
        );
        console.log("   ├── Action ID:", claim.actionId.toString());
        console.log("   ├── Status:", getStatusName(claim.status));
        console.log(
          "   ├── Created:",
          new Date(Number(claim.createdAt) * 1000).toLocaleDateString(),
        );
        console.log(
          "   └── Evidence:",
          claim.evidenceCID.substring(0, 30) + "...",
        );
      } catch (error) {
        // Claim doesn't exist, continue checking
        if (i === 1) {
          console.log("📋 No claims found in system yet");
          break;
        }
        break;
      }
    }

    if (foundClaims > 0) {
      console.log("\n📊 SUMMARY:");
      console.log("   ├── Total Claims Found:", foundClaims);
      console.log("   ├── Your Claims:", userClaims);
      console.log(
        "   └── Recent Activity:",
        foundClaims > 5 ? "High" : foundClaims > 2 ? "Medium" : "Low",
      );

      if (userClaims === 0) {
        console.log("\n💡 OPPORTUNITY:");
        console.log(
          "   • No claims submitted yet - consider submitting work for verification",
        );
        console.log(
          "   • Command: npx hardhat run scripts/submit-claim.ts --network base_sepolia",
        );
      }
    }
  } catch (error) {
    console.log("❌ Error checking recent claims:", error);
  }
}

function getStatusName(status: bigint): string {
  const statusMap: { [key: string]: string } = {
    "0": "PENDING ⏳",
    "1": "UNDER_REVIEW 🔍",
    "2": "APPROVED ✅",
    "3": "REJECTED ❌",
  };

  return statusMap[status.toString()] || "UNKNOWN ❓";
}

function analyzeClaimStatus(status: bigint, createdAt: bigint) {
  const now = Math.floor(Date.now() / 1000);
  const claimAge = now - Number(createdAt);
  const ageHours = claimAge / 3600;

  console.log("   ├── Current Status:", getStatusName(status));
  console.log("   ├── Age:", ageHours.toFixed(1), "hours");

  switch (Number(status)) {
    case 0: // PENDING
      console.log("   ├── Next Step: Verifier selection and review initiation");
      console.log("   └── Timeline: Review should begin within 24 hours");

      if (ageHours > 24) {
        console.log("   ⚠️ WARNING: Claim pending longer than expected");
        console.log("      Check if sufficient verifiers are available");
      }
      break;

    case 1: // UNDER_REVIEW
      console.log(
        "   ├── Next Step: Verifiers casting votes on evidence quality",
      );
      console.log(
        "   └── Timeline: Decision within verification window (24-48 hours)",
      );

      if (ageHours > 48) {
        console.log("   ⚠️ WARNING: Review taking longer than expected");
        console.log(
          "      May indicate complex verification or verifier availability issues",
        );
      }
      break;

    case 2: // APPROVED
      console.log("   ├── ✅ SUCCESSFUL: Work approved by verifier majority");
      console.log("   ├── Rewards: Distributed automatically upon approval");
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

    case 3: // REJECTED
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

    default:
      console.log("   └── Status unknown or system error");
  }

  // General timeline guidance
  if (Number(status) < 2) {
    // Still in progress
    console.log("\n⏰ EXPECTED TIMELINE:");
    console.log("   • Submission → Review: 0-24 hours");
    console.log("   • Review → Decision: 24-48 hours");
    console.log("   • Decision → Rewards: Immediate (if approved)");
    console.log("   • Total Process: 1-3 days typical");
  }
}

main()
  .then(() => {
    console.log("\n🎯 CLAIM STATUS CHECK COMPLETE!");
    console.log("============================================================");
    console.log("✅ Claim information retrieved");
    console.log("✅ Status analysis provided");
    console.log("✅ Next steps identified");
    console.log("");
    console.log("🔄 Regular Monitoring:");
    console.log("   • Run this script to track claim progress");
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

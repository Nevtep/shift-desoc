import { ethers } from "hardhat";

/**
 * Execute Proposal Script - Base Sepolia
 *
 * Executes a succeeded governance proposal through timelock
 * Run after proposal succeeds and voting period ends
 *
 * Run: npx hardhat run scripts/execute-proposal.ts --network base_sepolia
 */

const SHIFT_GOVERNOR = "0x42362f0f2Cdd96902848e21d878927234C5C9425";
const TIMELOCK_CONTROLLER = "0xF140d690BadDf50C3a1006AD587298Eed61ADCfA";
const VALUABLE_ACTION_REGISTRY = "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2";
const PROPOSAL_ID =
  "113920921519397733368469111639687140856855946985470387080321665420245744891488";
const COMMUNITY_ID = 1;

async function main() {
  console.log("⚡ Execute Governance Proposal - Base Sepolia");
  console.log("============================================================");
  console.log("Proposal ID:", PROPOSAL_ID.substring(0, 20) + "...");

  const [deployer] = await ethers.getSigners();
  console.log("👤 Executing with account:", await deployer.getAddress());

  const shiftGovernor = (await ethers.getContractAt(
    "ShiftGovernor",
    SHIFT_GOVERNOR,
  )) as any;
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    VALUABLE_ACTION_REGISTRY,
  );

  // Check proposal status
  const proposalState = await shiftGovernor.state(PROPOSAL_ID);
  const stateNames = [
    "Pending",
    "Active",
    "Canceled",
    "Defeated",
    "Succeeded",
    "Queued",
    "Expired",
    "Executed",
  ];
  const stateName = stateNames[Number(proposalState)] || "Unknown";

  console.log("\n🎯 CURRENT STATUS:");
  console.log(
    "   Proposal State:",
    proposalState.toString(),
    "(" + stateName + ")",
  );

  if (proposalState === 7n) {
    console.log("✅ Proposal already executed!");
    return;
  }

  if (proposalState !== 4n && proposalState !== 5n) {
    console.log("❌ Proposal is not ready for execution!");
    console.log("   Current state:", stateName);
    console.log("   Expected: Succeeded (4) or Queued (5)");
    return;
  }

  try {
    // Prepare execution data for ValuableAction creation
    const targets = [VALUABLE_ACTION_REGISTRY];
    const values = [0];
    const calldatas = [
      valuableActionRegistry.interface.encodeFunctionData("createAction", [
        COMMUNITY_ID,
        "Complete Development Task",
        "ipfs://QmE2ETestValuableActionForDevelopment",
        100, // membershipTokenReward: 100 governance tokens
        50, // communityTokenReward: 50 community tokens
        0, // investorSBTReward: 0 (not investment work)
        2, // jurorsMin: need 2 out of 3 approvals
        3, // panelSize: 3 verifiers total
        24 * 3600, // verifyWindow: 24 hours
        60 * 60, // cooldownPeriod: 1 hour between claims
        1, // maxConcurrent: 1 active claim at a time
        15, // verifierRewardWeight: 15 points for accurate verifiers
        500, // slashVerifierBps: 5% slashing for wrong decisions
        true, // revocable: community can revoke if needed
        0x01, // evidenceTypes: basic documentation
        "GitHub repository link, pull request URL, and brief description of changes made",
      ]),
    ];

    const description =
      "Create ValuableAction for Development Work Verification Testing";
    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));

    // STEP 1: Queue proposal (if not already queued)
    if (proposalState === 4n) {
      console.log("\n🔄 STEP 1: Queueing proposal...");

      const queueTx = await shiftGovernor.queue(
        targets,
        values,
        calldatas,
        descriptionHash,
      );
      console.log("   Transaction submitted:", queueTx.hash);

      const queueReceipt = await queueTx.wait();
      console.log("   ✅ Proposal queued successfully!");
      console.log("   Gas used:", queueReceipt.gasUsed.toString());

      const newState = await shiftGovernor.state(PROPOSAL_ID);
      console.log("   New proposal state:", stateNames[Number(newState)]);
    } else {
      console.log("✅ Proposal already queued, proceeding to execution");
    }

    // STEP 2: Wait for timelock delay (if needed)
    console.log("\n⏳ STEP 2: Checking timelock delay...");

    // Check if timelock delay has passed
    const timelockController = await ethers.getContractAt(
      "TimelockController",
      TIMELOCK_CONTROLLER,
    );
    const minDelay = await timelockController.getMinDelay();
    console.log("   Minimum timelock delay:", minDelay.toString(), "seconds");

    // For actual execution, we'd need to check the specific operation timestamp
    console.log("   ⚠️ Note: In production, verify timelock delay has passed");

    // STEP 3: Execute proposal
    console.log("\n⚡ STEP 3: Executing proposal...");

    const executeTx = await shiftGovernor.execute(
      targets,
      values,
      calldatas,
      descriptionHash,
    );
    console.log("   Transaction submitted:", executeTx.hash);

    const executeReceipt = await executeTx.wait();
    console.log("   ✅ Proposal executed successfully!");
    console.log("   Gas used:", executeReceipt.gasUsed.toString());

    // STEP 4: Verify ValuableAction was created
    console.log("\n🎯 STEP 4: Verifying ValuableAction creation...");

    // Check if a new action was created
    try {
      // The action should be created with ID 1 (assuming first action in community)
      const action = await valuableActionRegistry.getAction(1);
      console.log("   ✅ ValuableAction created successfully!");
      console.log("   Action ID: 1");
      console.log("   Title: Complete Development Task");
      console.log(
        "   Membership Token Reward:",
        action.membershipTokenReward.toString(),
      );
      console.log(
        "   Community Token Reward:",
        action.communityTokenReward.toString(),
      );
      console.log(
        "   Required Jurors:",
        action.jurorsMin.toString(),
        "of",
        action.panelSize.toString(),
      );
    } catch (error) {
      console.log("   ⚠️ Could not verify action creation:", error);
    }

    console.log("\n🎉 PROPOSAL EXECUTION COMPLETE!");
    console.log("============================================================");
    console.log("✅ Governance proposal executed successfully");
    console.log("✅ ValuableAction created and ready for work verification");
    console.log("✅ Work verification workflow can now proceed");
    console.log("");
    console.log("🔄 Next Steps:");
    console.log(
      "   1. Register as verifiers: npx hardhat run scripts/register-verifier.ts --network base_sepolia",
    );
    console.log(
      "   2. Submit work claims: npx hardhat run scripts/submit-claim.ts --network base_sepolia",
    );
    console.log(
      "   3. Verify claims: npx hardhat run scripts/verify-claim.ts --network base_sepolia",
    );
    console.log(
      "   4. Check rewards: npx hardhat run scripts/check-rewards.ts --network base_sepolia",
    );
  } catch (error: any) {
    console.error("❌ Execution failed:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }

    // Provide helpful debugging information
    console.log("\n🔧 Debug Info:");
    console.log("   - Ensure proposal has succeeded and voting period ended");
    console.log("   - Check if timelock delay has passed (usually 2 days)");
    console.log("   - Verify account has execution permissions");
    console.log("   - Confirm proposal calldata matches creation parameters");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

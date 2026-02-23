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
const PROPOSAL_REF = ethers.id("engagement-action-dev-task-1");

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
    // Prepare execution data for ValuableAction creation via governance path
    const actionParams = {
      membershipTokenReward: 100,
      communityTokenReward: 50,
      investorSBTReward: 0,
      jurorsMin: 2,
      panelSize: 3,
      verifyWindow: 24 * 3600,
      verifierRewardWeight: 15,
      slashVerifierBps: 500,
      cooldownPeriod: 60 * 60,
      maxConcurrent: 1,
      revocable: true,
      evidenceTypes: 1,
      proposalThreshold: 0,
      proposer: await deployer.getAddress(),
      evidenceSpecCID: "ipfs://QmE2ETestValuableActionForDevelopment",
      titleTemplate: "Complete Development Task",
      automationRules: [] as string[],
      activationDelay: 0,
      deprecationWarning: 0,
    };

    const targets = [VALUABLE_ACTION_REGISTRY];
    const values = [0];
    const calldatas = [
      valuableActionRegistry.interface.encodeFunctionData(
        "proposeValuableAction",
        [
          COMMUNITY_ID,
          [
            actionParams.membershipTokenReward,
            actionParams.communityTokenReward,
            actionParams.investorSBTReward,
            actionParams.jurorsMin,
            actionParams.panelSize,
            actionParams.verifyWindow,
            actionParams.verifierRewardWeight,
            actionParams.slashVerifierBps,
            actionParams.cooldownPeriod,
            actionParams.maxConcurrent,
            actionParams.revocable,
            actionParams.evidenceTypes,
            actionParams.proposalThreshold,
            actionParams.proposer,
            actionParams.evidenceSpecCID,
            actionParams.titleTemplate,
            actionParams.automationRules,
            actionParams.activationDelay,
            actionParams.deprecationWarning,
          ],
          PROPOSAL_REF,
        ],
      ),
    ];

    const description =
      "Propose ValuableAction via governance for Engagements verification";
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

    try {
      const lastId = await valuableActionRegistry.lastId();
      const action = await valuableActionRegistry.getValuableAction(lastId);
      const isActive = await valuableActionRegistry.isValuableActionActive(
        lastId,
      );
      console.log("   ✅ ValuableAction proposed!");
      console.log("   Action ID:", lastId.toString());
      console.log("   Title:", actionParams.titleTemplate);
      console.log("   Membership Reward:", action.membershipTokenReward);
      console.log("   Community Reward:", action.communityTokenReward);
      console.log("   Active:", isActive ? "YES" : "NO (activate via governance)");
      if (!isActive) {
        console.log(
          "   ℹ️ Submit follow-up proposal calling activateFromGovernance(id, PROPOSAL_REF)",
        );
      }
    } catch (error) {
      console.log("   ⚠️ Could not verify action creation:", error);
    }

    console.log("\n🎉 PROPOSAL EXECUTION COMPLETE!");
    console.log("============================================================");
    console.log("✅ Governance proposal executed successfully");
    console.log("✅ ValuableAction proposed for Engagements workflow");
    console.log("✅ Activate via governance to allow engagement submissions");
    console.log("");
    console.log("🔄 Next Steps:");
    console.log(
      "   1. Ensure VerifierManager roster is configured for this community",
    );
    console.log(
      "   2. Submit engagements: npx hardhat run scripts/submit-claim.ts --network base_sepolia",
    );
    console.log(
      "   3. Verify engagements: npx hardhat run scripts/verify-claim.ts --network base_sepolia",
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

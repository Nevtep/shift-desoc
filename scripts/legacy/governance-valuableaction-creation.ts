import { ethers } from "hardhat";

const COMMUNITY_ID = 1;

// Base Sepolia deployed contract addresses
const COMMUNITY_REGISTRY = "0x67eC4cAcC44D80B43Ce7CCA63cEF6D1Ae3E57f8B";
const SHIFT_GOVERNOR = "0x42362f0f2Cdd96902848e21d878927234C5C9425";
const VALUABLE_ACTION_REGISTRY = "0x831Ef7C12aD1A564C32630e5D1A18A3b0c8829f2";
const MEMBERSHIP_TOKEN = "0xFf60937906c537685Ad21a67a2A4E8Dbf7A0F9cb";
const TIMELOCK_CONTROLLER = "0xF140d690BadDf50C3a1006AD587298Eed61ADCfA";

async function main() {
  console.log("🏛️ Governance-Based ValuableAction Creation - Base Sepolia");
  console.log("============================================================");

  const [deployer] = await ethers.getSigners();
  console.log("👤 Using account:", await deployer.getAddress());

  // Get contract instances
  const communityRegistry = await ethers.getContractAt(
    "CommunityRegistry",
    COMMUNITY_REGISTRY,
  );
  const shiftGovernor = await ethers.getContractAt(
    "ShiftGovernor",
    SHIFT_GOVERNOR,
  );
  const valuableActionRegistry = await ethers.getContractAt(
    "ValuableActionRegistry",
    VALUABLE_ACTION_REGISTRY,
  );
  const membershipToken = await ethers.getContractAt(
    "MembershipTokenERC20Votes",
    MEMBERSHIP_TOKEN,
  );

  try {
    console.log("\n📊 GOVERNANCE STATUS CHECK:");

    // Check voting power
    const votingPower = await membershipToken.getVotes(
      await deployer.getAddress(),
    );
    console.log("   Voting power:", ethers.formatUnits(votingPower, 18));

    // Check proposal threshold
    const proposalThreshold = await shiftGovernor.proposalThreshold();
    console.log(
      "   Proposal threshold:",
      ethers.formatUnits(proposalThreshold, 18),
    );

    const canPropose = votingPower >= proposalThreshold;
    console.log("   Can propose:", canPropose);

    if (!canPropose) {
      console.log("   ❌ Insufficient voting power for governance proposals");
      return;
    }

    console.log("\n🎯 CREATING VALUABLEACTION VIA GOVERNANCE:");

    // Prepare the governance proposal to create a ValuableAction
    const governanceProposalId = BigInt(Math.floor(Date.now() / 1000)); // Unique governance reference for replay protection

    const createActionCalldata =
      valuableActionRegistry.interface.encodeFunctionData(
        "proposeValuableAction",
        [
          COMMUNITY_ID,
          {
            membershipTokenReward: 100, // 100 membership tokens
            communityTokenReward: 50, // 50 community tokens
            investorSBTReward: 0, // No investor SBT
            jurorsMin: 2, // Minimum 2 approvals
            panelSize: 3, // Panel of 3 jurors
            verifyWindow: 86400, // 24 hours to verify
            verifierRewardWeight: 10, // 10 points for verifiers
            slashVerifierBps: 500, // 5% slash for wrong verification
            cooldownPeriod: 3600, // 1 hour cooldown
            maxConcurrent: 3, // Max 3 concurrent claims
            revocable: true, // Can be revoked
            evidenceTypes: 1, // Basic evidence type
            proposalThreshold: ethers.parseUnits("100", 18), // 100 tokens to propose
            proposer: await deployer.getAddress(), // Proposer address
            evidenceSpecCID: "QmTestEvidenceSpec123...", // Evidence spec CID
            titleTemplate: "Complete Development Task", // Title template
            automationRules: [], // No automation rules
            activationDelay: 0, // No delay
            deprecationWarning: 2592000, // 30 days warning
          },
          governanceProposalId,
        ],
      );

    // Create governance proposal
    const targets = [VALUABLE_ACTION_REGISTRY];
    const values = [0];
    const calldatas = [createActionCalldata];
    const description =
      "Create ValuableAction: Complete Development Task - Testing work verification system with 2-of-3 juror verification, 100 membership token reward, 1 hour cooldown";

    console.log("   📋 Proposal details:");
    console.log("      Target:", targets[0]);
    console.log("      Description:", description);
    console.log("      Calldata length:", createActionCalldata.length);

    // Submit proposal
    console.log("\n📤 Submitting governance proposal...");
    const proposeTx = await shiftGovernor.propose(
      targets,
      values,
      calldatas,
      description,
    );
    console.log("   Transaction hash:", proposeTx.hash);

    const proposeReceipt = await proposeTx.wait();
    console.log("   ✅ Proposal submitted successfully");

    // Extract proposal ID from events
    const proposalCreatedEvent = proposeReceipt.logs.find(
      (log: any) =>
        log.topics &&
        log.topics[0] ===
          shiftGovernor.interface.getEvent("ProposalCreated")?.topicHash,
    );

    if (proposalCreatedEvent) {
      const decodedEvent = shiftGovernor.interface.decodeEventLog(
        "ProposalCreated",
        proposalCreatedEvent.data,
        proposalCreatedEvent.topics,
      );
      const proposalId = decodedEvent.proposalId;
      console.log("   📋 Proposal ID:", proposalId.toString());

      // Check proposal state
      const state = await shiftGovernor.state(proposalId);
      console.log("   📊 Proposal state:", state);

      // Get voting period info
      const snapshot = await shiftGovernor.proposalSnapshot(proposalId);
      const deadline = await shiftGovernor.proposalDeadline(proposalId);
      console.log("   📅 Snapshot block:", snapshot.toString());
      console.log("   📅 Deadline block:", deadline.toString());

      console.log("\n🗳️ NEXT STEPS FOR GOVERNANCE:");
      console.log("1. Wait for voting period to start");
      console.log("2. Vote on the proposal");
      console.log("3. Queue and execute after success");
      console.log("4. ValuableAction will be created and ready for claims");
    }
  } catch (error: any) {
    console.error("❌ Error:", error?.message || error);
    if (error?.data) {
      console.error("   Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

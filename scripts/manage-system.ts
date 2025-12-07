/**
 * Shift DeSoc System Management Script
 *
 * Comprehensive management utilities for deployed Shift DeSoc systems.
 * Provides CLI interface for all post-deployment operations including
 * governance, verifier elections, claims processing, and system monitoring.
 */

const hre = require("hardhat");
const { ethers } = hre;

interface SystemAddresses {
  // Core Infrastructure
  communityRegistry: string;
  paramController: string;

  // Governance
  membershipToken: string;
  timelock: string;
  governor: string;
  countingMultiChoice: string;

  // VPT System
  verifierPowerToken: string;
  verifierElection: string;
  verifierManager: string;

  // Work Verification
  valuableActionRegistry: string;
  claims: string;
  valuableActionSBT: string;

  // Economic Layer
  communityToken: string;
  revenueRouter: string;
  treasuryAdapter: string;

  // Community Modules
  requestHub: string;
  draftsManager: string;
  housingManager: string;
  marketplace: string;
  projectFactory: string;
}

// Load addresses from environment or deployment files
const SYSTEM_ADDRESSES: { [network: string]: SystemAddresses } = {
  base_sepolia: {
    // These would be populated from actual deployments
    // For now, they're placeholder - would be loaded from deployment output
    communityRegistry: process.env.COMMUNITY_REGISTRY_ADDRESS || "",
    paramController: process.env.PARAM_CONTROLLER_ADDRESS || "",
    membershipToken: process.env.MEMBERSHIP_TOKEN_ADDRESS || "",
    timelock: process.env.TIMELOCK_ADDRESS || "",
    governor: process.env.GOVERNOR_ADDRESS || "",
    countingMultiChoice: process.env.COUNTING_MULTI_CHOICE_ADDRESS || "",
    verifierPowerToken: process.env.VERIFIER_POWER_TOKEN_ADDRESS || "",
    verifierElection: process.env.VERIFIER_ELECTION_ADDRESS || "",
    verifierManager: process.env.VERIFIER_MANAGER_ADDRESS || "",
    valuableActionRegistry: process.env.VALUABLE_ACTION_REGISTRY_ADDRESS || "",
    claims: process.env.CLAIMS_ADDRESS || "",
    valuableActionSBT: process.env.VALUABLE_ACTION_SBT_ADDRESS || "",
    communityToken: process.env.COMMUNITY_TOKEN_ADDRESS || "",
    revenueRouter: process.env.REVENUE_ROUTER_ADDRESS || "",
    treasuryAdapter: process.env.TREASURY_ADAPTER_ADDRESS || "",
    requestHub: process.env.REQUEST_HUB_ADDRESS || "",
    draftsManager: process.env.DRAFTS_MANAGER_ADDRESS || "",
    housingManager: process.env.HOUSING_MANAGER_ADDRESS || "",
    marketplace: process.env.MARKETPLACE_ADDRESS || "",
    projectFactory: process.env.PROJECT_FACTORY_ADDRESS || "",
  },
};

class SystemManager {
  private contracts: { [name: string]: any } = {};
  private network: string;
  private deployer: any;

  constructor(network: string) {
    this.network = network;
  }

  async initialize(): Promise<void> {
    [this.deployer] = await ethers.getSigners();

    const addresses = SYSTEM_ADDRESSES[this.network];
    if (!addresses || !addresses.communityRegistry) {
      throw new Error(
        `No system addresses configured for network: ${this.network}`,
      );
    }

    // Connect to all deployed contracts
    this.contracts.communityRegistry = await ethers.getContractAt(
      "CommunityRegistry",
      addresses.communityRegistry,
    );
    this.contracts.paramController = await ethers.getContractAt(
      "ParamController",
      addresses.paramController,
    );
    this.contracts.membershipToken = await ethers.getContractAt(
      "MembershipTokenERC20Votes",
      addresses.membershipToken,
    );
    this.contracts.timelock = await ethers.getContractAt(
      "TimelockController",
      addresses.timelock,
    );
    this.contracts.governor = await ethers.getContractAt(
      "ShiftGovernor",
      addresses.governor,
    );
    this.contracts.countingMultiChoice = await ethers.getContractAt(
      "CountingMultiChoice",
      addresses.countingMultiChoice,
    );
    this.contracts.verifierPowerToken = await ethers.getContractAt(
      "VerifierPowerToken1155",
      addresses.verifierPowerToken,
    );
    this.contracts.verifierElection = await ethers.getContractAt(
      "VerifierElection",
      addresses.verifierElection,
    );
    this.contracts.verifierManager = await ethers.getContractAt(
      "VerifierManager",
      addresses.verifierManager,
    );
    this.contracts.valuableActionRegistry = await ethers.getContractAt(
      "ValuableActionRegistry",
      addresses.valuableActionRegistry,
    );
    this.contracts.claims = await ethers.getContractAt(
      "Claims",
      addresses.claims,
    );
    this.contracts.valuableActionSBT = await ethers.getContractAt(
      "ValuableActionSBT",
      addresses.valuableActionSBT,
    );
    this.contracts.communityToken = await ethers.getContractAt(
      "CommunityToken",
      addresses.communityToken,
    );
    this.contracts.revenueRouter = await ethers.getContractAt(
      "RevenueRouter",
      addresses.revenueRouter,
    );
    this.contracts.treasuryAdapter = await ethers.getContractAt(
      "TreasuryAdapter",
      addresses.treasuryAdapter,
    );
    this.contracts.requestHub = await ethers.getContractAt(
      "RequestHub",
      addresses.requestHub,
    );
    this.contracts.draftsManager = await ethers.getContractAt(
      "DraftsManager",
      addresses.draftsManager,
    );
    this.contracts.housingManager = await ethers.getContractAt(
      "HousingManager",
      addresses.housingManager,
    );
    this.contracts.marketplace = await ethers.getContractAt(
      "Marketplace",
      addresses.marketplace,
    );
    this.contracts.projectFactory = await ethers.getContractAt(
      "ProjectFactory",
      addresses.projectFactory,
    );

    console.log(`✅ Connected to Shift DeSoc system on ${this.network}`);
  }

  // ========================================================================
  // SYSTEM STATUS & MONITORING
  // ========================================================================

  async getSystemStatus(): Promise<void> {
    console.log(`\n📊 Shift DeSoc System Status on ${this.network}`);
    console.log("=".repeat(60));

    // Basic system info
    const communityCount =
      await this.contracts.communityRegistry.communityCount();
    const totalSupply = await this.contracts.membershipToken.totalSupply();

    console.log(`Communities: ${communityCount}`);
    console.log(
      `Total Governance Tokens: ${ethers.formatUnits(totalSupply, 18)}`,
    );
    console.log(`Deployer: ${this.deployer.address}`);
    console.log(
      `Balance: ${ethers.formatEther(await ethers.provider.getBalance(this.deployer.address))} ETH`,
    );

    // Contract addresses summary
    console.log("\n📍 Core Contracts:");
    const addresses = SYSTEM_ADDRESSES[this.network];
    console.log(`   CommunityRegistry: ${addresses.communityRegistry}`);
    console.log(`   Governor: ${addresses.governor}`);
    console.log(`   VerifierElection: ${addresses.verifierElection}`);
    console.log(`   Claims: ${addresses.claims}`);

    // If we have communities, show their basic info
    if (communityCount > 0) {
      console.log("\n🏘️  Communities:");
      for (let i = 1; i <= communityCount; i++) {
        try {
          const community =
            await this.contracts.communityRegistry.getCommunity(i);
          console.log(`   ${i}. ${community.name} - ${community.description}`);
        } catch (error) {
          console.log(`   ${i}. [Error loading community info]`);
        }
      }
    }
  }

  // ========================================================================
  // VERIFIER ELECTIONS
  // ========================================================================

  async createElection(
    communityId: number,
    candidates: string[],
    durationHours: number = 72,
  ): Promise<void> {
    const duration = durationHours * 3600;
    const minVotingPower = 100; // Default minimum

    console.log(`🗳️  Creating verifier election for Community ${communityId}`);
    console.log(`   Candidates: ${candidates.length}`);
    console.log(`   Duration: ${durationHours} hours`);

    const tx = await this.contracts.verifierElection.createElection(
      communityId,
      candidates,
      duration,
      minVotingPower,
    );
    await tx.wait();

    const nextId = await this.contracts.verifierElection.nextElectionId();
    const electionId = Number(nextId) - 1;
    console.log(`   ✅ Election ${electionId} created successfully`);
  }

  async getElectionInfo(electionId: number): Promise<void> {
    const election =
      await this.contracts.verifierElection.elections(electionId);
    const isActive =
      await this.contracts.verifierElection.isElectionActive(electionId);

    console.log(`\n📊 Election ${electionId} Information:`);
    console.log(`   Community: ${election.communityId}`);
    console.log(`   Status: ${isActive ? "Active" : "Ended"}`);
    console.log(
      `   End Time: ${new Date(Number(election.endTime) * 1000).toLocaleString()}`,
    );
    console.log(`   Min Voting Power: ${election.minVotingPower} VPT`);
    console.log(`   Finalized: ${election.finalized}`);

    const candidateCount =
      await this.contracts.verifierElection.getCandidateCount(electionId);
    console.log(`\n   👥 Candidates (${candidateCount}):`);

    for (let i = 0; i < candidateCount; i++) {
      const candidate =
        await this.contracts.verifierElection.getCandidateAddress(
          electionId,
          i,
        );
      const votes = await this.contracts.verifierElection.getCandidateVotes(
        electionId,
        i,
      );
      console.log(`      ${i + 1}. ${candidate} - ${votes} VPT votes`);
    }
  }

  async castVote(
    electionId: number,
    candidateIndex: number,
    vptAmount: number,
  ): Promise<void> {
    console.log(
      `🗳️  Casting ${vptAmount} VPT for candidate ${candidateIndex} in election ${electionId}`,
    );

    const tx = await this.contracts.verifierElection.castVote(
      electionId,
      candidateIndex,
      vptAmount,
    );
    await tx.wait();

    console.log(`   ✅ Vote cast successfully`);
  }

  async finalizeElection(electionId: number): Promise<void> {
    console.log(`🏁 Finalizing election ${electionId}`);

    const tx =
      await this.contracts.verifierElection.finalizeElection(electionId);
    await tx.wait();

    console.log(`   ✅ Election finalized`);
    await this.getElectionInfo(electionId);
  }

  // ========================================================================
  // GOVERNANCE OPERATIONS
  // ========================================================================

  async createProposal(
    targets: string[],
    values: number[],
    calldatas: string[],
    description: string,
  ): Promise<void> {
    console.log(`📝 Creating governance proposal: ${description}`);

    const tx = await this.contracts.governor.propose(
      targets,
      values,
      calldatas,
      description,
    );
    await tx.wait();

    console.log(`   ✅ Proposal created successfully`);
  }

  async getProposalInfo(proposalId: string): Promise<void> {
    const state = await this.contracts.governor.state(proposalId);
    const proposal = await this.contracts.governor.proposals(proposalId);

    const states = [
      "Pending",
      "Active",
      "Canceled",
      "Defeated",
      "Succeeded",
      "Queued",
      "Expired",
      "Executed",
    ];

    console.log(`\n📊 Proposal ${proposalId}:`);
    console.log(`   State: ${states[state] || "Unknown"}`);
    console.log(
      `   Vote Start: ${new Date(Number(proposal.voteStart) * 1000).toLocaleString()}`,
    );
    console.log(
      `   Vote End: ${new Date(Number(proposal.voteEnd) * 1000).toLocaleString()}`,
    );
  }

  async vote(
    proposalId: string,
    support: number,
    reason?: string,
  ): Promise<void> {
    const supportTypes = ["Against", "For", "Abstain"];
    console.log(
      `🗳️  Voting ${supportTypes[support]} on proposal ${proposalId}`,
    );

    const tx = await this.contracts.governor.castVoteWithReason(
      proposalId,
      support,
      reason || "",
    );
    await tx.wait();

    console.log(`   ✅ Vote cast successfully`);
  }

  // ========================================================================
  // CLAIMS & WORK VERIFICATION
  // ========================================================================

  async submitClaim(
    communityId: number,
    valuableActionId: number,
    evidenceCID: string,
  ): Promise<void> {
    console.log(
      `📝 Submitting claim for Community ${communityId}, ValuableAction ${valuableActionId}`,
    );

    const tx = await this.contracts.claims.submitClaim(
      communityId,
      valuableActionId,
      evidenceCID,
    );
    await tx.wait();

    console.log(`   ✅ Claim submitted successfully`);
  }

  async getClaimInfo(claimId: number): Promise<void> {
    const claim = await this.contracts.claims.getClaim(claimId);

    console.log(`\n📊 Claim ${claimId}:`);
    console.log(`   Worker: ${claim.worker}`);
    console.log(`   Community: ${claim.communityId}`);
    console.log(`   ValuableAction: ${claim.valuableActionId}`);
    console.log(`   Evidence: ${claim.evidenceCID}`);
    console.log(`   Status: ${claim.status}`);
  }

  async verifyClaim(claimId: number, approved: boolean): Promise<void> {
    console.log(
      `✅ Verifying claim ${claimId}: ${approved ? "APPROVED" : "REJECTED"}`,
    );

    const tx = await this.contracts.claims.verifyClaim(claimId, approved);
    await tx.wait();

    console.log(`   ✅ Verification submitted successfully`);
  }

  // ========================================================================
  // VPT TOKEN MANAGEMENT
  // ========================================================================

  async mintVPT(
    to: string,
    communityId: number,
    amount: number,
  ): Promise<void> {
    console.log(
      `💰 Minting ${amount} VPT to ${to} for Community ${communityId}`,
    );

    const tx = await this.contracts.verifierPowerToken.mint(
      to,
      communityId,
      amount,
      "0x",
    );
    await tx.wait();

    console.log(`   ✅ VPT minted successfully`);
  }

  async getVPTBalance(address: string, communityId: number): Promise<void> {
    const balance = await this.contracts.verifierPowerToken.balanceOf(
      address,
      communityId,
    );
    console.log(
      `💰 VPT Balance: ${address} has ${balance} VPT in Community ${communityId}`,
    );
  }

  async checkVotingEligibility(
    address: string,
    communityId: number,
  ): Promise<void> {
    const balance = await this.contracts.verifierPowerToken.balanceOf(
      address,
      communityId,
    );
    const minRequired = 100; // Would get this from election or params

    console.log(`🗳️  Voting Eligibility Check:`);
    console.log(`   Address: ${address}`);
    console.log(`   Community: ${communityId}`);
    console.log(`   VPT Balance: ${balance}`);
    console.log(`   Required: ${minRequired}`);
    console.log(`   Eligible: ${balance >= minRequired ? "YES" : "NO"}`);
  }

  // ========================================================================
  // COMMUNITY MANAGEMENT
  // ========================================================================

  async getCommunityInfo(communityId: number): Promise<void> {
    const community =
      await this.contracts.communityRegistry.getCommunity(communityId);

    console.log(`\n🏘️  Community ${communityId} Information:`);
    console.log(`   Name: ${community.name}`);
    console.log(`   Description: ${community.description}`);
    console.log(`   Metadata URI: ${community.metadataURI}`);
    console.log(`   Debate Window: ${community.debateWindow} seconds`);
    console.log(`   Vote Window: ${community.voteWindow} seconds`);
    console.log(`   Execution Delay: ${community.executionDelay} seconds`);
    console.log(`   Revenue Split: ${community.revenueSplit.join("/")}`);
  }

  async getVPTParams(communityId: number): Promise<void> {
    const params =
      await this.contracts.paramController.getVerifierParams(communityId);

    console.log(`\n⚙️  VPT Parameters for Community ${communityId}:`);
    console.log(`   Panel Size: ${params[0]}`);
    console.log(`   Min Approvals: ${params[1]}`);
    console.log(`   Max Panels: ${params[2]}`);
    console.log(`   Use Weighting: ${params[3]}`);
    console.log(`   Max Weight: ${params[4]}`);
    console.log(`   Fraud Cooldown: ${params[5]} seconds`);
  }
}

// ========================================================================
// CLI INTERFACE
// ========================================================================

async function main() {
  const command = process.argv[2];
  const network = process.env.HARDHAT_NETWORK || "hardhat";

  const manager = new SystemManager(network);
  await manager.initialize();

  switch (command) {
    case "status":
      await manager.getSystemStatus();
      break;

    case "elections": {
      const subcommand = process.argv[3];

      switch (subcommand) {
        case "create": {
          const communityId = parseInt(process.argv[4]);
          const candidatesStr = process.argv[5];
          const duration = parseInt(process.argv[6]) || 72;

          if (!communityId || !candidatesStr) {
            console.log(
              "Usage: elections create <communityId> <candidates> [durationHours]",
            );
            console.log("Example: elections create 1 0x123...,0x456... 72");
            return;
          }

          const candidates = candidatesStr.split(",");
          await manager.createElection(communityId, candidates, duration);
          break;
        }

        case "info": {
          const electionId = parseInt(process.argv[4]);
          if (electionId === undefined) {
            console.log("Usage: elections info <electionId>");
            return;
          }
          await manager.getElectionInfo(electionId);
          break;
        }

        case "vote": {
          const electionId = parseInt(process.argv[4]);
          const candidateIndex = parseInt(process.argv[5]);
          const vptAmount = parseInt(process.argv[6]);

          if (
            electionId === undefined ||
            candidateIndex === undefined ||
            !vptAmount
          ) {
            console.log(
              "Usage: elections vote <electionId> <candidateIndex> <vptAmount>",
            );
            return;
          }

          await manager.castVote(electionId, candidateIndex, vptAmount);
          break;
        }

        case "finalize": {
          const electionId = parseInt(process.argv[4]);
          if (electionId === undefined) {
            console.log("Usage: elections finalize <electionId>");
            return;
          }
          await manager.finalizeElection(electionId);
          break;
        }

        default:
          console.log("Elections subcommands: create, info, vote, finalize");
      }
      break;
    }

    case "governance": {
      const subcommand = process.argv[3];

      switch (subcommand) {
        case "proposal": {
          const proposalId = process.argv[4];
          if (!proposalId) {
            console.log("Usage: governance proposal <proposalId>");
            return;
          }
          await manager.getProposalInfo(proposalId);
          break;
        }

        case "vote": {
          const proposalId = process.argv[4];
          const support = parseInt(process.argv[5]);
          const reason = process.argv[6];

          if (!proposalId || support === undefined) {
            console.log(
              "Usage: governance vote <proposalId> <support> [reason]",
            );
            console.log("Support: 0=Against, 1=For, 2=Abstain");
            return;
          }

          await manager.vote(proposalId, support, reason);
          break;
        }

        default:
          console.log("Governance subcommands: proposal, vote");
      }
      break;
    }

    case "claims": {
      const subcommand = process.argv[3];

      switch (subcommand) {
        case "submit": {
          const communityId = parseInt(process.argv[4]);
          const valuableActionId = parseInt(process.argv[5]);
          const evidenceCID = process.argv[6];

          if (!communityId || !valuableActionId || !evidenceCID) {
            console.log(
              "Usage: claims submit <communityId> <valuableActionId> <evidenceCID>",
            );
            return;
          }

          await manager.submitClaim(communityId, valuableActionId, evidenceCID);
          break;
        }

        case "info": {
          const claimId = parseInt(process.argv[4]);
          if (claimId === undefined) {
            console.log("Usage: claims info <claimId>");
            return;
          }
          await manager.getClaimInfo(claimId);
          break;
        }

        case "verify": {
          const claimId = parseInt(process.argv[4]);
          const approved = process.argv[5] === "true";

          if (claimId === undefined || process.argv[5] === undefined) {
            console.log("Usage: claims verify <claimId> <true|false>");
            return;
          }

          await manager.verifyClaim(claimId, approved);
          break;
        }

        default:
          console.log("Claims subcommands: submit, info, verify");
      }
      break;
    }

    case "vpt": {
      const subcommand = process.argv[3];

      switch (subcommand) {
        case "mint": {
          const to = process.argv[4];
          const communityId = parseInt(process.argv[5]);
          const amount = parseInt(process.argv[6]);

          if (!to || !communityId || !amount) {
            console.log("Usage: vpt mint <address> <communityId> <amount>");
            return;
          }

          await manager.mintVPT(to, communityId, amount);
          break;
        }

        case "balance": {
          const address = process.argv[4];
          const communityId = parseInt(process.argv[5]);

          if (!address || communityId === undefined) {
            console.log("Usage: vpt balance <address> <communityId>");
            return;
          }

          await manager.getVPTBalance(address, communityId);
          break;
        }

        case "eligibility": {
          const address = process.argv[4];
          const communityId = parseInt(process.argv[5]);

          if (!address || communityId === undefined) {
            console.log("Usage: vpt eligibility <address> <communityId>");
            return;
          }

          await manager.checkVotingEligibility(address, communityId);
          break;
        }

        default:
          console.log("VPT subcommands: mint, balance, eligibility");
      }
      break;
    }

    case "community": {
      const subcommand = process.argv[3];

      switch (subcommand) {
        case "info": {
          const communityId = parseInt(process.argv[4]);
          if (communityId === undefined) {
            console.log("Usage: community info <communityId>");
            return;
          }
          await manager.getCommunityInfo(communityId);
          break;
        }

        case "params": {
          const communityId = parseInt(process.argv[4]);
          if (communityId === undefined) {
            console.log("Usage: community params <communityId>");
            return;
          }
          await manager.getVPTParams(communityId);
          break;
        }

        default:
          console.log("Community subcommands: info, params");
      }
      break;
    }

    default:
      console.log("Shift DeSoc System Management CLI");
      console.log("\nAvailable commands:");
      console.log(
        "  status                                    - System status and overview",
      );
      console.log(
        "  elections create <id> <candidates> [h]    - Create verifier election",
      );
      console.log(
        "  elections info <electionId>               - Election information",
      );
      console.log(
        "  elections vote <id> <idx> <amount>        - Cast vote in election",
      );
      console.log(
        "  elections finalize <electionId>           - Finalize election",
      );
      console.log(
        "  governance proposal <proposalId>          - Proposal information",
      );
      console.log(
        "  governance vote <id> <support> [reason]   - Vote on proposal",
      );
      console.log(
        "  claims submit <cid> <vaid> <evidence>     - Submit work claim",
      );
      console.log(
        "  claims info <claimId>                     - Claim information",
      );
      console.log("  claims verify <id> <true|false>          - Verify claim");
      console.log(
        "  vpt mint <address> <cid> <amount>         - Mint VPT tokens",
      );
      console.log(
        "  vpt balance <address> <communityId>       - Check VPT balance",
      );
      console.log(
        "  vpt eligibility <address> <cid>           - Check voting eligibility",
      );
      console.log(
        "  community info <communityId>              - Community information",
      );
      console.log(
        "  community params <communityId>            - Community VPT parameters",
      );
      console.log("\nExamples:");
      console.log("  npm run status");
      console.log("  npm run manage elections create 1 0x123...,0x456... 72");
      console.log("  npm run manage vpt mint 0x123... 1 1000");
      console.log("  npm run manage claims submit 1 1 QmHash...");
  }
}

// Export for programmatic use
export { SystemManager, type SystemAddresses };

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Command failed:", error);
      process.exit(1);
    });
}

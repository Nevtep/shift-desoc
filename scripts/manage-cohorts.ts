#!/usr/bin/env node

/**
 * Shift DeSoc Cohort Management Script
 *
 * Manages investment cohorts for communities including:
 * - Creating new cohorts with specific ROI terms
 * - Adding investors to existing cohorts
 * - Monitoring cohort progress and completion
 * - Distributing revenue to cohorts
 * - Managing cohort lifecycle
 */

const hre = require("hardhat");
const { ethers } = hre;

// Load deployment addresses from environment or config
const ADDRESSES = {
  paramController: process.env.PARAM_CONTROLLER_ADDRESS,
  cohortRegistry: process.env.COHORT_REGISTRY_ADDRESS,
  revenueRouter: process.env.REVENUE_ROUTER_ADDRESS,
  communityToken: process.env.COMMUNITY_TOKEN_ADDRESS,
  valuableActionSBT: process.env.VALUABLE_ACTION_SBT_ADDRESS,
};

class CohortManager {
  private paramController: any;
  private cohortRegistry: any;
  private revenueRouter: any;
  private communityToken: any;
  private valuableActionSBT: any;
  private signer: any;

  async initialize() {
    [this.signer] = await ethers.getSigners();

    this.paramController = await ethers.getContractAt(
      "ParamController",
      ADDRESSES.paramController,
    );
    this.cohortRegistry = await ethers.getContractAt(
      "CohortRegistry",
      ADDRESSES.cohortRegistry,
    );
    this.revenueRouter = await ethers.getContractAt(
      "RevenueRouter",
      ADDRESSES.revenueRouter,
    );
    this.communityToken = await ethers.getContractAt(
      "CommunityToken",
      ADDRESSES.communityToken,
    );
    this.valuableActionSBT = await ethers.getContractAt(
      "ValuableActionSBT",
      ADDRESSES.valuableActionSBT,
    );

    console.log(`📋 Cohort Manager initialized for ${this.signer.address}`);
  }

  async createCohort(params: {
    communityId: number;
    targetROI: number; // ROI as percentage (120 = 120%)
    priorityWeight: number; // Weight for revenue distribution (1000-5000)
    maxInvestors: number; // Maximum number of investors
    minInvestment: string; // Minimum investment in USDC (e.g., "1000")
    maxTotalRaise: string; // Maximum total raise in USDC (e.g., "100000")
    termsURI: string; // IPFS URI for investment terms
  }) {
    console.log(
      `\n🆕 Creating new investment cohort for community ${params.communityId}`,
    );

    const cohortParams = {
      communityId: params.communityId,
      targetROIBps: params.targetROI * 100, // Convert percentage to basis points
      priorityWeight: params.priorityWeight,
      maxInvestors: params.maxInvestors,
      minInvestment: ethers.parseUnits(params.minInvestment, 6), // USDC has 6 decimals
      maxTotalRaise: ethers.parseUnits(params.maxTotalRaise, 6),
      termsHash: ethers.keccak256(ethers.toUtf8Bytes(params.termsURI)),
      termsURI: params.termsURI,
      valuableActionSBT: ADDRESSES.valuableActionSBT,
    };

    try {
      const tx = await this.cohortRegistry.createCohort(cohortParams);
      const receipt = await tx.wait();

      // Extract cohort ID from events
      const cohortCreatedEvent = receipt.logs.find(
        (log: any) =>
          log.topics[0] ===
          this.cohortRegistry.interface.getEventTopic("CohortCreated"),
      );

      if (cohortCreatedEvent) {
        const parsed =
          this.cohortRegistry.interface.parseLog(cohortCreatedEvent);
        const cohortId = parsed.args.cohortId;

        console.log(`✅ Cohort created successfully!`);
        console.log(`   Cohort ID: ${cohortId}`);
        console.log(`   Target ROI: ${params.targetROI}%`);
        console.log(`   Priority Weight: ${params.priorityWeight}`);
        console.log(`   Max Raise: $${params.maxTotalRaise} USDC`);
        console.log(`   Transaction: ${tx.hash}`);

        return cohortId;
      } else {
        throw new Error("CohortCreated event not found");
      }
    } catch (error) {
      console.error("❌ Failed to create cohort:", error);
      throw error;
    }
  }

  async addInvestor(params: {
    cohortId: number;
    investorAddress: string;
    investmentAmount: string; // Amount in USDC
  }) {
    console.log(`\n👤 Adding investor to cohort ${params.cohortId}`);

    const amount = ethers.parseUnits(params.investmentAmount, 6);

    try {
      const tx = await this.cohortRegistry.addInvestment(
        params.cohortId,
        params.investorAddress,
        amount,
      );

      const receipt = await tx.wait();

      console.log(`✅ Investor added successfully!`);
      console.log(`   Investor: ${params.investorAddress}`);
      console.log(`   Amount: $${params.investmentAmount} USDC`);
      console.log(`   Transaction: ${tx.hash}`);

      return receipt;
    } catch (error) {
      console.error("❌ Failed to add investor:", error);
      throw error;
    }
  }

  async getCohortInfo(cohortId: number) {
    console.log(`\n📊 Cohort ${cohortId} Information`);

    try {
      const cohort = await this.cohortRegistry.getCohort(cohortId);
      const weight = await this.cohortRegistry.getCohortWeight(cohortId);

      const totalInvestedFormatted = ethers.formatUnits(
        cohort.totalInvested,
        6,
      );
      const totalReturnedFormatted = ethers.formatUnits(
        cohort.totalReturned,
        6,
      );
      const targetTotal = (cohort.totalInvested * cohort.targetROIBps) / 10000n;
      const targetTotalFormatted = ethers.formatUnits(targetTotal, 6);

      const progressBps =
        cohort.totalInvested > 0n
          ? (cohort.totalReturned * 10000n) / cohort.totalInvested
          : 0n;

      console.log(`📋 Basic Information:`);
      console.log(`   Community ID: ${cohort.communityId}`);
      console.log(`   Target ROI: ${cohort.targetROIBps / 100}%`);
      console.log(`   Priority Weight: ${cohort.priorityWeight}`);
      console.log(`   Max Investors: ${cohort.maxInvestors}`);
      console.log(`   Current Investors: ${cohort.investorCount}`);

      console.log(`\n💰 Financial Status:`);
      console.log(`   Total Invested: $${totalInvestedFormatted} USDC`);
      console.log(`   Total Returned: $${totalReturnedFormatted} USDC`);
      console.log(`   Target Total: $${targetTotalFormatted} USDC`);
      console.log(`   Current ROI: ${progressBps / 100}%`);
      console.log(
        `   Progress: ${(progressBps * 100n) / cohort.targetROIBps}%`,
      );

      console.log(`\n⚖️  Distribution:`);
      console.log(`   Current Weight: ${weight}`);
      console.log(`   Active: ${cohort.active ? "✅" : "❌"}`);
      console.log(`   Completed: ${cohort.isCompleted ? "✅" : "❌"}`);

      if (cohort.isCompleted) {
        const completedDate = new Date(Number(cohort.completedAt) * 1000);
        console.log(`   Completed Date: ${completedDate.toISOString()}`);
      }

      return cohort;
    } catch (error) {
      console.error("❌ Failed to get cohort info:", error);
      throw error;
    }
  }

  async listActiveCohorts(communityId: number) {
    console.log(`\n📋 Active Cohorts for Community ${communityId}`);

    try {
      const activeCohortIds =
        await this.cohortRegistry.getActiveCohorts(communityId);

      if (activeCohortIds.length === 0) {
        console.log("   No active cohorts found");
        return [];
      }

      console.log(`   Found ${activeCohortIds.length} active cohorts:`);

      const cohorts = [];
      for (let i = 0; i < activeCohortIds.length; i++) {
        const cohortId = activeCohortIds[i];
        const cohort = await this.cohortRegistry.getCohort(cohortId);
        const weight = await this.cohortRegistry.getCohortWeight(cohortId);

        const totalInvestedFormatted = ethers.formatUnits(
          cohort.totalInvested,
          6,
        );
        const progressBps =
          cohort.totalInvested > 0n
            ? (cohort.totalReturned * 10000n) / cohort.totalInvested
            : 0n;

        console.log(`\n   📊 Cohort ${cohortId}:`);
        console.log(`      ROI Target: ${cohort.targetROIBps / 100}%`);
        console.log(`      Invested: $${totalInvestedFormatted}`);
        console.log(`      Progress: ${progressBps / 100}%`);
        console.log(`      Weight: ${weight}`);
        console.log(
          `      Investors: ${cohort.investorCount}/${cohort.maxInvestors}`,
        );

        cohorts.push({ cohortId, cohort, weight });
      }

      return cohorts;
    } catch (error) {
      console.error("❌ Failed to list cohorts:", error);
      throw error;
    }
  }

  async simulateRevenue(communityId: number, revenueAmount: string) {
    console.log(`\n🎯 Revenue Distribution Simulation`);
    console.log(`   Community: ${communityId}`);
    console.log(`   Revenue: $${revenueAmount} USDC`);

    try {
      const amount = ethers.parseUnits(revenueAmount, 6);
      const preview = await this.revenueRouter.previewDistribution(
        communityId,
        amount,
      );

      const workersFormatted = ethers.formatUnits(preview.workersAmount, 6);
      const treasuryFormatted = ethers.formatUnits(preview.treasuryAmount, 6);
      const investorsFormatted = ethers.formatUnits(preview.investorsAmount, 6);

      console.log(`\n💰 Distribution Breakdown:`);
      console.log(
        `   Workers: $${workersFormatted} USDC (${(preview.workersAmount * 100n) / amount}%)`,
      );
      console.log(
        `   Treasury: $${treasuryFormatted} USDC (${(preview.treasuryAmount * 100n) / amount}%)`,
      );
      console.log(
        `   Investors: $${investorsFormatted} USDC (${(preview.investorsAmount * 100n) / amount}%)`,
      );

      if (preview.cohortShares && preview.cohortShares.length > 0) {
        console.log(`\n📊 Cohort Distribution:`);
        for (let i = 0; i < preview.cohortShares.length; i++) {
          const share = preview.cohortShares[i];
          const shareFormatted = ethers.formatUnits(share.amount, 6);
          console.log(
            `   Cohort ${share.cohortId}: $${shareFormatted} (Weight: ${share.weight})`,
          );
        }
      }

      return preview;
    } catch (error) {
      console.error("❌ Failed to simulate revenue:", error);
      throw error;
    }
  }

  async distributeRevenue(communityId: number, revenueAmount: string) {
    console.log(`\n💸 Executing Revenue Distribution`);
    console.log(`   Community: ${communityId}`);
    console.log(`   Revenue: $${revenueAmount} USDC`);

    try {
      const amount = ethers.parseUnits(revenueAmount, 6);

      // First, simulate to show what will happen
      await this.simulateRevenue(communityId, revenueAmount);

      console.log(`\n⏳ Executing distribution...`);

      const tx = await this.revenueRouter.routeRevenue(communityId, amount);
      const receipt = await tx.wait();

      console.log(`✅ Revenue distributed successfully!`);
      console.log(`   Transaction: ${tx.hash}`);
      console.log(`   Gas Used: ${receipt.gasUsed}`);

      return receipt;
    } catch (error) {
      console.error("❌ Failed to distribute revenue:", error);
      throw error;
    }
  }
}

// CLI Commands
async function main() {
  const command = process.argv[2];
  const manager = new CohortManager();
  await manager.initialize();

  try {
    switch (command) {
      case "create":
        await handleCreateCohort(manager);
        break;
      case "add-investor":
        await handleAddInvestor(manager);
        break;
      case "info":
        await handleCohortInfo(manager);
        break;
      case "list":
        await handleListCohorts(manager);
        break;
      case "simulate":
        await handleSimulateRevenue(manager);
        break;
      case "distribute":
        await handleDistributeRevenue(manager);
        break;
      case "help":
      default:
        printHelp();
        break;
    }
  } catch (error) {
    console.error(`❌ Command failed:`, error.message);
    process.exit(1);
  }
}

async function handleCreateCohort(manager: CohortManager) {
  const communityId = parseInt(process.argv[3]) || 1;
  const targetROI = parseInt(process.argv[4]) || 120;
  const priorityWeight = parseInt(process.argv[5]) || 2000;
  const maxInvestors = parseInt(process.argv[6]) || 25;
  const minInvestment = process.argv[7] || "5000";
  const maxTotalRaise = process.argv[8] || "250000";
  const termsURI = process.argv[9] || "ipfs://QmExampleTerms";

  await manager.createCohort({
    communityId,
    targetROI,
    priorityWeight,
    maxInvestors,
    minInvestment,
    maxTotalRaise,
    termsURI,
  });
}

async function handleAddInvestor(manager: CohortManager) {
  const cohortId = parseInt(process.argv[3]);
  const investorAddress = process.argv[4];
  const investmentAmount = process.argv[5];

  if (!cohortId || !investorAddress || !investmentAmount) {
    console.error(
      "❌ Usage: npm run manage cohorts add-investor <cohortId> <investorAddress> <amount>",
    );
    process.exit(1);
  }

  await manager.addInvestor({
    cohortId,
    investorAddress,
    investmentAmount,
  });
}

async function handleCohortInfo(manager: CohortManager) {
  const cohortId = parseInt(process.argv[3]);

  if (!cohortId) {
    console.error("❌ Usage: npm run manage cohorts info <cohortId>");
    process.exit(1);
  }

  await manager.getCohortInfo(cohortId);
}

async function handleListCohorts(manager: CohortManager) {
  const communityId = parseInt(process.argv[3]) || 1;
  await manager.listActiveCohorts(communityId);
}

async function handleSimulateRevenue(manager: CohortManager) {
  const communityId = parseInt(process.argv[3]) || 1;
  const revenueAmount = process.argv[4] || "10000";

  await manager.simulateRevenue(communityId, revenueAmount);
}

async function handleDistributeRevenue(manager: CohortManager) {
  const communityId = parseInt(process.argv[3]) || 1;
  const revenueAmount = process.argv[4];

  if (!revenueAmount) {
    console.error(
      "❌ Usage: npm run manage cohorts distribute <communityId> <amount>",
    );
    process.exit(1);
  }

  await manager.distributeRevenue(communityId, revenueAmount);
}

function printHelp() {
  console.log(`
🏦 Shift DeSoc Cohort Management System

COMMANDS:
  create [communityId] [targetROI%] [weight] [maxInvestors] [minInvest] [maxRaise] [termsURI]
    Create a new investment cohort
    Example: npm run manage cohorts create 1 120 2000 25 5000 250000 ipfs://terms

  add-investor <cohortId> <investorAddress> <amount>
    Add an investor to an existing cohort
    Example: npm run manage cohorts add-investor 1 0x123... 10000

  info <cohortId>
    Get detailed information about a cohort
    Example: npm run manage cohorts info 1

  list [communityId]
    List all active cohorts for a community
    Example: npm run manage cohorts list 1

  simulate [communityId] [amount]
    Simulate revenue distribution without executing
    Example: npm run manage cohorts simulate 1 10000

  distribute <communityId> <amount>
    Execute actual revenue distribution
    Example: npm run manage cohorts distribute 1 10000

  help
    Show this help message

ENVIRONMENT VARIABLES:
  PARAM_CONTROLLER_ADDRESS   - ParamController contract address
  COHORT_REGISTRY_ADDRESS    - CohortRegistry contract address  
  REVENUE_ROUTER_ADDRESS     - RevenueRouter contract address
  COMMUNITY_TOKEN_ADDRESS    - CommunityToken contract address
  VALUABLE_ACTION_SBT_ADDRESS - ValuableActionSBT contract address

EXAMPLES:
  # Create a balanced growth cohort
  npm run manage cohorts create 1 125 2500 20 10000 500000

  # Add investor with $25,000 investment
  npm run manage cohorts add-investor 1 0xInvestorAddress 25000

  # Check cohort status
  npm run manage cohorts info 1

  # Simulate monthly revenue distribution
  npm run manage cohorts simulate 1 15000

  # Execute actual distribution
  npm run manage cohorts distribute 1 15000
`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error("💥 Unexpected error:", error);
    process.exit(1);
  });
}

export { CohortManager };

/**
 * Shift DeSoc Community Admin CLI
 *
 * Features:
 * - Create communities (registry + module wiring)
 * - Grant community roles (moderator/curator)
 * - Set parameters via ParamController (explicit inputs only)
 * - Manage TimelockController roles (proposer/executor/canceller/admin)
 *
 * Usage examples:
 *   HARDHAT_NETWORK=base_sepolia ts-node scripts/manage-communities.ts create "Pioneers" "Desc" "ipfs://..." 0
 *   HARDHAT_NETWORK=base_sepolia ts-node scripts/manage-communities.ts grant-role 1 moderator 0xabc...
 *   HARDHAT_NETWORK=base_sepolia ts-node scripts/manage-communities.ts set-params governance 1 86400 259200 86400
 *   HARDHAT_NETWORK=base_sepolia ts-node scripts/manage-communities.ts set-params verifier 1 5 3 20 true 1000 86400
 *   HARDHAT_NETWORK=base_sepolia ts-node scripts/manage-communities.ts timelock-roles grant proposer 0xabc...
 */

import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import hre from "hardhat";

const { ethers } = hre;
dotenv.config();

interface AddressBook {
  communityRegistry: string;
  paramController: string;
  membershipToken?: string;
  timelock: string;
  governor: string;
  countingMultiChoice?: string;
  verifierPowerToken?: string;
  verifierElection?: string;
  verifierManager?: string;
  valuableActionRegistry: string;
  claims: string;
  valuableActionSBT: string;
  communityToken: string;
  revenueRouter?: string;
  treasuryAdapter: string;
  requestHub: string;
  draftsManager: string;
  housingManager?: string;
  marketplace?: string;
  projectFactory?: string;
}

function loadDeploymentAddresses(network: string): AddressBook {
  const deploymentPath = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (fs.existsSync(deploymentPath)) {
    const data = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    if (data?.addresses) return data.addresses as AddressBook;
  }

  const latestPath = path.join(__dirname, "..", "deployments", "latest.json");
  if (fs.existsSync(latestPath)) {
    const data = JSON.parse(fs.readFileSync(latestPath, "utf8"));
    if (data?.network === network && data?.addresses) return data.addresses as AddressBook;
  }

  // Env fallback (base_sepolia only)
  if (network === "base_sepolia") {
    return {
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
    };
  }

  throw new Error(`No deployment addresses found for network ${network}`);
}

function requireAddress(addr: string, name: string): void {
  if (!addr || addr === "0x" || addr === ethers.ZeroAddress) {
    throw new Error(`Missing address for ${name}`);
  }
}

function parseBool(value: string): boolean {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`Invalid boolean: ${value}`);
}

class CommunityAdmin {
  private network: string;
  private addresses: AddressBook;
  private deployer!: any;
  private contracts: Record<string, any> = {};

  constructor(network: string, addresses: AddressBook) {
    this.network = network;
    this.addresses = addresses;
  }

  async init(): Promise<void> {
    [this.deployer] = await ethers.getSigners();

    requireAddress(this.addresses.communityRegistry, "communityRegistry");
    requireAddress(this.addresses.paramController, "paramController");
    requireAddress(this.addresses.governor, "governor");
    requireAddress(this.addresses.timelock, "timelock");
    requireAddress(this.addresses.valuableActionRegistry, "valuableActionRegistry");
    requireAddress(this.addresses.claims, "claims");
    requireAddress(this.addresses.valuableActionSBT, "valuableActionSBT");
    requireAddress(this.addresses.communityToken, "communityToken");
    requireAddress(this.addresses.treasuryAdapter, "treasuryAdapter");
    requireAddress(this.addresses.requestHub, "requestHub");
    requireAddress(this.addresses.draftsManager, "draftsManager");

    this.contracts.registry = await ethers.getContractAt(
      "CommunityRegistry",
      this.addresses.communityRegistry,
    );
    this.contracts.paramController = await ethers.getContractAt(
      "ParamController",
      this.addresses.paramController,
    );
    this.contracts.timelock = await ethers.getContractAt(
      "TimelockController",
      this.addresses.timelock,
    );
    this.contracts.governor = await ethers.getContractAt(
      "ShiftGovernor",
      this.addresses.governor,
    );
  }

  async createCommunity(
    name: string,
    description: string,
    metadataURI: string,
    parentId: number,
  ): Promise<number> {
    console.log(`\n🏠 Creating community '${name}' on ${this.network}`);
    const tx = await this.contracts.registry.registerCommunity(
      name,
      description,
      metadataURI,
      parentId,
    );
    const receipt = await tx.wait();

    let communityId = 0;
    for (const log of receipt.logs || []) {
      try {
        const parsed = this.contracts.registry.interface.parseLog(log);
        if (parsed.name === "CommunityRegistered") {
          communityId = Number(parsed.args.communityId);
          break;
        }
      } catch (err) {
        // ignore non-registry logs
      }
    }

    if (communityId === 0) {
      throw new Error("Could not parse communityId from CommunityRegistered event");
    }

    console.log(`✅ Community registered with ID ${communityId}`);

    const modules = {
      governor: this.addresses.governor,
      timelock: this.addresses.timelock,
      requestHub: this.addresses.requestHub,
      draftsManager: this.addresses.draftsManager,
      claimsManager: this.addresses.claims,
      valuableActionRegistry: this.addresses.valuableActionRegistry,
      verifierPowerToken: this.addresses.verifierPowerToken || ethers.ZeroAddress,
      verifierElection: this.addresses.verifierElection || ethers.ZeroAddress,
      verifierManager: this.addresses.verifierManager || ethers.ZeroAddress,
      valuableActionSBT: this.addresses.valuableActionSBT,
      treasuryAdapter: this.addresses.treasuryAdapter,
      communityToken: this.addresses.communityToken,
      paramController: this.addresses.paramController,
    };

    console.log("🔗 Setting module addresses...");
    const modTx = await this.contracts.registry.setModuleAddresses(
      communityId,
      modules,
    );
    await modTx.wait();
    console.log("✅ Module addresses set");

    console.log("👑 Founder/admin:", this.deployer.address);
    return communityId;
  }

  async grantCommunityRole(
    communityId: number,
    roleName: string,
    user: string,
  ): Promise<void> {
    const role = await this.resolveCommunityRole(roleName);
    console.log(`\n🎟️ Granting ${roleName} to ${user} in community ${communityId}`);
    const tx = await this.contracts.registry.grantCommunityRole(
      communityId,
      user,
      role,
    );
    await tx.wait();
    console.log("✅ Role granted");
  }

  private async resolveCommunityRole(roleName: string): Promise<string> {
    const lowered = roleName.toLowerCase();
    if (lowered === "moderator") return await this.contracts.registry.MODERATOR_ROLE();
    if (lowered === "curator") return await this.contracts.registry.CURATOR_ROLE();
    throw new Error(`Unsupported role '${roleName}'. Use moderator|curator.`);
  }

  async setGovernanceParams(
    communityId: number,
    debateWindow: number,
    voteWindow: number,
    executionDelay: number,
  ): Promise<void> {
    const tx = await this.contracts.paramController.setGovernanceParams(
      communityId,
      debateWindow,
      voteWindow,
      executionDelay,
    );
    await tx.wait();
    console.log("✅ Governance params updated");
  }

  async setEligibilityParams(
    communityId: number,
    minSeniority: number,
    minSBTs: number,
    proposalThreshold: bigint,
  ): Promise<void> {
    const tx = await this.contracts.paramController.setEligibilityParams(
      communityId,
      minSeniority,
      minSBTs,
      proposalThreshold,
    );
    await tx.wait();
    console.log("✅ Eligibility params updated");
  }

  async setRevenuePolicy(
    communityId: number,
    minWorkersBps: number,
    treasuryBps: number,
    investorsBps: number,
    spilloverTarget: number,
  ): Promise<void> {
    const total = minWorkersBps + treasuryBps + investorsBps;
    if (total !== 10000) {
      throw new Error("Revenue split must sum to 10000 bps");
    }

    const tx = await this.contracts.paramController.setRevenuePolicy(
      communityId,
      minWorkersBps,
      treasuryBps,
      investorsBps,
      spilloverTarget,
    );
    await tx.wait();
    console.log("✅ Revenue policy updated");
  }

  async setVerifierParams(
    communityId: number,
    panelSize: number,
    minApprovals: number,
    maxPanels: number,
    useWeighting: boolean,
    maxWeight: number,
    cooldown: number,
  ): Promise<void> {
    const tx = await this.contracts.paramController.setVerifierParams(
      communityId,
      panelSize,
      minApprovals,
      maxPanels,
      useWeighting,
      maxWeight,
      cooldown,
    );
    await tx.wait();
    console.log("✅ Verifier params updated");
  }

  async grantTimelockRole(roleName: string, target: string): Promise<void> {
    const role = await this.resolveTimelockRole(roleName);
    console.log(`\n🔐 Granting Timelock ${roleName} to ${target}`);
    const tx = await this.contracts.timelock.grantRole(role, target);
    await tx.wait();
    console.log("✅ Timelock role granted");
  }

  async renounceTimelockRole(roleName: string): Promise<void> {
    const role = await this.resolveTimelockRole(roleName);
    console.log(`\n🧹 Renouncing Timelock ${roleName} for ${this.deployer.address}`);
    const tx = await this.contracts.timelock.renounceRole(
      role,
      this.deployer.address,
    );
    await tx.wait();
    console.log("✅ Timelock role renounced");
  }

  private async resolveTimelockRole(roleName: string): Promise<string> {
    const lowered = roleName.toLowerCase();
    if (lowered === "proposer") return await this.contracts.timelock.PROPOSER_ROLE();
    if (lowered === "executor") return await this.contracts.timelock.EXECUTOR_ROLE();
    if (lowered === "canceller") return await this.contracts.timelock.CANCELLER_ROLE();
    if (lowered === "admin") return await this.contracts.timelock.TIMELOCK_ADMIN_ROLE();
    throw new Error("Invalid timelock role. Use proposer|executor|canceller|admin.");
  }
}

async function main() {
  const command = process.argv[2];
  const network = process.env.HARDHAT_NETWORK || "hardhat";
  if (!command) {
    printHelp();
    return;
  }

  const addresses = loadDeploymentAddresses(network);
  const admin = new CommunityAdmin(network, addresses);
  await admin.init();

  try {
    switch (command) {
      case "create": {
        const name = process.argv[3];
        const description = process.argv[4];
        const metadataURI = process.argv[5];
        const parent = process.argv[6] ? Number(process.argv[6]) : 0;
        if (!name || !description || !metadataURI) {
          console.log("Usage: create <name> <description> <metadataURI> [parentId]");
          return;
        }
        await admin.createCommunity(name, description, metadataURI, parent);
        break;
      }

      case "grant-role": {
        const communityId = Number(process.argv[3]);
        const role = process.argv[4];
        const user = process.argv[5];
        if (!communityId || !role || !user) {
          console.log("Usage: grant-role <communityId> <moderator|curator> <address>");
          return;
        }
        await admin.grantCommunityRole(communityId, role, user);
        break;
      }

      case "set-params": {
        const sub = process.argv[3];
        switch (sub) {
          case "governance": {
            const communityId = Number(process.argv[4]);
            const debate = Number(process.argv[5]);
            const vote = Number(process.argv[6]);
            const execution = Number(process.argv[7]);
            if (!communityId || !debate || !vote || !execution) {
              console.log("Usage: set-params governance <communityId> <debateWindow> <voteWindow> <executionDelay>");
              return;
            }
            await admin.setGovernanceParams(communityId, debate, vote, execution);
            break;
          }
          case "eligibility": {
            const communityId = Number(process.argv[4]);
            const minSeniority = Number(process.argv[5]);
            const minSBTs = Number(process.argv[6]);
            const proposalThreshold = process.argv[7]
              ? BigInt(process.argv[7])
              : undefined;
            if (
              !communityId ||
              Number.isNaN(minSeniority) ||
              Number.isNaN(minSBTs) ||
              proposalThreshold === undefined
            ) {
              console.log("Usage: set-params eligibility <communityId> <minSeniority> <minSBTs> <proposalThresholdWei>");
              return;
            }
            await admin.setEligibilityParams(
              communityId,
              minSeniority,
              minSBTs,
              proposalThreshold,
            );
            break;
          }
          case "revenue": {
            const communityId = Number(process.argv[4]);
            const workers = Number(process.argv[5]);
            const treasury = Number(process.argv[6]);
            const investors = Number(process.argv[7]);
            const spillover = Number(process.argv[8]);
            if (
              !communityId ||
              Number.isNaN(workers) ||
              Number.isNaN(treasury) ||
              Number.isNaN(investors) ||
              Number.isNaN(spillover)
            ) {
              console.log("Usage: set-params revenue <communityId> <workersBps> <treasuryBps> <investorsBps> <spilloverTarget 0|1>");
              return;
            }
            await admin.setRevenuePolicy(
              communityId,
              workers,
              treasury,
              investors,
              spillover,
            );
            break;
          }
          case "verifier": {
            const communityId = Number(process.argv[4]);
            const panel = Number(process.argv[5]);
            const min = Number(process.argv[6]);
            const maxPanels = Number(process.argv[7]);
            const useWeighting = parseBool(process.argv[8]);
            const maxWeight = Number(process.argv[9]);
            const cooldown = Number(process.argv[10]);
            if (
              !communityId ||
              Number.isNaN(panel) ||
              Number.isNaN(min) ||
              Number.isNaN(maxPanels) ||
              Number.isNaN(maxWeight) ||
              Number.isNaN(cooldown)
            ) {
              console.log(
                "Usage: set-params verifier <communityId> <panelSize> <minApprovals> <maxPanels> <useWeighting true|false> <maxWeight> <cooldown>",
              );
              return;
            }
            await admin.setVerifierParams(
              communityId,
              panel,
              min,
              maxPanels,
              useWeighting,
              maxWeight,
              cooldown,
            );
            break;
          }
          default:
            console.log("set-params subcommands: governance | eligibility | revenue | verifier");
        }
        break;
      }

      case "timelock-roles": {
        const sub = process.argv[3];
        const role = process.argv[4];
        if (!sub || !role) {
          console.log("Usage: timelock-roles <grant|renounce> <role> [address]");
          return;
        }
        if (sub === "grant") {
          const target = process.argv[5] || admin["deployer"].address;
          await admin.grantTimelockRole(role, target);
        } else if (sub === "renounce") {
          await admin.renounceTimelockRole(role);
        } else {
          console.log("Invalid timelock-roles subcommand. Use grant|renounce.");
        }
        break;
      }

      default:
        printHelp();
    }
  } catch (error: any) {
    console.error("❌ Command failed:", error?.reason || error?.message || error);
  }
}

function printHelp() {
  console.log("Shift DeSoc Community Admin CLI");
  console.log("Commands:");
  console.log("  create <name> <description> <metadataURI> [parentId]");
  console.log("  grant-role <communityId> <moderator|curator> <address>");
  console.log("  set-params governance <communityId> <debateWindow> <voteWindow> <executionDelay>");
  console.log("  set-params eligibility <communityId> <minSeniority> <minSBTs> <proposalThresholdWei>");
  console.log("  set-params revenue <communityId> <workersBps> <treasuryBps> <investorsBps> <spilloverTarget0or1>");
  console.log("  set-params verifier <communityId> <panelSize> <minApprovals> <maxPanels> <useWeighting> <maxWeight> <cooldown>");
  console.log("  timelock-roles <grant|renounce> <proposer|executor|canceller|admin> [address]");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { CommunityAdmin, type AddressBook };

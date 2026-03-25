import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { createConfig } from "@ponder/core";
import { http, type Abi, type AbiEvent } from "viem";
import { validateStartupEnv } from "./src/discovery/startup-env";

const network = (process.env.PONDER_NETWORK ?? "base_sepolia") as "base" | "base_sepolia";
const validated = validateStartupEnv({
  network,
  communityRegistryAddressRaw: process.env.COMMUNITY_REGISTRY_ADDRESS,
  communityRegistryStartBlockRaw: process.env.COMMUNITY_REGISTRY_START_BLOCK,
  communityRegistryChainIdRaw: process.env.COMMUNITY_REGISTRY_CHAIN_ID,
});
const communityRegistryAddress = validated.communityRegistryAddress;
const startBlock = validated.startBlock;

const abiPath = (file: string) => path.join(__dirname, "abis", file);
const loadAbi = (file: string) => {
  const parsed = JSON.parse(fs.readFileSync(abiPath(file), "utf8")) as { abi: Abi };
  return parsed.abi;
};

const communityRegistryAbi = loadAbi("CommunityRegistry.json");
const moduleAddressUpdatedEvent = communityRegistryAbi.find(
  (item: any) => item?.type === "event" && item?.name === "ModuleAddressUpdated"
) as AbiEvent | undefined;

if (!moduleAddressUpdatedEvent) {
  throw new Error("CommunityRegistry ABI is missing ModuleAddressUpdated event");
}

const discoveryFactory = {
  address: communityRegistryAddress,
  event: moduleAddressUpdatedEvent,
  parameter: "newAddress",
} as const;

const makeFactoryContract = (abiFile: string) => ({
  network,
  abi: loadAbi(abiFile),
  startBlock,
  factory: discoveryFactory,
});

const requestHubAbi = loadAbi("RequestHub.json");

const hasExpectedRequestHubEvent = requestHubAbi.some(
  (item: any) => item?.type === "event" && item?.name === "RequestCreated"
);

if (!hasExpectedRequestHubEvent) {
  throw new Error("RequestHub ABI missing RequestCreated event; contract discovery unusable");
}

console.log(`Using CommunityRegistry ${communityRegistryAddress} at start block ${startBlock}`);

export default createConfig({
  networks: {
    base: {
      chainId: 8453,
      transport: http(process.env.RPC_BASE ?? "https://mainnet.base.org"),
    },
    base_sepolia: {
      chainId: 84532,
      transport: http(process.env.RPC_BASE_SEPOLIA ?? "https://sepolia.base.org"),
    },
  },
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/shift",
  },
  contracts: {
    CommunityRegistry: {
      network,
      address: communityRegistryAddress,
      abi: communityRegistryAbi,
      startBlock,
    },
    RequestHub: makeFactoryContract("RequestHub.json"),
    DraftsManager: makeFactoryContract("DraftsManager.json"),
    ShiftGovernor: makeFactoryContract("ShiftGovernor.json"),
    CountingMultiChoice: makeFactoryContract("CountingMultiChoice.json"),
    Engagements: makeFactoryContract("Engagements.json"),
    VerifierManager: makeFactoryContract("VerifierManager.json"),
    ValuableActionRegistry: makeFactoryContract("ValuableActionRegistry.json"),
    RevenueRouter: makeFactoryContract("RevenueRouter.json"),
    TreasuryAdapter: makeFactoryContract("TreasuryAdapter.json"),
    CohortRegistry: makeFactoryContract("CohortRegistry.json"),
    InvestmentCohortManager: makeFactoryContract("InvestmentCohortManager.json"),
    PositionManager: makeFactoryContract("PositionManager.json"),
    CredentialManager: makeFactoryContract("CredentialManager.json"),
    Marketplace: makeFactoryContract("Marketplace.json"),
    HousingManager: makeFactoryContract("HousingManager.json"),
    CommerceDisputes: makeFactoryContract("CommerceDisputes.json"),
    ProjectFactory: makeFactoryContract("ProjectFactory.json"),
  },
});

#!/usr/bin/env node

import { createPublicClient, http, keccak256, toBytes } from "viem";
import { base, baseSepolia } from "viem/chains";

const ACCESS_MANAGER_ABI = [
  {
    type: "function",
    name: "ADMIN_ROLE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }]
  },
  {
    type: "function",
    name: "getTargetFunctionRole",
    stateMutability: "view",
    inputs: [
      { name: "target", type: "address" },
      { name: "selector", type: "bytes4" }
    ],
    outputs: [{ name: "roleId", type: "uint64" }]
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "roleId", type: "uint64" },
      { name: "account", type: "address" }
    ],
    outputs: [
      { name: "isMember", type: "bool" },
      { name: "executionDelay", type: "uint32" }
    ]
  }
];

const VPT_ELECTION_POWER_ROLE = 1001n;
const VERIFIER_MANAGER_CALLER_ROLE = 15n;
const COHORT_REVENUE_ROUTER_ROLE = 1n;
const COHORT_INVESTMENT_RECORDER_ROLE = 2n;
const REVENUE_ROUTER_POSITION_MANAGER_ROLE = 7n;
const REVENUE_ROUTER_DISTRIBUTOR_ROLE = 6n;
const VALUABLE_ACTION_REGISTRY_ISSUER_ROLE = 3n;
const VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE = 17n;
const MEMBERSHIP_TOKEN_MINTER_ROLE = 11n;
const MEMBERSHIP_TOKEN_GOVERNANCE_ROLE = 12n;
const VALUABLE_ACTION_SBT_MANAGER_ROLE = 4n;
const COMMERCE_DISPUTES_CALLER_ROLE = 13n;
const HOUSING_MARKETPLACE_CALLER_ROLE = 14n;
const CREDENTIAL_MANAGER_APPROVER_ROLE = 16n;

const CHECKS = [
  { targetKey: "valuableActionRegistry", signature: "setValuableActionSBT(address)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setIssuancePaused(bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setIssuanceModule(address,bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setCommunityNarrowing(bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setCommunityIssuanceModule(address,bool)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "addFounder(address)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "proposeValuableAction((uint32,uint32,uint32,uint8,bytes32,uint32,uint8,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64),bytes32)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "activateFromGovernance(uint256,bytes32)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "update(uint256,(uint32,uint32,uint32,uint8,bytes32,uint32,uint8,uint32,uint32,uint32,uint32,uint32,bool,uint32,uint256,address,string,string,bytes32[],uint64,uint64))", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "deactivate(uint256)", role: "ADMIN" },
  { targetKey: "valuableActionRegistry", signature: "setModerator(address,bool)", role: VALUABLE_ACTION_REGISTRY_MODERATOR_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issueEngagement(address,uint8,bytes32,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issuePosition(address,bytes32,uint32,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issueInvestment(address,uint256,uint32,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "closePositionToken(uint256,uint8)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },
  { targetKey: "valuableActionRegistry", signature: "issueRoleFromPosition(address,bytes32,uint32,uint64,uint64,uint8,bytes)", role: VALUABLE_ACTION_REGISTRY_ISSUER_ROLE },

  { targetKey: "engagements", signature: "revoke(uint256)", role: "ADMIN" },
  { targetKey: "engagements", signature: "updateContracts(address,address)", role: "ADMIN" },

  { targetKey: "verifierElection", signature: "setVerifierSet(address[],uint256[],string)", role: "ADMIN" },
  { targetKey: "verifierElection", signature: "banVerifiers(address[],string)", role: "ADMIN" },
  { targetKey: "verifierElection", signature: "unbanVerifier(address,string)", role: "ADMIN" },
  { targetKey: "verifierElection", signature: "adjustVerifierPower(address,uint256,string)", role: "ADMIN" },

  { targetKey: "verifierManager", signature: "selectJurors(uint256,uint256,uint256,bool)", role: VERIFIER_MANAGER_CALLER_ROLE },
  { targetKey: "verifierManager", signature: "reportFraud(uint256,address[],string)", role: VERIFIER_MANAGER_CALLER_ROLE },

  { targetKey: "verifierPowerToken", signature: "initializeCommunity(string)", role: "ADMIN" },
  { targetKey: "verifierPowerToken", signature: "adminTransfer(address,address,uint256,string)", role: "ADMIN" },
  { targetKey: "verifierPowerToken", signature: "setURI(string)", role: "ADMIN" },
  { targetKey: "verifierPowerToken", signature: "mint(address,uint256,string)", role: VPT_ELECTION_POWER_ROLE },
  { targetKey: "verifierPowerToken", signature: "burn(address,uint256,string)", role: VPT_ELECTION_POWER_ROLE },
  { targetKey: "verifierPowerToken", signature: "batchMint(address[],uint256[],string)", role: VPT_ELECTION_POWER_ROLE },
  { targetKey: "verifierPowerToken", signature: "batchBurn(address[],uint256[],string)", role: VPT_ELECTION_POWER_ROLE },

  { targetKey: "positionManager", signature: "setRevenueRouter(address)", role: "ADMIN" },
  { targetKey: "positionManager", signature: "definePositionType(bytes32,uint32,bool)", role: "ADMIN" },
  { targetKey: "positionManager", signature: "approveApplication(uint256,bytes)", role: "ADMIN" },
  { targetKey: "positionManager", signature: "closePosition(uint256,uint8,bytes)", role: "ADMIN" },

  { targetKey: "credentialManager", signature: "defineCourse(bytes32,address,bool)", role: "ADMIN" },
  { targetKey: "credentialManager", signature: "setCourseActive(bytes32,bool)", role: "ADMIN" },
  { targetKey: "credentialManager", signature: "revokeCredential(uint256,bytes32,bytes)", role: "ADMIN" },
  { targetKey: "credentialManager", signature: "approveApplication(uint256)", role: CREDENTIAL_MANAGER_APPROVER_ROLE },

  { targetKey: "cohortRegistry", signature: "createCohort(uint16,uint32,bytes32,uint64,uint64,bool)", role: "ADMIN" },
  { targetKey: "cohortRegistry", signature: "setCohortActive(uint256,bool)", role: "ADMIN" },
  { targetKey: "cohortRegistry", signature: "markRecovered(uint256,uint256)", role: COHORT_REVENUE_ROUTER_ROLE },
  { targetKey: "cohortRegistry", signature: "addInvestment(uint256,address,uint256,uint256)", role: COHORT_INVESTMENT_RECORDER_ROLE },

  { targetKey: "investmentCohortManager", signature: "createCohort(uint16,uint32,bytes32,uint64,uint64,bool)", role: "ADMIN" },
  { targetKey: "investmentCohortManager", signature: "setCohortActive(uint256,bool)", role: "ADMIN" },
  { targetKey: "investmentCohortManager", signature: "issueInvestment(address,uint256,uint32,bytes)", role: "ADMIN" },

  { targetKey: "revenueRouter", signature: "setCommunityTreasury(address)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "setSupportedToken(address,bool)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "setParamController(address)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "setCohortRegistry(address)", role: "ADMIN" },
  { targetKey: "revenueRouter", signature: "registerPosition(uint256)", role: REVENUE_ROUTER_POSITION_MANAGER_ROLE },
  { targetKey: "revenueRouter", signature: "unregisterPosition(uint256)", role: REVENUE_ROUTER_POSITION_MANAGER_ROLE },
  { targetKey: "revenueRouter", signature: "routeRevenue(address,uint256)", role: REVENUE_ROUTER_DISTRIBUTOR_ROLE },

  { targetKey: "treasuryAdapter", signature: "setTokenAllowed(address,bool)", role: "ADMIN" },
  { targetKey: "treasuryAdapter", signature: "setDestinationAllowed(address,bool)", role: "ADMIN" },
  { targetKey: "treasuryAdapter", signature: "setVaultAdapterAllowed(address,bool)", role: "ADMIN" },
  { targetKey: "treasuryAdapter", signature: "setCapBps(address,uint16)", role: "ADMIN" },

  { targetKey: "marketplace", signature: "setCommunityActive(bool)", role: "ADMIN" },
  { targetKey: "marketplace", signature: "setCommunityToken(address)", role: "ADMIN" },
  { targetKey: "marketplace", signature: "setCommerceDisputes(address)", role: "ADMIN" },
  { targetKey: "marketplace", signature: "setRevenueRouter(address)", role: "ADMIN" },

  { targetKey: "membershipToken", signature: "mint(address,uint256,string)", role: MEMBERSHIP_TOKEN_MINTER_ROLE },
  { targetKey: "membershipToken", signature: "batchMint(address[],uint256[],string)", role: MEMBERSHIP_TOKEN_MINTER_ROLE },
  { targetKey: "membershipToken", signature: "emergencyBurn(address,uint256)", role: MEMBERSHIP_TOKEN_GOVERNANCE_ROLE },

  { targetKey: "valuableActionSBT", signature: "mintEngagement(address,uint8,bytes32,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "mintPosition(address,bytes32,uint32,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "mintRoleFromPosition(address,bytes32,uint32,uint64,uint64,uint8,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "mintInvestment(address,uint256,uint32,bytes)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "setEndedAt(uint256,uint64)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "closePositionToken(uint256,uint8)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },
  { targetKey: "valuableActionSBT", signature: "updateTokenURI(uint256,string)", role: VALUABLE_ACTION_SBT_MANAGER_ROLE },

  { targetKey: "commerceDisputes", signature: "setDisputeReceiver(address)", role: "ADMIN" },
  { targetKey: "commerceDisputes", signature: "finalizeDispute(uint256,uint8)", role: "ADMIN" },
  { targetKey: "commerceDisputes", signature: "cancelDispute(uint256)", role: "ADMIN" },
  { targetKey: "commerceDisputes", signature: "openDispute(uint8,uint256,address,address,uint256,string)", role: COMMERCE_DISPUTES_CALLER_ROLE },

  { targetKey: "housingManager", signature: "createUnit(address,string,uint256,uint256,uint256)", role: "ADMIN" },
  { targetKey: "housingManager", signature: "consume(uint256,address,bytes,uint256)", role: HOUSING_MARKETPLACE_CALLER_ROLE },
  { targetKey: "housingManager", signature: "onOrderSettled(uint256,uint256,uint8)", role: HOUSING_MARKETPLACE_CALLER_ROLE }
];

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const value = argv[i + 1];
    out[key.slice(2)] = value;
    i += 1;
  }
  return out;
}

function requireAddress(args, key) {
  const value = args[key];
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Missing or invalid --${key} address`);
  }
  return value;
}

function selector(signature) {
  return `0x${keccak256(toBytes(signature)).slice(2, 10)}`;
}

function usage() {
  return [
    "Usage:",
    "node apps/web/scripts/verify-access-wiring.mjs \\",
    "  --rpcUrl <url> --chain base_sepolia|base \\",
    "  --accessManager <0x...> --timelock <0x...> \\",
    "  --valuableActionRegistry <0x...> --verifierElection <0x...> --verifierManager <0x...> \\",
    "  --verifierPowerToken <0x...> --engagements <0x...> --positionManager <0x...> --credentialManager <0x...> \\",
    "  --membershipToken <0x...> --valuableActionSBT <0x...> --cohortRegistry <0x...> --investmentCohortManager <0x...> \\",
    "  --commerceDisputes <0x...> --housingManager <0x...> \\",
    "  --revenueRouter <0x...> --treasuryAdapter <0x...> \\",
    "  --marketplace <0x...>"
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.rpcUrl) {
    console.error(usage());
    process.exit(1);
  }

  const addresses = {
    accessManager: requireAddress(args, "accessManager"),
    timelock: requireAddress(args, "timelock"),
    valuableActionRegistry: requireAddress(args, "valuableActionRegistry"),
    verifierElection: requireAddress(args, "verifierElection"),
    verifierManager: requireAddress(args, "verifierManager"),
    verifierPowerToken: requireAddress(args, "verifierPowerToken"),
    engagements: requireAddress(args, "engagements"),
    positionManager: requireAddress(args, "positionManager"),
    credentialManager: requireAddress(args, "credentialManager"),
    membershipToken: requireAddress(args, "membershipToken"),
    valuableActionSBT: requireAddress(args, "valuableActionSBT"),
    cohortRegistry: requireAddress(args, "cohortRegistry"),
    investmentCohortManager: requireAddress(args, "investmentCohortManager"),
    revenueRouter: requireAddress(args, "revenueRouter"),
    treasuryAdapter: requireAddress(args, "treasuryAdapter"),
    commerceDisputes: requireAddress(args, "commerceDisputes"),
    housingManager: requireAddress(args, "housingManager"),
    marketplace: requireAddress(args, "marketplace")
  };

  const chain = args.chain === "base" ? base : baseSepolia;
  const client = createPublicClient({ chain, transport: http(args.rpcUrl) });
  const adminRole = await client.readContract({
    address: addresses.accessManager,
    abi: ACCESS_MANAGER_ABI,
    functionName: "ADMIN_ROLE"
  });

  const rows = [];
  let ok = true;

  for (const check of CHECKS) {
    const target = addresses[check.targetKey];
    const sigSelector = selector(check.signature);

    const role = await client.readContract({
      address: addresses.accessManager,
      abi: ACCESS_MANAGER_ABI,
      functionName: "getTargetFunctionRole",
      args: [target, sigSelector]
    });

    const expected = check.role === "ADMIN" ? BigInt(adminRole) : BigInt(check.role);

    const [timelockHasRole] = await client.readContract({
      address: addresses.accessManager,
      abi: ACCESS_MANAGER_ABI,
      functionName: "hasRole",
      args: [expected, addresses.timelock]
    });

    const actual = BigInt(role);
    const rowOk = actual === expected && (check.role !== "ADMIN" || timelockHasRole === true);
    if (!rowOk) ok = false;

    rows.push({
      target,
      signature: check.signature,
      selector: sigSelector,
      role: actual.toString(),
      expectedRole: expected.toString(),
      timelockHasRole,
      ok: rowOk
    });
  }

  const [timelockHasAdminRole] = await client.readContract({
    address: addresses.accessManager,
    abi: ACCESS_MANAGER_ABI,
    functionName: "hasRole",
    args: [BigInt(adminRole), addresses.timelock]
  });

  const report = {
    chain: chain.name,
    accessManager: addresses.accessManager,
    timelock: addresses.timelock,
    timelockHasAdminRole,
    ok: ok && timelockHasAdminRole === true,
    checks: rows
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

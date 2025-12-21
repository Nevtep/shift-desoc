import type { Abi, Address } from "viem";
import { baseSepolia } from "wagmi/chains";

import baseSepoliaDeployment from "../../../deployments/base_sepolia.json" assert { type: "json" };

type DeploymentJson = typeof baseSepoliaDeployment;

type ContractKey = keyof DeploymentJson["addresses"];

type ChainId = typeof baseSepolia.id | number;

// Key deployments by chain id to avoid network string mismatches (base_sepolia vs base-sepolia).
const deployments: Record<number, DeploymentJson> = {
  [baseSepolia.id]: baseSepoliaDeployment
};

const requestHubAbi: Abi = [
  {
    type: "function",
    name: "createRequest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "communityId", type: "uint256" },
      { name: "title", type: "string" },
      { name: "cid", type: "string" },
      { name: "tags", type: "string[]" }
    ],
    outputs: [{ name: "requestId", type: "uint256" }]
  }
];

const claimsAbi: Abi = [
  {
    type: "function",
    name: "submit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "typeId", type: "uint256" },
      { name: "evidenceCID", type: "string" }
    ],
    outputs: [{ name: "claimId", type: "uint256" }]
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimId", type: "uint256" },
      { name: "approve", type: "bool" }
    ],
    outputs: []
  }
];

const governorAbi: Abi = [
  {
    type: "function",
    name: "castVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" }
    ],
    outputs: [{ name: "weight", type: "uint256" }]
  },
  {
    type: "function",
    name: "castVoteWithReason",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
      { name: "reason", type: "string" }
    ],
    outputs: [{ name: "weight", type: "uint256" }]
  },
  {
    type: "function",
    name: "castVoteMultiChoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "weights", type: "uint256[]" },
      { name: "reason", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "queue",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "descriptionHash", type: "bytes32" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "descriptionHash", type: "bytes32" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
];

const draftsManagerAbi: Abi = [
  {
    type: "function",
    name: "createDraft",
    stateMutability: "nonpayable",
    inputs: [
      { name: "communityId", type: "uint256" },
      { name: "requestId", type: "uint256" },
      {
        name: "actions",
        type: "tuple",
        components: [
          { name: "targets", type: "address[]" },
          { name: "values", type: "uint256[]" },
          { name: "calldatas", type: "bytes[]" },
          { name: "actionsHash", type: "bytes32" }
        ]
      },
      { name: "versionCID", type: "string" }
    ],
    outputs: [{ name: "draftId", type: "uint256" }]
  },
  {
    type: "function",
    name: "escalateToProposal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "draftId", type: "uint256" },
      { name: "multiChoice", type: "bool" },
      { name: "numOptions", type: "uint8" },
      { name: "description", type: "string" }
    ],
    outputs: [{ name: "proposalId", type: "uint256" }]
  }
];

export const CONTRACTS = {
  requestHub: {
    key: "requestHub" as ContractKey,
    abi: requestHubAbi
  },
  claims: {
    key: "claims" as ContractKey,
    abi: claimsAbi
  },
  governor: {
    key: "governor" as ContractKey,
    abi: governorAbi
  },
  draftsManager: {
    key: "draftsManager" as ContractKey,
    abi: draftsManagerAbi
  }
};

export function getContractAddress(key: ContractKey, chainId?: ChainId): Address {
  const requestedChain = Number(chainId) || baseSepolia.id;

  if (requestedChain !== baseSepolia.id) {
    throw new Error("Unsupported chain. Switch to Base Sepolia.");
  }

  const deployment = deployments[baseSepolia.id];

  if (!deployment) {
    throw new Error("No deployments configured");
  }

  const addr = deployment.addresses[key];
  if (!addr) {
    throw new Error(`Missing address for ${key}`);
  }

  return addr as Address;
}

export function getContractConfig<TAbi extends Abi>(key: keyof typeof CONTRACTS, chainId?: ChainId) {
  const meta = CONTRACTS[key];
  return {
    address: getContractAddress(meta.key, chainId),
    abi: meta.abi as TAbi
  } as const;
}

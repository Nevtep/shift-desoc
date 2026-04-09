import type { Abi } from "viem";

import communityRegistryArtifact from "../../abis/CommunityRegistry.json" assert { type: "json" };
import cohortRegistryArtifact from "../../abis/CohortRegistry.json" assert { type: "json" };
import commerceDisputesArtifact from "../../abis/CommerceDisputes.json" assert { type: "json" };
import credentialManagerArtifact from "../../abis/CredentialManager.json" assert { type: "json" };
import draftsManagerArtifact from "../../abis/DraftsManager.json" assert { type: "json" };
import engagementsArtifact from "../../abis/Engagements.json" assert { type: "json" };
import housingManagerArtifact from "../../abis/HousingManager.json" assert { type: "json" };
import investmentCohortManagerArtifact from "../../abis/InvestmentCohortManager.json" assert { type: "json" };
import marketplaceArtifact from "../../abis/Marketplace.json" assert { type: "json" };
import membershipTokenArtifact from "../../abis/MembershipTokenERC20Votes.json" assert { type: "json" };
import paramControllerArtifact from "../../abis/ParamController.json" assert { type: "json" };
import positionManagerArtifact from "../../abis/PositionManager.json" assert { type: "json" };
import revenueRouterArtifact from "../../abis/RevenueRouter.json" assert { type: "json" };
import treasuryAdapterArtifact from "../../abis/TreasuryAdapter.json" assert { type: "json" };
import valuableActionRegistryArtifact from "../../abis/ValuableActionRegistry.json" assert { type: "json" };
import valuableActionSBTArtifact from "../../abis/ValuableActionSBT.json" assert { type: "json" };
import verifierElectionArtifact from "../../abis/VerifierElection.json" assert { type: "json" };
import verifierManagerArtifact from "../../abis/VerifierManager.json" assert { type: "json" };
import verifierPowerTokenArtifact from "../../abis/VerifierPowerToken1155.json" assert { type: "json" };

import type { AllowlistTargetId } from "./allowlist";

export type ActionTargetId = AllowlistTargetId;

export type ActionTargetDefinition = {
  id: ActionTargetId;
  label: string;
  description: string;
  abi: Abi;
};

const TARGET_DEFINITIONS: Record<ActionTargetId, ActionTargetDefinition> = {
  communityRegistry: {
    id: "communityRegistry",
    label: "CommunityRegistry",
    description: "Community metadata, module wiring, and role management",
    abi: communityRegistryArtifact.abi as Abi
  },
  cohortRegistry: {
    id: "cohortRegistry",
    label: "CohortRegistry",
    description: "Investment cohort lifecycle and cohort status governance",
    abi: cohortRegistryArtifact.abi as Abi
  },
  commerceDisputes: {
    id: "commerceDisputes",
    label: "CommerceDisputes",
    description: "Commerce dispute resolution and settlement controls",
    abi: commerceDisputesArtifact.abi as Abi
  },
  credentialManager: {
    id: "credentialManager",
    label: "CredentialManager",
    description: "Credential course management and credential revocation",
    abi: credentialManagerArtifact.abi as Abi
  },
  draftsManager: {
    id: "draftsManager",
    label: "DraftsManager",
    description: "Draft lifecycle and governance proposal escalation",
    abi: draftsManagerArtifact.abi as Abi
  },
  engagements: {
    id: "engagements",
    label: "Engagements",
    description: "Work verification engagement outcomes and contract references",
    abi: engagementsArtifact.abi as Abi
  },
  housingManager: {
    id: "housingManager",
    label: "HousingManager",
    description: "Housing unit creation and booking lifecycle management",
    abi: housingManagerArtifact.abi as Abi
  },
  investmentCohortManager: {
    id: "investmentCohortManager",
    label: "InvestmentCohortManager",
    description: "Investment cohort orchestration and investment issuance",
    abi: investmentCohortManagerArtifact.abi as Abi
  },
  marketplace: {
    id: "marketplace",
    label: "Marketplace",
    description: "Commerce marketplace configuration and routing",
    abi: marketplaceArtifact.abi as Abi
  },
  membershipToken: {
    id: "membershipToken",
    label: "MembershipTokenERC20Votes",
    description: "Governance membership token mint and emergency burn controls",
    abi: membershipTokenArtifact.abi as Abi
  },
  paramController: {
    id: "paramController",
    label: "ParamController",
    description: "Community governance and economics parameter controls",
    abi: paramControllerArtifact.abi as Abi
  },
  positionManager: {
    id: "positionManager",
    label: "PositionManager",
    description: "Position lifecycle and position type definitions",
    abi: positionManagerArtifact.abi as Abi
  },
  revenueRouter: {
    id: "revenueRouter",
    label: "RevenueRouter",
    description: "Treasury routing and token support controls",
    abi: revenueRouterArtifact.abi as Abi
  },
  treasuryAdapter: {
    id: "treasuryAdapter",
    label: "TreasuryAdapter",
    description: "Treasury spend guardrails and token/destination permissions",
    abi: treasuryAdapterArtifact.abi as Abi
  },
  valuableActionRegistry: {
    id: "valuableActionRegistry",
    label: "ValuableActionRegistry",
    description: "Valuable action issuance and activation policy controls",
    abi: valuableActionRegistryArtifact.abi as Abi
  },
  valuableActionSBT: {
    id: "valuableActionSBT",
    label: "ValuableActionSBT",
    description: "Valuable action reputation token issuance and lifecycle",
    abi: valuableActionSBTArtifact.abi as Abi
  },
  verifierElection: {
    id: "verifierElection",
    label: "VerifierElection",
    description: "Verifier roster, bans, and power management",
    abi: verifierElectionArtifact.abi as Abi
  },
  verifierManager: {
    id: "verifierManager",
    label: "VerifierManager",
    description: "Verifier juror operations and fraud reporting controls",
    abi: verifierManagerArtifact.abi as Abi
  },
  verifierPowerToken: {
    id: "verifierPowerToken",
    label: "VerifierPowerToken1155",
    description: "Verifier power token community initialization and metadata",
    abi: verifierPowerTokenArtifact.abi as Abi
  }
};

export function listActionTargets(): ActionTargetDefinition[] {
  return Object.values(TARGET_DEFINITIONS);
}

export function listActionTargetIds(): ActionTargetId[] {
  return Object.keys(TARGET_DEFINITIONS) as ActionTargetId[];
}

export function getTargetDefinition(targetId: ActionTargetId): ActionTargetDefinition {
  return TARGET_DEFINITIONS[targetId];
}

export function getTargetAbi(targetId: ActionTargetId): Abi {
  return TARGET_DEFINITIONS[targetId].abi;
}

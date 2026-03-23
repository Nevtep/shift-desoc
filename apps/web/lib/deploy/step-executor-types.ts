import type { Abi } from "viem";

import type { CommunityDeploymentConfig } from "./config";
import type {
  DeploymentRunAddresses,
  DeploymentWizardSession,
  PreflightAssessment,
  StepKey,
} from "./types";

export type StepExecutionResult = {
  txHashes?: `0x${string}`[];
  communityId?: number;
  deploymentAddresses?: DeploymentRunAddresses;
};

export type StepExecutor = (
  step: StepKey,
  session: DeploymentWizardSession,
  context: {
    config: CommunityDeploymentConfig;
    chainId: number;
    preflight: PreflightAssessment;
    onTxConfirmed?: (txHash: `0x${string}`) => void;
    onDeploymentAddresses?: (addresses: Partial<DeploymentRunAddresses>) => void;
  }
) => Promise<StepExecutionResult>;

export type WriteContractAsync = (args: {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  gas?: bigint;
  nonce?: bigint;
}) => Promise<`0x${string}`>;

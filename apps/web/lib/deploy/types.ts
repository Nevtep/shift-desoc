export type StepKey =
  | "PRECHECKS"
  | "DEPLOY_STACK"
  | "CONFIGURE_ACCESS_PERMISSIONS"
  | "HANDOFF_ADMIN_TO_TIMELOCK"
  | "VERIFY_DEPLOYMENT";

export type StepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

export type WizardStatus = "idle" | "preflight-blocked" | "in-progress" | "failed" | "completed";

export type VerificationCheckKey =
  | "MODULE_WIRING_VALUABLE_ACTION_REGISTRY"
  | "VPT_COMMUNITY_INITIALIZED"
  | "ROLE_RR_POSITION_MANAGER"
  | "ROLE_RR_DISTRIBUTOR"
  | "ROLE_COMMERCE_DISPUTES_CALLER"
  | "ROLE_HOUSING_MARKETPLACE_CALLER"
  | "ROLE_VA_ISSUER_REQUEST_HUB"
  | "MARKETPLACE_COMMUNITY_ACTIVE"
  | "REVENUE_ROUTER_TREASURY_SET";

export type DeploymentRunAddresses = {
  communityRegistry: `0x${string}`;
  paramController: `0x${string}`;
  accessManager: `0x${string}`;
  membershipToken?: `0x${string}`;
  governor: `0x${string}`;
  timelock: `0x${string}`;
  requestHub: `0x${string}`;
  draftsManager: `0x${string}`;
  engagements: `0x${string}`;
  positionManager?: `0x${string}`;
  valuableActionRegistry: `0x${string}`;
  verifierPowerToken: `0x${string}`;
  verifierElection: `0x${string}`;
  verifierManager: `0x${string}`;
  valuableActionSBT: `0x${string}`;
  treasuryAdapter: `0x${string}`;
  communityToken: `0x${string}`;
  revenueRouter: `0x${string}`;
  marketplace: `0x${string}`;
};

export type DeploymentStepState = {
  key: StepKey;
  name: string;
  purpose: string;
  status: StepStatus;
  expectedTxCount: number;
  confirmedTxCount: number;
  txHashes: `0x${string}`[];
  startedAt?: string;
  endedAt?: string;
  failureReason?: string;
  nextActionHint?: string;
};

export type DeploymentWizardSession = {
  sessionId: string;
  deployerAddress: `0x${string}`;
  chainId: number;
  communityId?: number;
  deploymentAddresses?: DeploymentRunAddresses;
  deploymentConfig?: {
    communityName: string;
    communityDescription: string;
    communityMetadataUri: string;
    treasuryVault: string;
    treasuryStableToken: string;
    supportedTokensCsv: string;
  };
  targetType: "pre-registration" | "registered";
  status: WizardStatus;
  createdAt: string;
  updatedAt: string;
  steps: DeploymentStepState[];
  lastError?: { code: string; message: string; stepKey?: StepKey };
};

export type ProbeStatus = {
  address?: `0x${string}`;
  hasCode: boolean;
  abiProbePassed: boolean;
  reason?: string;
};

export type SharedInfraStatus = {
  addressesPresent: boolean;
  paramController: ProbeStatus;
  communityRegistry: ProbeStatus;
  governanceLayerFactory: ProbeStatus;
  verificationLayerFactory: ProbeStatus;
  economicLayerFactory: ProbeStatus;
  commerceLayerFactory: ProbeStatus;
  coordinationLayerFactory: ProbeStatus;
  isUsable: boolean;
};

export type FundingAssessment = {
  requiredWei: bigint;
  currentBalanceWei: bigint;
  bufferMultiplierBps: number;
  estimatedTxCount: number;
  estimatedGasPerTx: bigint;
  maxFeePerGasWei: bigint;
  isSufficient: boolean;
  recommendedAdditionalWei?: bigint;
};

export type PreflightAssessment = {
  walletConnected: boolean;
  connectedAddress?: `0x${string}`;
  supportedNetwork: boolean;
  chainId: number;
  sharedInfra: SharedInfraStatus;
  funding: FundingAssessment;
  blockingReasons: string[];
};

export type VerificationCheckResult = {
  key: VerificationCheckKey;
  label: string;
  passed: boolean;
  failureReason?: string;
};

export type VerificationSnapshot = {
  communityId: number;
  modules: {
    valuableActionRegistryMatches: boolean;
  };
  vptInitialized: boolean;
  roles: {
    rrPositionManager: boolean;
    rrDistributor: boolean;
    commerceDisputesCaller: boolean;
    housingMarketplaceCaller: boolean;
    vaIssuerRequestHub: boolean;
  };
  marketplaceActive: boolean;
  revenueTreasurySet: boolean;
};

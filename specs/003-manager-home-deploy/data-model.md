# Data Model: Manager Home Deploy Wizard + Communities Index

## 1) DeploymentWizardSession

- Purpose: Tracks one deployment attempt initiated from Manager home.
- Source: Client state + minimal browser persistence (pre-registration), reconciled with chain state.

Fields:
- `sessionId: string`
- `deployerAddress: 0x${string}`
- `chainId: number`
- `communityId?: number`
- `targetType: "pre-registration" | "registered"`
- `status: "idle" | "preflight-blocked" | "in-progress" | "failed" | "completed"`
- `createdAt: string`
- `updatedAt: string`
- `steps: DeploymentStepState[]`
- `lastError?: { code: string; message: string; stepKey?: StepKey }`

Validation rules:
- `deployerAddress` must match currently connected wallet for resume.
- `communityId` must be present for `targetType = registered`.
- `steps` must contain exactly one entry per ordered `StepKey`.

State transitions:
- `idle -> preflight-blocked`
- `idle -> in-progress`
- `in-progress -> failed`
- `in-progress -> completed`
- `failed -> in-progress` (retry/resume)

## 2) DeploymentStepState

- Purpose: Tracks per-step lifecycle and transaction progress.

Fields:
- `key: StepKey`
- `name: string`
- `purpose: string`
- `status: "pending" | "running" | "succeeded" | "failed" | "skipped"`
- `expectedTxCount: number`
- `confirmedTxCount: number`
- `txHashes: 0x${string}[]`
- `startedAt?: string`
- `endedAt?: string`
- `failureReason?: string`
- `nextActionHint?: string`

Validation rules:
- `0 <= confirmedTxCount <= expectedTxCount`.
- `succeeded` requires `confirmedTxCount === expectedTxCount` unless `expectedTxCount=0`.
- `failed` requires `failureReason`.

State transitions:
- `pending -> running`
- `running -> succeeded | failed`
- `failed -> running` (retry)

## 3) StepKey (enum)

Values:
- `PRECHECKS`
- `DEPLOY_STACK`
- `WIRE_ROLES`
- `VERIFY_DEPLOYMENT`

Ordering constraint:
- Strict linear execution; no parallel step execution in MVP.

## 4) PreflightAssessment

- Purpose: Encapsulates all start-gating checks.

Fields:
- `walletConnected: boolean`
- `connectedAddress?: 0x${string}`
- `supportedNetwork: boolean`
- `chainId: number`
- `sharedInfra: SharedInfraStatus`
- `funding: FundingAssessment`
- `blockingReasons: string[]`

Validation rules:
- Start allowed only when `blockingReasons.length === 0`.

## 5) SharedInfraStatus

Fields:
- `addressesPresent: boolean`
- `accessManager: ProbeStatus`
- `paramController: ProbeStatus`
- `communityRegistry: ProbeStatus`
- `isUsable: boolean`

`ProbeStatus`:
- `address?: 0x${string}`
- `hasCode: boolean`
- `abiProbePassed: boolean`
- `reason?: string`

Validation rules:
- `isUsable = true` only when all three probes pass.

## 6) FundingAssessment

Fields:
- `requiredWei: bigint`
- `currentBalanceWei: bigint`
- `bufferMultiplierBps: number`
- `estimatedTxCount: number`
- `estimatedGasPerTx: bigint`
- `maxFeePerGasWei: bigint`
- `isSufficient: boolean`
- `recommendedAdditionalWei?: bigint`

Validation rules:
- `isSufficient = currentBalanceWei >= requiredWei`.
- `recommendedAdditionalWei` present only when insufficient.

## 7) CommunityRegistrationSnapshot

- Purpose: Canonical chain-derived post-registration state for resume and verification.

Fields:
- `communityId: number`
- `modulePointers: {
  valuableActionRegistry?: 0x${string};
  marketplace?: 0x${string};
}`
- `roles: {
  revenueRouterPositionManager: boolean;
  revenueRouterDistributor: boolean;
  commerceDisputesCaller: boolean;
  housingMarketplaceCaller: boolean;
  valuableActionRegistryIssuerForRequestHub: boolean;
}`
- `vptInitialized: boolean`
- `marketplaceActive: boolean`
- `revenueTreasurySet: boolean`

Validation rules:
- Snapshot is computed from on-chain reads only.

## 8) VerificationCheckResult

Fields:
- `key: VerificationCheckKey`
- `label: string`
- `passed: boolean`
- `failureReason?: string`

`VerificationCheckKey` values:
- `MODULE_WIRING_VALUABLE_ACTION_REGISTRY`
- `VPT_COMMUNITY_INITIALIZED`
- `ROLE_RR_POSITION_MANAGER`
- `ROLE_RR_DISTRIBUTOR`
- `ROLE_COMMERCE_DISPUTES_CALLER`
- `ROLE_HOUSING_MARKETPLACE_CALLER`
- `ROLE_VA_ISSUER_REQUEST_HUB`
- `MARKETPLACE_COMMUNITY_ACTIVE`
- `REVENUE_ROUTER_TREASURY_SET`

Validation rules:
- `failureReason` required when `passed=false`.

## 9) CommunitiesIndexItem

Fields:
- `id: string`
- `chainId: number`
- `name?: string | null`
- `metadataUri?: string | null`
- `createdAt: string`
- `href: string` (derived: `/communities/${id}`)

Validation rules:
- `id` is required and non-empty.
- `href` must be deterministic from `id`.

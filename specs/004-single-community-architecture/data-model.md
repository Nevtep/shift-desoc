# Data Model: Single-Community Architecture Refactor

## 1. CommunityDeploymentUnit
- Description: One deployed community stack with local governance authority and per-community modules.
- Fields:
  - communityId: uint256
  - accessManager: address
  - governor: address
  - timelock: address
  - paramController: address
  - modules: map<string,address>
  - deployedAt: uint64
  - deployer: address
- Validation rules:
  - All authority addresses must be non-zero.
  - `timelock` must be set before finalization.
  - Module addresses must be unique per key for a run.
- State transitions:
  - CREATED -> STACK_DEPLOYED -> PERMISSIONS_CONFIGURED -> ADMIN_HANDOFF_DONE -> VERIFIED

## 2. AccessBootstrapHandoff
- Description: Deployment bootstrap authority window and mandatory handoff record.
- Fields:
  - deploymentRunId: string
  - bootstrapActor: address
  - handoffTargetTimelock: address
  - permissionsConfigured: bool
  - handoffTxHash: bytes32
  - handoffConfirmed: bool
  - confirmedAt: uint64
- Validation rules:
  - `permissionsConfigured` must be true before handoff.
  - `handoffTargetTimelock` must match local community timelock.
  - Deployment cannot finalize unless `handoffConfirmed` is true.
- State transitions:
  - OPEN -> CONFIGURED -> HANDED_OFF -> LOCKED

## 3. DeployWizardRun
- Description: Manager app execution record for a deployment attempt.
- Fields:
  - id: string
  - state: enum(PRECHECKS, DEPLOY_STACK, CONFIGURE_ACCESS_PERMISSIONS, HANDOFF_ADMIN_TO_TIMELOCK, VERIFY_DEPLOYMENT, COMPLETED, FAILED)
  - startedAt: uint64
  - updatedAt: uint64
  - wallet: address
  - network: string
  - deploymentUnitRef: CommunityDeploymentUnit
  - errorCode: string?
  - errorMessage: string?
- Validation rules:
  - State transitions must follow allowed sequence.
  - Only one active run per session context.
  - Restart creates new run id unless explicit resume path is selected.

## 4. ContractRefactorScopeItem
- Description: Traceable unit for each contract conversion to single-community internals.
- Fields:
  - contractName: string
  - path: string
  - objective: string
  - removedMultiCommunityPaths: list<string>
  - testEvidence: list<string>
  - status: enum(NOT_STARTED, IN_PROGRESS, COMPLETE)
- Validation rules:
  - Cannot be COMPLETE without testEvidence.
  - Must include evidence that internal community scoping no longer depends on multi-community keyed state.

## 5. AuthorityInvariantCheck
- Description: Verification results for privileged mutation paths and isolation.
- Fields:
  - deploymentRunId: string
  - postHandoffTimelockOnly: bool
  - deployerRestrictedWriteFails: bool
  - managerRestrictedWriteFails: bool
  - crossCommunityLeakageDetected: bool
  - checkedAt: uint64
- Validation rules:
  - Run is VERIFIED only when all required checks pass and leakage is false.

## T014 Evidence: RequestHub Single-Community Internals
- Contract: `contracts/modules/RequestHub.sol`
- Refactor evidence:
  - Added one-time runtime binding via `boundCommunityId` + `communityBound`.
  - Replaced community-keyed request storage with local `localRequests` list.
  - Replaced community-keyed rate limits with per-user local mappings.
  - Enforced `Community mismatch` revert when a second community is used after binding.
- Test evidence:
  - `test/RequestHub.t.sol:testCreateRequestDifferentCommunityRevertsAfterBinding`

## T015 Evidence: DraftsManager Single-Community Internals
- Contract: `contracts/modules/DraftsManager.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and removed runtime binding logic.
  - Replaced `communityDrafts[communityId]` runtime indexing with local `localDrafts`.
  - Removed runtime community selection from `createDraft`; the contract always uses its immutable community scope.
- Test evidence:
  - `test/DraftsManager.t.sol:testConstructor`
  - `test/DraftsManager.t.sol:testGetDraftsByCommunityMismatchedCommunityReturnsEmpty`
  - `test/DraftsManager.t.sol:testGetDraftsByMappings`

## T016 Evidence: ValuableActionRegistry Single-Community Internals
- Contract: `contracts/modules/ValuableActionRegistry.sol`
- Refactor evidence:
  - Replaced runtime binding with constructor-level immutable `communityId` scope.
  - Removed redundant community-keyed runtime storage for issuer narrowing and founder lists; contract now uses local single-community state.
  - Removed redundant `communityId` parameters from proposal/config/issuance mutators and routed all issuance through immutable contract scope.
- Test evidence:
  - `test/ValuableActionRegistry.t.sol:testProposeValuableActionUsesImmutableCommunityScope`
  - `test/ValuableActionRegistry.t.sol:testCommunityNarrowingBlocksUnlistedModule`

## T017 Evidence: Engagements Single-Community Internals
- Contract: `contracts/modules/Engagements.sol`
- Refactor evidence:
  - Enforced non-zero local `communityId` at deployment for each `Engagements` instance.
  - Added runtime guard requiring action type community (`communityByActionId`) to match local `communityId`.
  - Preserved verifier/juror flow with immutable per-instance community routing.
- Test evidence:
  - `test/Engagements.t.sol:testConstructorZeroCommunityIdReverts`
  - `test/Engagements.t.sol:testSubmitEngagementAssignsJurors`

## T018 Evidence: CredentialManager Single-Community Internals
- Contract: `contracts/modules/CredentialManager.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and removed runtime community binding paths.
  - Removed mutable community selection from course-definition flow and pinned behavior to local contract scope.
  - Enforced revocation guard so credential token community must match local immutable community.
- Test evidence:
  - `test/CredentialManager.t.sol:testConstructor`
  - `test/CredentialManager.t.sol:testGovernanceRevoke`

## T019 Evidence: PositionManager Single-Community Internals
- Contract: `contracts/modules/PositionManager.sol`
- Refactor evidence:
  - Added constructor immutable `communityId` and removed community-scoped fields from `PositionType` and `PositionApplication` runtime state.
  - Removed `communityId` from `definePositionType` and now emits/operates using immutable contract community scope.
  - Preserved role issuance and position close flow while routing all minted artifacts through immutable community context.
- Test evidence:
  - `test/PositionManager.t.sol:testDefinePositionTypeByModerator`
  - `test/PositionManager.t.sol:testApplyAndApproveFlow`

## T028 Evidence: InvestmentCohortManager Single-Community Internals
- Contract: `contracts/modules/InvestmentCohortManager.sol`
- Refactor evidence:
  - Added constructor immutable `communityId` and removed `communityId` argument from `createCohort`.
  - Cohort creation now always uses local immutable community scope when writing into `CohortRegistry`.
  - Investment issuance remains cohort-scoped while preserving immutable community routing through registry + SBT.
- Test evidence:
  - `test/InvestmentCohortManager.t.sol:testCreateCohort`
  - `test/InvestmentCohortManager.t.sol:testIssueInvestmentRecordsCohort`

## T020 Evidence: ValuableActionSBT Single-Community Internals
- Contract: `contracts/modules/ValuableActionSBT.sol`
- Refactor evidence:
  - Added constructor immutable `communityId` and removed runtime `communityId` parameters from all mint APIs.
  - Token issuance now stamps `TokenData.communityId` from immutable contract scope, eliminating per-call community mutation paths.
  - Updated `IValuableActionSBT` and issuer callsites (`ValuableActionRegistry`, `Engagements`) to the single-community mint API.
- Test evidence:
  - `test/ValuableActionSBT.t.sol:testMintEngagementWorkSubtype`
  - `test/ValuableActionSBT.t.sol:testMintInvestmentStoresData`
  - `test/Engagements.t.sol:testSubmitEngagementAssignsJurors`
  - `test/ValuableActionRegistry.t.sol:testIssueEngagementMintsAndEmits`

## T021 Evidence: VerifierPowerToken1155 Single-Community Internals
- Contract: `contracts/tokens/VerifierPowerToken1155.sol`
- Refactor evidence:
  - Added constructor immutable `communityId` and replaced community-keyed runtime mappings with local single-community state (`_totalSupply`, `_communityInitialized`).
  - Preserved compatibility via scoped getters `totalSupply(uint256)` and `communityInitialized(uint256)` that return bound-state values only for the immutable community.
  - Added strict community mismatch guards across initialize/mint/burn/batch/admin transfer paths to prevent cross-community mutation.
- Test evidence:
  - `test/VerifierPowerToken1155.t.sol:testSingleCommunityMismatchBehavior`
  - `test/VerifierPowerToken1155.t.sol:testMint`
  - `test/VerifierElection.t.sol:testSetVerifierSetDifferentCommunityReverts`
  - `test/VerifierManager.t.sol:testHasVerifierPower`

## T022 Evidence: VerifierElection Single-Community Internals
- Contract: `contracts/modules/VerifierElection.sol`
- Refactor evidence:
  - Added constructor immutable `communityId` and replaced community-keyed runtime storage with local verifier-set and ban state (`verifierSet`, `_bannedVerifiers`, `_bannedTimestamp`).
  - Enforced strict bound-community checks in all mutating APIs (`setVerifierSet`, `banVerifiers`, `unbanVerifier`, `adjustVerifierPower`) to block cross-community writes.
  - Preserved compatibility for existing callers through scoped read APIs and mapping-shape getters (`bannedVerifiers(uint256,address)`, `bannedTimestamp(uint256,address)`) that return zero values outside the bound community.
- Test evidence:
  - `test/VerifierElection.t.sol:testSetVerifierSetDifferentCommunityReverts`
  - `test/VerifierElection.t.sol:testSetVerifierSet`
  - `test/VerifierManager.t.sol:testSelectJurorsExcludesBannedVerifiers`
  - `test/Engagements.t.sol:testSubmitEngagementAssignsJurors`

## T023 Evidence: VerifierManager Single-Community Internals
- Contract: `contracts/modules/VerifierManager.sol`
- Refactor evidence:
  - Added constructor immutable `communityId` and bound all mutable entrypoints (`selectJurors`, `reportFraud`) to local community scope via explicit mismatch guard.
  - Updated interface signatures to local-community reads (`hasVerifierPower(address)`, `getEligibleVerifierCount()`, `getVerifierPower(address)`) and removed redundant `communityId` parameters from VerifierManager entrypoints.
  - Updated deployment wiring and constructor propagation so each VerifierManager instance is deployed with explicit local community scope.
- Test evidence:
  - `test/VerifierManager.t.sol:testSelectJurorsNoEligibleVerifiers`
  - `test/VerifierManager.t.sol:testHasVerifierPower`
  - `test/VerifierManager.t.sol:testReportFraud`
  - `test/Engagements.t.sol:testSubmitEngagementAssignsJurors`

## T024 Evidence: CommunityToken Single-Community Internals
- Contract: `contracts/tokens/CommunityToken.sol`
- Refactor evidence:
  - CommunityToken is deployed with immutable constructor `communityId`, and runtime logic is fully local to the deployment instance (no community-keyed mutable storage paths).
  - Redemption fee lookup is scoped through immutable community context when reading ParamController (`getUint256(communityId, FEE_ON_WITHDRAW)`).
  - Treasury, emergency withdrawal, and reserve-backing logic operate on local token state (`totalSupply`, contract USDC balance) without cross-community mutation paths.
- Test evidence:
  - `test/CommunityToken.t.sol:testConstructor`
  - `test/CommunityToken.t.sol:testRedeemWithFee`
  - `test/CommunityToken.t.sol:testWithdrawFromTreasuryInsufficientReservesReverts`
  - `test/CommunityToken.t.sol:testEmergencyWithdrawalCannotDrainBackedSupply`

## T025 Evidence: CohortRegistry Single-Community Internals
- Contract: `contracts/modules/CohortRegistry.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and removed runtime `communityId` parameter from `createCohort`.
  - Replaced community-keyed active cohort storage with local single-community storage (`localActiveCohorts`).
  - Preserved compatibility for community-scoped reads via `getActiveCohorts(uint256)` returning local data only for the bound community (empty for mismatches).
- Test evidence:
  - `test/CohortRegistry.t.sol:testCreateCohortStoresState`
  - `test/CohortRegistry.t.sol:testMarkRecoveredCompletesCohort`
  - `test/CohortRegistry.t.sol:testGetCohortWeightOneArgCompatibility`
  - `test/InvestmentCohortManager.t.sol:testCreateCohort`

## T026 Evidence: RevenueRouter Single-Community Internals
- Contract: `contracts/modules/RevenueRouter.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and localized community-keyed runtime state to single-community storage (`_communityTreasury`, `_supportedTokens`, `_treasuryAccrual`, `_activePositionPoints`, `_positionsIndex`).
  - Kept external API compatibility by preserving community-parameter mutators and adding compatibility read getters (`communityTreasuries`, `supportedTokens`, `treasuryAccrual`, `activePositionPoints`, `positionsIndex`) that return scoped values only for the bound community.
  - Enforced bound-community checks in mutable entrypoints (`setCommunityTreasury`, `setSupportedToken`, `routeRevenue`, `withdrawTreasury`) and added position-community consistency checks in claims/registration.
- Test evidence:
  - `test/RevenueRouterCohort.t.sol:testDistributeToCohortsProRata`
  - `test/RevenueRouterCohort.t.sol:testInactiveCohortsDoNotReceiveRevenue`
  - `test/MarketplaceRevenueRouter.t.sol:testRouteRevenueAccruesPositions`
  - `test/DeploymentRoleWiring.t.sol:testRouteRevenueRequiresDistributorRole`

## T027 Evidence: TreasuryAdapter Single-Community Internals
- Contract: `contracts/modules/TreasuryAdapter.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and localized policy storage from community-keyed mappings to single-community storage (`_tokenAllowed`, `_destinationAllowed`, `_vaultAdapterAllowed`, `_capBps`).
  - Preserved policy API compatibility by retaining community-parameter method signatures and adding bound-community guards.
  - Preserved compatibility read shape via scoped getters (`tokenAllowed`, `destinationAllowed`, `vaultAdapterAllowed`, `capBps`) returning defaults for mismatched communities.
- Test evidence:
  - `test/TreasuryAdapter.t.sol:testValidateSpendHappyPath`
  - `test/TreasuryAdapter.t.sol:testValidateSpendReasons`
  - `test/TreasuryAdapter.t.sol:testBuildErc20TransferTxSuccess`
  - `test/TreasuryAdapter.t.sol:testBuildVaultDepositTx`

## T029 Evidence: Marketplace Single-Community Internals
- Contract: `contracts/modules/Marketplace.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and replaced community-keyed runtime state with local storage (`_communityToken`, `_communityActive`).
  - Preserved compatibility signatures for `setCommunityActive(uint256,...)`, `setCommunityToken(uint256,...)`, and added compatibility getters (`communityActive(uint256)`, `communityTokens(uint256)`) scoped to the bound community.
  - Enforced bound-community checks for offer creation and dispute routing while preserving escrow/dispute/settlement invariants.
- Test evidence:
  - `test/MarketplaceDisputes.t.sol:test_PurchaseCreatesEscrow`
  - `test/MarketplaceDisputes.t.sol:test_RefundBuyerOutcome`
  - `test/MarketplaceHousing.t.sol:test_PurchaseCreatesReservation`
  - `test/MarketplaceRevenueRouter.t.sol:testSettleRoutesWhenTokenSupported`

## T030 Evidence: CommerceDisputes Single-Community Internals
- Contract: `contracts/modules/CommerceDisputes.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and bound `openDispute` community parameter to local deployment scope.
  - Kept dispute lifecycle model and receiver callback flow unchanged while ensuring cross-community mismatch fails early.
- Test evidence:
  - `test/MarketplaceDisputes.t.sol:test_BuyerOpensDisputeWithinWindow`
  - `test/MarketplaceDisputes.t.sol:test_RefundBuyerOutcome`
  - `test/DeploymentRoleWiring.t.sol:testMarketplaceDisputeOpenRequiresCallerRole`

## T031 Evidence: HousingManager Single-Community Internals
- Contract: `contracts/modules/HousingManager.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and bound `createUnit(uint256,...)` to local deployment scope.
  - Preserved ModuleProduct quote/consume/settlement callbacks and reservation lifecycle while stamping units with bound community.
- Test evidence:
  - `test/MarketplaceHousing.t.sol:test_UnitCreationMintsToken`
  - `test/MarketplaceHousing.t.sol:test_PurchaseCreatesReservation`
  - `test/MarketplaceHousing.t.sol:test_DisputeFreesReservationDates`
  - `test/MarketplaceHousing.t.sol:test_SettlementAfterCheckout`

## T032 Evidence: ProjectFactory Single-Community Internals
- Contract: `contracts/modules/ProjectFactory.sol`
- Refactor evidence:
  - Added immutable constructor `communityId` and stamped created projects with bound community.
  - Expanded `ProjectCreated` event payload to include `communityId` for deterministic indexing.
- Test evidence:
  - `test/ProjectFactory.t.sol:testCreateProjectUsesBoundCommunity`
  - `test/ProjectFactory.t.sol:testRevertWhenCommunityIdIsZero`

## T033 Evidence: Full US1 Validation Checkpoint
- Command evidence:
  - `pnpm forge:test` -> pass (`479 passed, 0 failed`).
  - `pnpm forge:cov` -> failed due Foundry coverage compiler Yul stack-depth exception in this workspace.
  - `pnpm cov:gate` -> pass via built-in fallback path in `scripts/check-coverage.sh` (core contracts above threshold).
  - `pnpm hh:compile` -> pass (`Compiled 117 Solidity files successfully`).

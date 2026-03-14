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

# SHI-178 — ShiftGovernor executes through the community TimelockController (GovernorTimelockControl)

Locator: `odd/tasks/shi-178-governor-timelock-control.md` · Engram (project `shift-desoc`): `odd/shi-178-governor-timelock-control/tasks`
Linear: SHI-178 (Bug, `domain:contracts`, `domain:governance`, `security`, `workflow:needs-spec`, Phase 1, Urgent; issue updatedAt 2026-11-22T01:57:01.932Z). Branch: `fix/SHI-178/governor-timelock-control`. Base: `a9f5cd0`.
Delivery: one PR, work-unit commits. Runner: Foundry (`pnpm forge:test`). `domain:contracts`: the autonomous loop skips it unless `SHIFT_ALLOW_CONTRACT_ISSUES=true`.
Risk (forecast): **high**. Items 1/2/3/5 apply: privileged execution identity, constructor and ABI that others consume, factory and deploy flow. Item 4 (async ordering) applies to queue and execute. Needs the independent verifier, native review and the separate-session completeness audit.
Blocks: SHI-179 (Manager wizard roles and Queue/Execute), SHI-172, SHI-174. Related: SHI-175, SHI-102, SHI-21, SHI-169, SHI-170.

## Objective
A newly deployed Governance-managed community executes a successful binary proposal through its own `TimelockController`. The timelock, not the Governor or the deployer, is the effective `msg.sender` on privileged targets. `AccessManager` stays the authorization layer on `AccessManaged` modules, and `ParamController.onlyAuthorized` stays as is.

## Problem (evidence, verified at base `a9f5cd0`)
- `contracts/core/ShiftGovernor.sol:11,20,53` inherits `GovernorTimelockAccess`, constructed as `(token, accessManager, baseDelaySeconds)` (`:48`). The Governor therefore schedules and executes against AccessManager (`:68-76` and `:180-224` override resolution), with its own `baseDelaySeconds`.
- `contracts/modules/factories/GovernanceLayerFactory.sol:49-57` deploys the timelock (`minDelay = executionDelay`, admin = `timelockAdmin`) and then the Governor with `abi.encode(membershipToken, accessManager, uint32(executionDelay))`. The deployed timelock address is never passed to the Governor. `deployLayer` (`:25-35`) is unchanged by this issue.
- `ParamController.onlyAuthorized` (`contracts/modules/ParamController.sol:112-122`) accepts the `CommunityRegistry.getTimelock(communityId)` caller once the timelock is wired (`contracts/modules/CommunityRegistry.sol:705`, set at `:384,:487`). The Governor, as executor, is never that address.
- `contracts/core/ShiftTimelockController.sol` is a plain OZ `TimelockController` wrapper (10 lines). It is kept as is.
- OZ is 5.4.0 (`node_modules/@openzeppelin/contracts/package.json`). `GovernorTimelockControl.sol` exists there. It requires the Governor to hold `PROPOSER_ROLE` and `CANCELLER_ROLE` (and executor rights) on the timelock, and its `_executor()` returns the timelock.
- `setCountingMulti` and `initCountingMulti` use `onlyGovernance` (`ShiftGovernor.sol:62,80`). Under `GovernorTimelockControl` that modifier requires `msg.sender == timelock`. This behavior changes, and SHI-174 removes those functions.
- Constructor call sites:
  - `test/Wiring.t.sol:105`: `new ShiftGovernor(token, accessManager, 1 days)`.
  - `test/Wiring.t.sol:400-403`: `testGovernorUsesLocalAccessManager` asserts `accessManager()` and `baseDelaySeconds()`. Both getters disappear.
  - `scripts/hardhat/community-deploy-lib.ts:700-710`: deploys the governor with `(token, accessManagerAddress, executionDelay)` after the timelock is deployed.
  - `scripts/hardhat/factory-deploy.ts:300-322` and `scripts/hardhat/benchmark-community-gas.ts:168-194` pass only creation code to the factory. No source edit is needed there, and the benchmark must be re-run or compile-checked.
  - `apps/web/lib/deploy/factory-step-executor.ts:928-935` uses bundled ABIs. `deployLayer` args are unchanged.
  - `scripts/legacy/**` is not actively built and is out of scope.
- ABI artifacts mirrored in the repo: `apps/web/abis/{ShiftGovernor,GovernanceLayerFactory}.json`, `apps/indexer/abis/*.json` (from `pnpm forge:build` via `scripts/copy-ponder-abis.js` and `copy-web-abis.js`), and `apps/web/lib/deploy/bundled-contracts/{ShiftGovernor,GovernanceLayerFactory}.json` (`scripts/copy-web-deploy-artifacts.js`). The tests `apps/web/tests/unit/lib/deploy/deploy-artifacts-bundle.test.ts` and `apps/indexer/test/unit/abi-event-compatibility.test.ts` read them.
- Existing coverage: `test/DeploymentRoleWiring.t.sol` and `test/Wiring.t.sol`. No test drives a Governor proposal through queue and execute.
- Stale docs that state the `GovernorTimelockAccess` requirement: `AGENTS.md:76`, `.github/copilot-instructions.md:55,763`, `contracts/FEATURES.md:59,110`, `hermes-bootstrap/skills/shift-protocol-capabilities/SKILL.md:39`, `docs/EN/contracts/ShiftGovernor.md`, `docs/ES/contracts/ShiftGovernor.md`. `.github/project-management/*STATUS*.md` need a check for the same.

## Decision (FINAL, from the issue; not reopened)
`GovernorTimelockControl` + `TimelockController` + `AccessManager`. Do not keep `GovernorTimelockAccess`. Do not grant the Governor module admin selectors. Do not replace AccessManager with `onlyGovernor`.

## Scope
- `contracts/core/ShiftGovernor.sol`: execution inheritance, constructor, overrides.
- `contracts/modules/factories/GovernanceLayerFactory.sol`: pass the deployed timelock to the Governor constructor.
- `ShiftTimelockController.sol`: no change (no bypass).
- Test fixtures and new Foundry tests.
- `scripts/hardhat/community-deploy-lib.ts` governor deploy args.
- Regenerated ABI and bundled artifacts.
- Docs and guidance listed above.

## Non-goals
- Multi-choice counting rewrite or winner dispatch (SHI-174).
- Manager wizard role grants and Queue/Execute UI (SHI-179).
- Initial voting power mint and delegation (SHI-175).
- OZ upgrade or AccessManager role taxonomy changes.
- Retrofitting historical staging communities (clean-slate deploys only).
- Edits to `scripts/legacy/**`.

## Specs
- **S1** `ShiftGovernor` inherits `GovernorTimelockControl`, not `GovernorTimelockAccess`. The constructor is `(address membershipToken, TimelockController communityTimelock)`. It reverts `Errors.ZeroAddress()` on a zero token or a zero timelock, and keeps `GovernorSettings(1 days, 5 days, 0)`, `GovernorVotes`, `Quorum(4)` and `GovernorCountingSimple`. `timelock()` returns the community timelock. `accessManager()` and `baseDelaySeconds()` no longer exist.
- **S2** The OZ 5.4 overrides (`state`, `proposalNeedsQueuing`, `_queueOperations`, `_executeOperations`, `_cancel`, `_executor`, plus the `propose` and `supportsInterface` resolutions the compiler needs) resolve correctly. `_executor()` equals the timelock. The Governor queues through `scheduleBatch` and executes through `executeBatch`. The only execution delay is the timelock `getMinDelay()`; no second Governor delay exists.
- **S3** `GovernanceLayerFactory.deployLayer` deploys token, then timelock, then Governor with `abi.encode(deployment.membershipToken, deployment.timelock)`. The AccessManager is used only as the membership token's authority. `deployLayer`'s signature, the `GovernanceLayerDeployed` event, the `Deployment` struct and `lastDeploymentByCaller` are unchanged. `timelockAdmin` remains a bootstrap admin that SHI-179's wizard revokes.
- **S4** Foundry end-to-end, binary proposal:
  - Setup: Governor holds only `PROPOSER_ROLE`, `EXECUTOR_ROLE` and `CANCELLER_ROLE` on the timelock. The timelock holds AccessManager `ADMIN_ROLE`. The deployer and bootstrap accounts are revoked. The timelock is registered as `CommunityRegistry.getTimelock(communityId)`.
  - Proposal: target `ParamController.setRevenuePolicy(communityId, ...)` with valid values. State sequence is `Pending → Active → Succeeded → Queued → Executed`, with execution only after `getMinDelay()`.
  - Asserts: the exact on-chain `getRevenuePolicy` values change, and the caller seen by the target is the timelock.
- **S5** Same flow against an `AccessManaged restricted` selector (`RevenueRouter.setSupportedToken`, `contracts/modules/RevenueRouter.sol:81`), with the timelock authorized in AccessManager. A direct call from the Governor or the deployer reverts, an unauthorized wallet cannot execute the timelock operation, and governance execution succeeds.
- **S6** Role hygiene. A non-Governor wallet cannot `schedule` or `scheduleBatch` on the timelock. After finalization, the deployer holds none of `PROPOSER_ROLE`, `EXECUTOR_ROLE` or `DEFAULT_ADMIN_ROLE`, and the timelock holds only the intended AccessManager roles in governance-managed mode.
- **S7** Fail-closed cases, each asserting the exact revert or state:
  - cancel before and after queue, via the canceller role
  - re-execute an already executed proposal
  - premature execute before `minDelay`
  - wrong calldata or description hash on queue and execute
  - Governor wired to a different community's timelock, where execution cannot reach the target
  - unknown target and a target that rejects the timelock
  - assert that no pathway bypasses the timelock
- **S8** Existing yes/no/quorum behavior is unchanged. The `Wiring.t.sol` fixture is migrated to the new constructor. `testGovernorUsesLocalAccessManager` is replaced by a timelock-wiring test: `governor.timelock() == timelock` and `CommunityRegistry.getTimelock == timelock`. Factory test: `deployLayer` returns a Governor whose `timelock()` is the deployed `deployment.timelock`. Multi-choice behavior is untouched except the `onlyGovernance` executor change recorded under S1.
- **S9** The hardhat deploy lib deploys the governor with `(token, timelockAddress)`. Regenerated `apps/web/abis`, `apps/indexer/abis` and `apps/web/lib/deploy/bundled-contracts` artifacts match the compiled contracts, and the web and indexer ABI tests pass. Final artifacts are produced only after SHI-174 is reconciled (see Coordination).
- **S10** `AGENTS.md`, `.github/copilot-instructions.md`, `contracts/FEATURES.md`, `docs/EN|ES/contracts/ShiftGovernor.md`, `hermes-bootstrap/skills/shift-protocol-capabilities/SKILL.md` and the project-management status documents describe `GovernorTimelockControl` + `TimelockController` + `AccessManager`. The obsolete "preserve GovernorTimelockAccess" requirement is removed. Authority-lifecycle (admin-managed vs governance-managed) wording is preserved.
- **S11** QA section for SHI-179 and the Base Sepolia run, recorded in the PR and Linear: `ShiftGovernor.timelock() == CommunityRegistry.getTimelock(communityId)`, and that address holds AccessManager `ADMIN_ROLE`. A deployed binary `setRevenuePolicy` proposal queues and executes after `minDelay`, `getRevenuePolicy` shows the exact value, a direct deployer write fails, and no EOA retains proposer, executor or admin privileges. The live run depends on SHI-179 and SHI-175 and is not an acceptance gate for the protocol PR.

## Tasks (strict TDD: RED first for each)
- **T1** (S1, S2, S8) Write the Governor-through-timelock Foundry fixture and the RED test for the constructor and `timelock()`. Then switch `ShiftGovernor.sol` and migrate `test/Wiring.t.sol` (`:105`, `:400`). Paths: `contracts/core/ShiftGovernor.sol`, `test/Wiring.t.sol`, new `test/ShiftGovernorTimelock.t.sol`.
- **T2** (S3, S8) RED factory test, then update `GovernanceLayerFactory.sol`. Paths: `contracts/modules/factories/GovernanceLayerFactory.sol`, a factory test in `test/`.
- **T3** (S4, S5, S6, S7) Full lifecycle, role-hygiene and fail-closed tests. They may fail first if wiring is incomplete. Paths: `test/ShiftGovernorTimelock.t.sol`, a fixture helper if shared.
- **T4** (S9) `scripts/hardhat/community-deploy-lib.ts` args. Run the compile or benchmark check for `factory-deploy.ts` and `benchmark-community-gas.ts`. Regenerate ABIs and bundled artifacts with `pnpm forge:build` and `scripts/copy-web-deploy-artifacts.js`. Run the web and indexer ABI tests.
- **T5** (S10, S11) Docs and guidance updates, plus the QA section.

Work units: commit T1+T2 together (contract plus fixtures), T3 (tests), T4 (scripts and artifacts), T5 (docs). Each high-risk unit gets its own commit so native review can take it alone.

## Checks (narrowest first)
- `forge test --match-path test/ShiftGovernorTimelock.t.sol -vvv`, then `forge test --match-path test/Wiring.t.sol`, `test/DeploymentRoleWiring.t.sol`, `test/ParameterIntegration.t.sol` and the new factory test
- `pnpm forge:test`, `pnpm forge:cov`, `pnpm cov:gate`
- `pnpm forge:build`, then `pnpm --filter @shift/web test:unit` (the bundle test) and `pnpm --filter @shift/indexer run check:events` plus `check:compat`
- A differential check on artifacts: only the Governor constructor and getters change; the factory ABI is identical.

## Coordination with SHI-174 (same files)
SHI-174 owns the integrated counting inside `ShiftGovernor`. It removes the `multiCounter` internals, `setCountingMulti`, `initCountingMulti` and the `CountingMultiChoice` deploy step, and it reworks the factory's `countingMultiChoice` return. This issue changes execution inheritance and the constructor only. The legacy `multiCounter` internals stay in this branch and no new dependency on them is added. Both touch `ShiftGovernor.sol` and `GovernanceLayerFactory.sol` (constructor lines `:48-58` and the factory `:54-62`), so they need a controlled commit boundary: merge this issue first, because it blocks SHI-174 per Linear (it lists SHI-174 as blocked by it). SHI-174 rebases on the new constructor. Final ABI and bundled artifacts are regenerated once both are merged. If SHI-174 lands first, T1 and T2 must be rebased and S9 re-run. The `Deployment` struct, event and `deployLayer` signature are preserved here so the SHI-172 and SHI-179 consumers do not break meanwhile.

## Open questions
1. **RESOLVED (owner, 2026-11-24): regenerate the bundled artifacts in this PR**, and again after SHI-174. S9 timing: should this PR commit regenerated bundled artifacts now, or leave them to the post-SHI-174 reconciliation? Default in this document: regenerate now, because the bundle tests read them, and regenerate again after SHI-174.
2. **RESOLVED (owner, 2026-11-24): factories never grant roles.** They only deploy; roles are assigned afterwards by the wizard (factories are already heavy). Keep `timelockAdmin` as the bootstrap admin as in the issue. Original question: does the existing SHI-179 plan expect the factory to grant the Governor timelock roles itself? The issue says no: the wizard does this, and the factory leaves `timelockAdmin` as the bootstrap admin. This document follows the issue.

No blocking question: the architecture decision is final. `implementationReady` is true for T1 to T5.

## Log
- L1 (2026-11-24, planner run): Document created from Linear SHI-178 (no comments) after reading `ShiftGovernor.sol`, `GovernanceLayerFactory.sol`, `ShiftTimelockController.sol`, `ParamController.onlyAuthorized`, `CommunityRegistry.getTimelock`, `test/Wiring.t.sol`, the hardhat deploy scripts, the web bundled-contract plumbing and OZ 5.4.0 in `node_modules`. The factory's `deployLayer` ABI turned out to be unchanged, which lowers web impact. The Engram mirror is written alongside this file.
- L-owner (2026-11-24): Owner answered the two open questions in chat: (1) regenerate bundled artifacts in this PR; (2) no factory grants roles, they only deploy and the wizard assigns roles later. No spec or task change: both match the document's defaults. `implementationReady` stays true.
- L2 (2026-11-24, implementer): T1+T2 done. Env note: `lib/` (forge-std, OZ) was absent in the worktree; installed with `bash scripts/ci/install-foundry-dependencies.sh` (gitignored). RED: `forge test --match-path test/ShiftGovernorTimelock.t.sol` failed to compile (`ShiftGovernor` constructor takes 3 args, no `timelock()`); factory RED: `test/GovernanceLayerFactory.t.sol` failed `governor timelock: <accessManager> != <timelock>`. GREEN after switching to `GovernorTimelockControl` and passing `deployment.timelock`. A zero token/timelock now reverts `Errors.ZeroAddress` via a base-constructor argument helper (a zero token otherwise reverted without data inside a base constructor). `Wiring.t.sol` migrated (`testGovernorUsesCommunityTimelock`). Passing: ShiftGovernorTimelock, GovernanceLayerFactory, Wiring, DeploymentRoleWiring, ParameterIntegration.
- L3 (2026-11-24, implementer): T3 done in `test/ShiftGovernorTimelock.t.sol` (15 tests, all green; they are expected to pass at once because T1 already holds the implementation, so there is no separate RED). Initial test-side failures I fixed: the Ready bitmap is `1<<2` (OperationState Unset/Waiting/Ready/Done), and `vm.prank` was being consumed by view calls evaluated in the expectRevert arguments. Findings that shape the spec: OZ 5.4 `Governor.cancel` only lets the proposer cancel while Pending (`GovernorUnableToCancel` afterwards), so a queued operation is cancelled by a CANCELLER_ROLE holder on the timelock (the Governor holds the role); verified governor state becomes Canceled and `execute` then reverts `GovernorUnexpectedProposalState`. S5 covers the unauthorized-wallet executor case (`AccessControlUnauthorizedAccount`) and a target that rejects the timelock (`AccessManagedUnauthorized(timelock)`).
- L4 (2026-11-24, implementer): T4 done. `community-deploy-lib.ts` deploys `ShiftGovernor(token, timelock)`; the lib already grants the Governor PROPOSER/EXECUTOR/CANCELLER and hands AccessManager ADMIN to the timelock. Ran `pnpm hh:compile`, `pnpm forge:build`, `node scripts/copy-web-deploy-artifacts.js`. Differential check on ABIs: `ShiftGovernor` ABI removed ctor(3 args), `accessManager`, `baseDelaySeconds`, `setBaseDelaySeconds`, `isAccessManagerIgnored`, `setAccessManagerIgnored`, `proposalExecutionPlan`, and the related errors/events; it added ctor(token, timelock), `timelock()`, `updateTimelock`, `TimelockChange`. `GovernanceLayerFactory` ABI is identical (bundled bytecode changed because of the new constructor encoding). Committed only these artifacts: `apps/{web,indexer}/abis/ShiftGovernor.json`, bundled `ShiftGovernor.json` and `GovernanceLayerFactory.json`. The regenerated bulk of other ABI files differed only in metadata hash, and `VerifierPowerToken1155` / `CommunityRegistry` showed unrelated pre-existing ABI drift; both are out of scope and were reverted. Validation: web `test:unit` 477 passed (incl. bundle test), indexer `check:events` and `check:compat` pass (dummy env), indexer `test:unit` 11 passed, hardhat `communityDeployDryRun` passes. Artifacts are regenerated again after SHI-174 (owner decision).

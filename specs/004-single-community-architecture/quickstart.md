# Quickstart: Single-Community Architecture Refactor

## Goal
Deliver single-community internals across deploy stack contracts with per-community authority bootstrap and mandatory admin handoff to timelock.

## Prerequisites
- Branch: `004-single-community-architecture`
- Install deps: `pnpm install`
- Tooling available: Foundry + Hardhat

## Execution Order
1. Contracts refactor (primary objective)
2. Deploy scripts bootstrap/handoff update
3. Manager Wizard state flow update
4. Tests (contracts + integration + web)
5. Indexer ABI/event sync
6. Docs/status synchronization

## Key Runtime Model
1. Deploy per-community stack including `AccessManager`, `ParamController`, `ShiftGovernor`, `TimelockController`
2. Configure selector permissions in local `AccessManager` during bootstrap
3. Transfer AccessManager admin to local timelock
4. Verify post-handoff restricted writes fail for deployer/manager wallets

## Validation Commands
- Contract tests: `pnpm forge:test`
- Coverage: `pnpm forge:cov && pnpm cov:gate`
- Hardhat compile: `pnpm hh:compile`
- ABI sync: `node scripts/copy-ponder-abis.js && node scripts/copy-web-abis.js`

## Done Criteria
- All contracts in refactor matrix converted and tested
- Deploy flow enforces bootstrap + handoff before completion
- Wizard states match required sequence
- No migration/backfill required for Base Sepolia staging
- Docs/status files updated consistently

## Blocking Defect Closure
- ID: `BUG-2026-03-16-DEPLOY-WIZARD-STATIC-ADDR`
- Resolution summary:
	- `DEPLOY_STACK` now emits run-scoped addresses via `StepExecutionResult.deploymentAddresses` in `apps/web/lib/deploy/default-step-executor.ts`.
	- Session model persists run-scoped addresses for resume/retry in `apps/web/lib/deploy/types.ts` and `apps/web/hooks/useDeployWizard.ts`.
	- Mutable steps `CONFIGURE_ACCESS_PERMISSIONS` and `HANDOFF_ADMIN_TO_TIMELOCK` now require `session.deploymentAddresses` and do not call static lookup.
	- Regression coverage added in `apps/web/tests/unit/lib/deploy/default-step-executor.test.ts` (mutable-step static lookup guard).

## Latest Validation Evidence (T033)
- `pnpm forge:test`: PASS (`485 passed, 0 failed, 0 skipped`).
- `pnpm forge:cov`: FAIL in this workspace due Foundry coverage compiler Yul stack-depth exception.
- `pnpm cov:gate`: PASS via fallback path in `scripts/check-coverage.sh` (estimated 93.50%, threshold checks passed).
- `pnpm hh:compile`: PASS (`Compiled 117 Solidity files successfully`).

## Latest Validation Evidence (T051-T053)
- `node scripts/copy-ponder-abis.js && node scripts/copy-web-abis.js`: PASS (`Copied 8 ABI files` to each consumer).
- `pnpm --filter @shift/indexer build`: PASS (`ponder codegen` completed and wrote generated artifacts).
- `pnpm --filter @shift/indexer start`: PASS for replay/startup check (historical indexing completed, realtime sync active on Base Sepolia).
- `pnpm exec vitest run tests/unit/hooks/use-deploy-wizard-execution.test.tsx tests/unit/components/deploy-wizard.test.tsx tests/unit/lib/deploy/default-step-executor.test.ts tests/unit/lib/deploy/wizard-machine.test.ts` (in `apps/web`): PASS (`4 files, 15 tests`).
- `pnpm forge:test --match-test testPostHandoffBootstrapAdminCannotBeReclaimed`: PASS (new staging-policy handoff regression).

## Defect Closure Validation Evidence (T060-T064)
- `pnpm exec vitest run tests/unit/lib/deploy/default-step-executor.test.ts tests/unit/hooks/use-deploy-wizard-execution.test.tsx` (in `apps/web`): PASS (`2 files, 8 tests`).

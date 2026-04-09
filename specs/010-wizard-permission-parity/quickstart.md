# Quickstart: Implementing 010-wizard-permission-parity

## Prerequisites
- Node 22
- pnpm installed
- Repository root at /Users/core/Code/shift

## 1) Inspect canonical wiring and handoff anchors
1. Review selectorRoleAssignments in apps/web/lib/deploy/factory-step-executor.ts around line 2694.
2. Review bootstrapAccessAndRuntime payload mapping around line 3033.
3. Review handoff grant/revoke checks in executeHandoffAdminToTimelock around lines 3135-3204.

## 2) Implement/refresh generator pipeline
1. Update scripts/generate-draft-composer-allowlist.ts to:
   - Build permission matrix from selectorRoleAssignments.
   - Validate signatures/selectors against apps/web/abis artifacts.
   - Fail closed and emit signature-not-found artifact on mismatch.
   - Derive timelock surface from ADMIN_ROLE + confirmed handoff semantics.
   - Generate deterministic allowlist profile and meta.
2. Regenerate allowlist:
   - pnpm generate:composer-allowlist
3. Optional runtime handoff verifier:
   - pnpm exec ts-node --esm scripts/verify-handoff-admin-role.ts --network base_sepolia
   - Expected JSON keys: version, network, accessManager, adminRole, timelock, timelockHasAdmin, deployer, deployerHasAdmin, bootstrapCoordinator, bootstrapHasAdmin

## 3) Refresh Expert target parity
1. Update apps/web/lib/actions/registry.ts to include all relevant module ABIs/targets needed by timelock surface.
2. Update apps/web/lib/actions/target-resolution.ts and related logic so target enablement is:
   - module exists AND allowlistedCount > 0
   - otherwise disabled with deterministic reason.

## 4) Refresh Guided templates by crucial layer flow catalog
1. Derive crucial flows from docs/EN/Layers.md and docs/EN/Flows.md.
2. Update apps/web/lib/actions/guided-templates.ts so each crucial flow:
   - uses exact signature
   - has safe parameter constraints and effect copy
   - is enabled only when allowlisted
   - remains listed but disabled when not timelock-executable.

## 5) Produce reports
1. Create docs/permission-matrix.md with:
   - role assignment matrix evidence
   - handoff conclusion (Timelock admin ownership)
2. Create gap report with non-executable crucial flows and required selectorRoleAssignments (documentation only).

## 6) Validate with tests
Run:
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/permission-matrix.test.ts
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/timelock-surface.test.ts
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/allowlist.test.ts
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/allowlist-generator-determinism.test.ts
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/expert-target-resolution.test.ts
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/expert-functions.test.ts
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/crucial-flows-catalog.test.ts
- pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/guided-templates.test.ts

Then run full web unit suite if needed:
- pnpm --filter @shift/web test:unit

## 7) Determinism check
- Re-run pnpm generate:composer-allowlist.
- Verify no diff in:
  - apps/web/lib/actions/allowlists/base-sepolia-v1.json
  - apps/web/lib/actions/allowlists/base-sepolia-v1.meta.json

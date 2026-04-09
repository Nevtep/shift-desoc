# Implementation Readiness Checklist

- [x] Feature prerequisites command executed successfully.
- [x] Requirements checklist is fully complete.
- [x] Plan, research, data model, contracts schema, and quickstart reviewed.
- [x] Canonical wiring source confirmed: apps/web/lib/deploy/factory-step-executor.ts.
- [x] ABI baseline confirmed: apps/web/abis/*.json.
- [x] Fail-closed behavior confirmed for signature mismatch and missing artifacts.
- [x] Timelock handoff evidence strategy documented (static + optional runtime verifier).
- [x] Deterministic artifact ordering strategy documented.
- [x] Expert mode allowlist-only rule documented.
- [x] Guided templates safe-only rule documented.
- [x] Final command validation captured after implementation.

## Final Validation Commands
- [x] pnpm generate:composer-allowlist
- [x] pnpm --filter @shift/web exec vitest run tests/unit/lib/actions/permission-matrix.test.ts tests/unit/lib/actions/timelock-surface.test.ts tests/unit/lib/actions/allowlist.test.ts tests/unit/lib/actions/allowlist-generator-determinism.test.ts tests/unit/lib/actions/expert-target-resolution.test.ts tests/unit/lib/actions/expert-functions.test.ts tests/unit/lib/actions/crucial-flows-catalog.test.ts tests/unit/lib/actions/guided-templates.test.ts

# Quickstart: Implementing Feature 012

## Goal

Ship ValuableAction Registry Admin UX + Projection Readiness as a vertical slice across indexer and Manager, while preserving contract-first authority and community isolation.

## Preconditions

1. Work on branch `012-valuable-action-admin-ux`.
2. Use existing ValuableActionRegistry ABI/events unless a deterministic blocker is proven.
3. Confirm no unresolved clarification remains in `research.md`.

## Implementation Preflight Checklist

1. Confirm strict no-ABI path: no edits under `contracts/**` source and no edits to ABI JSON artifacts.
2. Confirm authority modes are fail-closed: only `direct_write`, `governance_required`, and `blocked`.
3. Confirm all read/write paths are community-scoped with boundary guards enabled.
4. Confirm lifecycle projection is event-driven using existing ValuableActionRegistry events only.
5. Confirm tests to run before merge:
   - Web unit: `pnpm --filter @shift/web test:unit`
   - Indexer unit/integration: `pnpm --filter @shift/indexer run test:unit && pnpm --filter @shift/indexer run test:integration`

## Step 1: Indexer projection layer

1. Add ValuableAction entities and indexes in `apps/indexer/ponder.schema.ts`.
2. Add handlers for create/update/activate/deactivate lifecycle events in `apps/indexer/src/index.ts`.
3. Ensure deterministic replay from configured start block.
4. Add projection readiness derivation inputs (indexed watermark + health signal).

Verification:
1. Replay succeeds without nondeterministic writes.
2. Community-scoped queries return only in-community actions.

## Step 2: Manager read surfaces

1. Add GraphQL queries for catalog/detail/readiness in `apps/web/lib/graphql/queries.ts`.
2. Build list/detail UI surfaces with explicit readiness badge and freshness metadata.
3. Add community boundary guard to block cross-community action routes.

Verification:
1. Empty-state communities render deterministically.
2. Lagging/unavailable states show non-ambiguous warnings.

## Step 3: Authority-aware mutation UX

1. Implement operation classifier for `create`, `edit`, `activate`, `deactivate` returning `direct_write`, `governance_required`, `blocked`.
2. Route `direct_write` to existing contract write path.
3. Route `governance_required` to proposal authoring/escalation flow.
4. Render deterministic blocked reason for unauthorized users.

Verification:
1. UI never exposes direct-write controls when only governance path is valid.
2. Unauthorized actors receive explicit feedback.

## Step 4: Testing

1. Add indexer tests for lifecycle ordering and replay.
2. Add web unit tests for:
   - community scoping,
   - boundary guard,
   - readiness states,
   - authority routing outcomes.
3. If contracts changed, add/adjust Foundry tests and run ABI sync scripts.

Suggested commands:

```bash
pnpm --filter @shift/web test:unit
pnpm --filter @shift/indexer run dev
pnpm --filter @shift/indexer run test:unit
pnpm --filter @shift/indexer run test:integration
```

Feature-specific regression commands:

```bash
pnpm --filter @shift/web vitest run apps/web/tests/unit/components/valuable-actions
pnpm --filter @shift/web vitest run apps/web/tests/unit/hooks/use-valuable-action-authority-mode.test.tsx
pnpm --filter @shift/indexer vitest run test/integration/valuable-action-*.test.ts
```

Indexer replay validation commands:

```bash
pnpm --filter @shift/indexer run test:integration -- --runInBand
pnpm --filter @shift/indexer vitest run test/integration/valuable-action-replay-determinism.test.ts
```

If contract/event changes are introduced:

```bash
pnpm forge:test
node scripts/copy-ponder-abis.js
node scripts/copy-web-abis.js
```

## Step 5: Documentation synchronization

1. Update behavior docs under `docs/EN/` for admin/readiness semantics.
2. Update `contracts/FEATURES.md` and `neuromancer/SHIFT_SYSTEM.md` for shipped behavior changes.
3. If status/risk/workflow changed, update both:
   - `.github/project-management/IMPLEMENTATION_STATUS.md`
   - `.github/project-management/STATUS_REVIEW.md`

## Exit Criteria

1. All FR/SCN requirements in `spec.md` covered by tests.
2. No authority drift between contracts and UI behavior.
3. Projection readiness visible and verified in healthy and lagging scenarios.
4. Compatibility stance documented (`no ABI/event changes` or explicit migration plan).

## Verification Notes (Implementation)

1. `apps/indexer/ponder.config.ts` already includes `ValuableActionRegistry` in discovered contracts. Verified in current repo snapshot (factory contract map includes `ValuableActionRegistry`).
2. No contract source, ABI JSON, or event definition changes were required.

## Test Gate Results

Web gate executed:

```bash
pnpm --filter @shift/web exec vitest run tests/unit/components/valuable-actions tests/unit/hooks/use-valuable-action-authority-mode.test.tsx tests/unit/hooks/use-valuable-action-boundary.test.tsx tests/unit/hooks/use-valuable-action-readiness.test.tsx tests/unit/routes/community-valuable-action-boundary.test.tsx
```

Result: `17` files passed, `28` tests passed.

Indexer gate executed:

```bash
pnpm --filter @shift/indexer exec vitest run test/unit/abi-event-compatibility.test.ts test/integration/valuable-action-lifecycle-projection.test.ts test/integration/valuable-action-replay-determinism.test.ts test/integration/valuable-action-community-boundary.test.ts test/integration/valuable-action-activation-roundtrip.test.ts test/integration/valuable-action-readiness-endpoint.test.ts test/integration/valuable-action-schema-compatibility-smoke.test.ts
```

Result: `7` files passed, `8` tests passed.

## Indexer Replay/Backfill Runbook

1. Ensure latest schema and handler code are deployed.
2. Stop indexer process if running in watch mode.
3. Run integration replay checks:
   - `pnpm --filter @shift/indexer exec vitest run test/integration/valuable-action-replay-determinism.test.ts`
   - `pnpm --filter @shift/indexer exec vitest run test/integration/valuable-action-lifecycle-projection.test.ts`
4. Start indexer and monitor readiness endpoint:
   - `pnpm --filter @shift/indexer run dev`
   - `GET /communities/{communityId}/valuable-actions/readiness`
5. If lagging persists, re-run deterministic replay tests before promoting.

## Readiness Performance Notes

1. Local targeted suite runtime for web valuable-action tests: ~2.8s total; indexer targeted suite runtime: ~0.24s total.
2. Readiness endpoint logic is constant-time with latest-row fetch by `communityId` and does not require full table scans in normal operation.
3. Based on local validation, catalog/detail readiness operations remain within plan target for staging-scale datasets; production p95 should be re-checked with staging traffic replay.

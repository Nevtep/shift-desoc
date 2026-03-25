# Quickstart: Indexer Dynamic Multi-Community Discovery

## Goal
Implement and verify CommunityRegistry-driven dynamic discovery and community attribution across all indexed module contracts in `apps/indexer`.

## Prerequisites
1. Branch: `007-indexer-community-discovery`
2. Postgres available and `DATABASE_URL` configured
3. Required env vars set:
   - `COMMUNITY_REGISTRY_ADDRESS`
   - `COMMUNITY_REGISTRY_START_BLOCK`

## Implementation Order
1. Update `ponder.config.ts` to enforce env fail-fast and define CommunityRegistry + factory module sources.
2. Add mapping and telemetry tables in `ponder.schema.ts`.
3. Add/extend CommunityRegistry discovery handlers in `src/index.ts`.
4. Implement resolver helper and refactor module handlers to resolver-first attribution.
5. Remove `defaultCommunityId` assumptions from proposal/engagement/governance paths.
6. Add integration tests for discovery, attribution, rotation, and replay idempotency.
7. Update README runbook for env/replay/discovery observability.

## Validation Commands
Run from repo root.

```bash
pnpm --filter @shift/indexer run build
pnpm --filter @shift/indexer run dev
pnpm --filter @shift/indexer run check:events
pnpm --filter @shift/indexer run check:compat
```

Suggested targeted test run (once suites exist):

```bash
pnpm --filter @shift/indexer test
```

## Expected Validation Signals
- Startup fails immediately when required env vars are missing/invalid.
- CommunityRegistry-driven module discovery fills mapping tables.
- Business entities from multiple communities persist with correct `communityId`.
- Rotation boundary attribution is correct for before/after events.
- Replay twice does not duplicate mappings/entities.
- Unmapped emitter alerts are visible in telemetry/logs.

## Reorg/Replay Validation Scope

- Current local harness validates replay-based invariants (idempotency + stable attribution) using deterministic log-derived IDs.
- Full chain reorg simulation is not currently available in the local harness and is documented as a known limitation.

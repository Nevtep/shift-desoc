# Shift Indexer

Ponder-based indexer for Shift contracts writing to Postgres and exposing GraphQL APIs.

## Persistence Across Restarts

- Use a persistent Postgres volume/database (`DATABASE_URL`) and do not wipe it between runs.
- Start only one indexer process at a time; multiple concurrent starts can race on metadata and cause setup failures.
- If port `42069` is already occupied, Ponder may bind another port and your web app can end up querying a stale instance.

## PONDER_START_BLOCK Behavior

- If `COMMUNITY_REGISTRY_START_BLOCK` is unchanged, the indexer resumes from the latest finalized checkpoint.
- If `COMMUNITY_REGISTRY_START_BLOCK` changes, startup clears Ponder app/status metadata and re-initializes indexing from the new block.
- This is handled by `scripts/prepare-start.js`, executed before `ponder start` and `ponder dev`.

## Required Discovery Environment

- `COMMUNITY_REGISTRY_ADDRESS`: on-chain CommunityRegistry address used as discovery root.
- `COMMUNITY_REGISTRY_START_BLOCK`: replay/backfill start block for registry lifecycle events.
- `PONDER_NETWORK`: `base` or `base_sepolia`.

Startup fails fast when the required discovery env vars are missing/invalid.

## RPC Rate Limits During Startup

- `scripts/prepare-start.js` probes `COMMUNITY_REGISTRY_ADDRESS` bytecode with `eth_getCode` before launching Ponder.
- If your RPC returns `429`, startup now retries and can use optional fallback RPCs:
	- `RPC_BASE_FALLBACK`
	- `RPC_BASE_SEPOLIA_FALLBACK`
- By default, repeated `429` responses only warn and startup continues (useful for local dev).
- Set `INDEXER_STRICT_RPC_CHECK=1` to make rate-limit probe failures fatal.

## Replay And Backfill

1. Set `COMMUNITY_REGISTRY_START_BLOCK` to the desired replay boundary.
2. Run `pnpm --filter @shift/indexer run dev` (or `start`).
3. `scripts/prepare-start.js` clears Ponder app/status metadata when the start block changed.
4. Verify mappings and unmapped telemetry with:
	- `GET /api/discovery/health`

## Compatibility Checks

- ABI/event compatibility: `pnpm --filter @shift/indexer run check:events`
- Schema/query compatibility smoke: `pnpm --filter @shift/indexer run check:compat`

## Reorg/Replay Resilience Note

The local test harness validates replay idempotency invariants (stable attribution and no duplicate rows) using log-derived deterministic IDs.
Full chain reorg simulation is not currently available in this local harness.

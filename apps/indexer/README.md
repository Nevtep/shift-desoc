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

## RPC Requirements And Tuning

The indexer needs an RPC that serves `eth_getLogs` over historical ranges. The public
`sepolia.base.org` endpoint rejects every `eth_getLogs` (HTTP 413), so staging uses a provider URL
(Infura Base Sepolia) in `RPC_BASE_SEPOLIA`.

Ponder 0.7 first requests a whole historical interval in one `eth_getLogs` and only re-chunks when it
recognises the provider's range error. `src/rpc/get-logs-range-limit.ts` rejects oversized ranges
locally with a `Max range: N` error Ponder understands, so a months-long catchup is split into
`N`-block requests instead of crashing.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PONDER_RPC_MAX_BLOCK_RANGE` | `10000` | Max blocks per `eth_getLogs` (Infura's limit). |
| `PONDER_MAX_REQUESTS_PER_SECOND` | `50` | Ponder's RPC request rate cap. Do not lower it to protect the RPC: below ~20-50 req/s Ponder's historical step collapses to 25 blocks and the catchup never finishes. |
| `PONDER_POLLING_INTERVAL_MS` | `4000` | Realtime head polling interval (Base produces a block every 2s). |

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

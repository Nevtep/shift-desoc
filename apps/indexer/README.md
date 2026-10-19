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

The RPC plan must also cover steady state: Ponder fetches every new block (`eth_getBlockByNumber`), so
Base's 43,200 blocks/day cost ~3.5M Infura credits/day before any `eth_getLogs` — more than the free
tier's 3M. Staging runs on Infura Developer.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PONDER_RPC_MAX_BLOCK_RANGE` | `10000` | Max blocks per `eth_getLogs` (Infura's limit). |
| `PONDER_MAX_REQUESTS_PER_SECOND` | `50` | Ponder's RPC request rate cap. Size it to the provider plan (Infura Developer: 4,000 credits/s ÷ 255 per `eth_getLogs` ≈ 15). |
| `PONDER_POLLING_INTERVAL_MS` | `4000` | Realtime head polling interval (Base produces a block every 2s). |
| `PONDER_HISTORICAL_MIN_BLOCK_RANGE` | `PONDER_RPC_MAX_BLOCK_RANGE - 1` | Floor for Ponder's historical step size, applied by `patches/@ponder__core@0.7.17.patch`. Ponder targets ~1s per step with a 25-block floor; with a ~1s-latency RPC that pins steps at 25 blocks (hundreds of hours for a months-long gap). Measured on Infura Base Sepolia: ~1,400 blocks/s with the floor at 9,999. |

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

# Shift Indexer

Ponder-based indexer for Shift contracts writing to Postgres and exposing GraphQL APIs.

## Persistence Across Restarts

- Use a persistent Postgres volume/database (`DATABASE_URL`) and do not wipe it between runs.
- Start only one indexer process at a time; multiple concurrent starts can race on metadata and cause setup failures.
- If port `42069` is already occupied, Ponder may bind another port and your web app can end up querying a stale instance.

## PONDER_START_BLOCK Behavior

- If `PONDER_START_BLOCK` is unchanged, the indexer resumes from the latest finalized checkpoint.
- If `PONDER_START_BLOCK` changes, startup clears Ponder app/status metadata and re-initializes indexing from the new block.
- This is handled by `scripts/prepare-start.js`, executed before `ponder start` and `ponder dev`.

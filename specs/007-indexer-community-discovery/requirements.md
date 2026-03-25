# Requirements Snapshot: Feature 007 Indexer Community Discovery

This file captures the approved hard constraints from `spec.md` for planning and execution.

## Hard Constraints

- Env fail-fast:
  - Must read `COMMUNITY_REGISTRY_ADDRESS` and `COMMUNITY_REGISTRY_START_BLOCK` from environment.
  - Must fail before indexing if either is missing/invalid/unusable.
- Discovery source:
  - On-chain only via `CommunityRegistered` and `ModuleAddressUpdated`.
- Dynamic discovery:
  - Must use Ponder `factory()` sources.
  - No static module address assumptions in config.
- Attribution:
  - Deterministic emitter mapping windows (`address -> communityId + moduleKey + activeFrom/To`).
  - No `defaultCommunityId` fallback where mapping is possible.
- Rotation:
  - Close old window and open new window on `ModuleAddressUpdated`.
  - Zero-address update means deactivation (close only).
- Backfill/replay:
  - Replay from `COMMUNITY_REGISTRY_START_BLOCK` reconstructs mappings and ingests events.
  - Idempotent across repeated replays.
- Governance:
  - Proposal/vote attribution must be community-correct.
- Observability:
  - Unmapped emitter must be surfaced via telemetry/logging and never silently defaulted.
- Scope:
  - Indexer-only. No contract/frontend changes.

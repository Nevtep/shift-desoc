# Data Model: Indexer Dynamic Multi-Community Discovery

## 1) EmitterMappingWindow
- Purpose: Historical attribution of emitter contract addresses to a community and module key.
- Fields:
  - `id: string` (deterministic, e.g., `${communityId}:${moduleKey}:${activeFromBlock}`)
  - `emitterAddress: string` (lowercased 0x address)
  - `communityId: number`
  - `moduleKey: string`
  - `activeFromBlock: bigint`
  - `activeToBlock: bigint | null`
  - `discoveredAt: timestamp`
  - `closedAt: timestamp | null`
- Constraints:
  - unique `(communityId, moduleKey, activeFromBlock)`
  - `activeToBlock` null means currently active
- State transitions:
  - `open` on module activation
  - `closed` on module rotation/deactivation

## 2) EmitterMappingActive
- Purpose: Fast projection for current emitter-to-community attribution.
- Fields:
  - `emitterAddress: string` (pk)
  - `communityId: number`
  - `moduleKey: string`
  - `activeFromBlock: bigint`
  - `updatedAt: timestamp`
- Constraints:
  - one active row per emitter address
- State transitions:
  - overwritten when the same emitter is reassigned
  - deleted/invalidated on deactivation

## 3) UnmappedEmitterAlert
- Purpose: Operational record when an event emitter has no active mapping at event block.
- Fields:
  - `id: string` (deterministic from txHash+logIndex)
  - `emitterAddress: string`
  - `eventName: string`
  - `blockNumber: bigint`
  - `txHash: string`
  - `logIndex: number`
  - `observedAt: timestamp`
- Constraints:
  - unique `(txHash, logIndex)` for idempotent replay

## 4) Community (existing)
- Purpose: Community metadata projection from CommunityRegistry.
- Existing fields retained; no breaking changes.

## 5) Proposal (existing, attribution refined)
- Purpose: Governance proposal projection with community linkage.
- Key behavior update:
  - `communityId` must come from governor emitter mapping/proposal relationship, not default static community.

## 6) Request / Draft / Engagement and Related Entities (existing)
- Purpose: Business entities that now resolve `communityId` through emitter mapping when direct event args are unavailable or untrusted.
- Key behavior update:
  - resolver-based attribution before persistence.

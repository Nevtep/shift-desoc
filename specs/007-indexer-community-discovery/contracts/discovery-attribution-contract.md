# Discovery & Attribution Contract: Feature 007

## Discovery Source Contract

- Root source contract: `CommunityRegistry` at `COMMUNITY_REGISTRY_ADDRESS`.
- Root start block: `COMMUNITY_REGISTRY_START_BLOCK`.
- Discovery lifecycle events:
  - `CommunityRegistered(uint256 communityId, string name, address creator, uint256 parentCommunityId)`
  - `ModuleAddressUpdated(uint256 communityId, bytes32 moduleKey, address oldAddress, address newAddress)`

## Factory Contract-Source Strategy

- Single-level factory topology only (no nested factory chains).
- One factory source per module contract type (RequestHub, DraftsManager, ShiftGovernor, CountingMultiChoice, Engagements, VerifierManager, ValuableActionRegistry, PositionManager, CredentialManager, RevenueRouter, TreasuryAdapter, CohortRegistry, InvestmentCohortManager, Marketplace, HousingManager, CommerceDisputes, ProjectFactory, and other supported keys).
- Address extraction for factory sources uses `newAddress` from `ModuleAddressUpdated`.
- Module-type correctness is enforced by resolver/window mapping using `moduleKey` in indexer handlers.

## Attribution Contract

- Canonical resolver:
  - `resolveCommunityFromEmitter({ emitterAddress, blockNumber }) -> { communityId, moduleKey } | null`
- Attribution rules:
  - Use mapping window where `activeFromBlock <= blockNumber <= activeToBlock` (or open-ended active window).
  - If no window resolves, emit unmapped-emitter telemetry and skip entity write.
  - No fallback to static `defaultCommunityId` for attributed module events.

## Rotation Contract

- On `ModuleAddressUpdated`:
  - close prior active window for `(communityId, moduleKey)` using current block boundary.
  - if `newAddress != 0x0`, open new window from current block.
  - if `newAddress == 0x0`, no new window opened (deactivation).

## Idempotency Contract

- Mapping windows, active projection, and unmapped alerts use deterministic conflict keys.
- Replay from `COMMUNITY_REGISTRY_START_BLOCK` must produce stable state with no duplicate windows/entities.

## Governance Attribution Contract

- Proposal creation uses governor emitter mapping for community attribution.
- Vote/lifecycle handlers use stored proposal-community relation, with emitter mapping consistency checks where available.

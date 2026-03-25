# Research: Community Overview Dashboard

## Decision 1: Keep Hybrid Truth Model (Indexer previews + On-chain config)
- Decision: Use indexer GraphQL for latest-3 activity previews (Requests, Drafts, Proposals) and on-chain reads for module pointers + parameter subset.
- Rationale: Existing queries already support `communityId` + `limit`; on-chain is canonical for authority/config and prevents shadow-authority drift.
- Alternatives considered:
  - Indexer-only reads for all sections: rejected because it violates contract-first authority and can misreport privileged/config state during lag.
  - Chain-only reads for all sections: rejected because latest-3 previews become expensive/slow and conflict with existing indexer projection purpose.

## Decision 2: Reuse Existing Community Module Resolver Hook
- Decision: Reuse `useCommunityModules` for `getCommunityModules(communityId)` and status derivation (`present`/`missing`) with bytecode checks via public client.
- Rationale: Hook already maps module tuple safely and enforces community-scoped reads from `CommunityRegistry`.
- Alternatives considered:
  - New parallel hook for module wiring: rejected as duplication and increased drift risk.
  - ENV-only module addresses: rejected because spec requires community-scoped pointers, not global defaults.

## Decision 3: Deterministic Parameter Mapping via ParamController Reads
- Decision: Resolve fixed subset using ParamController typed getters (`getGovernanceParams`, `getEligibilityParams`, `getRevenuePolicy`, `getVerifierParams`) and mark unresolved values as `unavailable`.
- Rationale: This is deterministic, auditable, and aligned with spec mapping contract.
- Alternatives considered:
  - Generic `getUint256` by ad-hoc key constants only: rejected for higher mapping ambiguity and review risk.
  - Indexer-projected parameter values: rejected because config authority must remain on-chain.

## Decision 4: Community-Scoped Route Contract With Capability Flags
- Decision: Implement strict route targets under `/communities/[communityId]/...` and render all tabs; unavailable targets remain disabled with `Coming soon`.
- Rationale: Meets mandatory routing contract and avoids hidden/ambiguous navigation.
- Alternatives considered:
  - Hide unavailable tabs: rejected because spec requires visibility with disabled affordance.
  - Keep legacy query-param links (`?communityId=`): rejected by FR-012.

## Decision 5: Indexer Health Signal Strategy
- Decision: Use `GET /api/health` for baseline availability and derive list-panel honesty from query success/error; if health endpoint or queries fail, show `error`; if healthy but stale window exceeded, show `lagging` warning.
- Rationale: Existing indexer exposes `/api/health`; query-layer state already available via React Query hooks.
- Alternatives considered:
  - No health indicator: rejected by FR-002/FR-011.
  - Add new indexer schema field immediately: deferred; not required for first overview slice.

## Decision 6: Authority Gating Policy for Overview Actions
- Decision: Gate `Edit parameters` by connected wallet + governance authority signal from community wiring (governor/timelock path and role checks where available); default to disabled on uncertainty.
- Rationale: Prevents implied mutation capability and preserves safety-first UX.
- Alternatives considered:
  - Enable by default and fail at tx-time: rejected as misleading and violates FR-013.
  - Hardcode admin wallets: rejected as non-deterministic and non-portable.

## Decision 7: Scope/Compatibility Discipline
- Decision: No contract bytecode changes, no indexer schema mutation required for MVP overview; limit to manager app composition and optional additive indexer health/UI adapters.
- Rationale: Feature is read-only overview and routing contract enforcement.
- Alternatives considered:
  - Introduce protocol-level additions now: rejected as out of scope and unnecessary risk.

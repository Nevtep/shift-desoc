# Implementation Plan: Governance Hub (Community-scoped) + Draft to Proposal Escalation

**Branch**: `009-governance-hub-escalation` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**:
- [spec.md](./spec.md)
- [requirements.md](./requirements.md)
- [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

## Summary

Deliver a community-scoped governance vertical in `apps/web` with three new community routes, proposal list/detail scoped by route `communityId`, weighted multi-choice voting (internal bps exact total = 10,000; UI percent with two decimals), draft-to-proposal escalation with event-log proposalId derivation, and community overview CTA fixes. Keep protocol/indexer unchanged and maintain indexer-first reads with minimal read-only chain fallback for readiness and vote enrichment.

## Technical Context

**Language/Version**: TypeScript 5.x, React 19, Next.js 16 App Router, Node >=22  
**Primary Dependencies**: `wagmi`, `viem`, `@tanstack/react-query`, `graphql-request`, `msw`, `vitest`, `@testing-library/react`  
**Storage**: N/A (read-only indexer GraphQL + chain reads; no persistence schema changes)  
**Testing**: Vitest unit tests + MSW GraphQL/HTTP mocks under `apps/web/tests/unit`  
**Target Platform**: Web dApp on Base Sepolia wallet-connected clients  
**Project Type**: Monorepo web frontend slice (`apps/web`)  
**Performance Goals**: Keep proposal pages responsive with indexer-first data and bounded fallback reads (single-proposal view methods only)  
**Constraints**:
- No changes in `contracts/**`
- No changes in `apps/indexer/**`
- No voting protocol or timelock semantic changes
- Keep community-scoped deterministic routing; no global route regressions  
**Scale/Scope**: 3 new app-router pages, targeted component refactors, query updates, and FR-016 unit test expansion

## Constitution Check (Pre-Design Gate)

*GATE: PASS before Phase 0 research.*

- Protocol infrastructure first: PASS. No protocol primitives added; all behavior is in Manager app UI/routing.
- Contract-first authority: PASS. All permissions/state transitions remain contract-driven; app performs only read/tx calls.
- Security/invariant preservation: PASS. No privileged mutation path changes; Governor/Timelock semantics unchanged.
- Event/indexer discipline: PASS. No event/ABI/schema changes; indexer remains authoritative projection for reads.
- Monorepo vertical-slice scope: PASS. Only web app + tests + feature docs touched.
- Project-management docs sync: PASS. No status/risk/architecture baseline changes requiring PM docs updates at planning stage.
- Compatibility discipline: PASS. No breaking interface/event changes introduced.

## Phase 0 Output

- Research completed in [research.md](./research.md)
- All planning unknowns resolved without `NEEDS CLARIFICATION` placeholders.

## Project Structure

### Documentation (this feature)

```text
specs/009-governance-hub-escalation/
├── plan.md
├── requirements.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── governance-hub.graphql
│   └── onchain-interactions.md
└── tasks.md
```

### Source Code (planned touchpoints)

```text
apps/web/app/communities/[communityId]/governance/page.tsx
apps/web/app/communities/[communityId]/governance/proposals/page.tsx
apps/web/app/communities/[communityId]/governance/proposals/[proposalId]/page.tsx
apps/web/components/communities/governance-top-bar.tsx
apps/web/components/governance/proposal-list.tsx
apps/web/components/governance/proposal-detail.tsx
apps/web/components/drafts/draft-detail.tsx
apps/web/hooks/useCommunityOverviewActivity.ts
apps/web/lib/community-overview/routes.ts
apps/web/lib/graphql/queries.ts
apps/web/tests/unit/routes/*.test.ts
apps/web/tests/unit/components/governance/*.test.tsx
apps/web/tests/unit/components/drafts/draft-detail.test.tsx
apps/web/tests/unit/community-overview/*.test.tsx
```

**Structure Decision**: Implement as a pure `apps/web` vertical slice with community-scoped routes and component-level behavior changes, preserving existing global governance pages for backward compatibility and minimizing unrelated churn.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No | N/A | No Solidity, ABI, or event changes |
| Indexer (Ponder) | No | N/A | Existing proposal/vote entities reused as-is |
| Manager App (Next.js) | Yes | `apps/web/**` | GraphQL query usage is additive/refined, no backend schema change |
| Downstream dApp Surface | No | N/A | No protocol-facing API change |
| Documentation | Yes | `specs/009-governance-hub-escalation/**` | Planning artifacts only |

## Implementation Workstreams

### 1) Routing and page scaffolds

- Add route files:
  - `apps/web/app/communities/[communityId]/governance/page.tsx`
  - `apps/web/app/communities/[communityId]/governance/proposals/page.tsx`
  - `apps/web/app/communities/[communityId]/governance/proposals/[proposalId]/page.tsx`
- Add reusable top bar:
  - `apps/web/components/communities/governance-top-bar.tsx`
  - Mirrors existing coordination top-bar style: `Community #<id>`, indexer health badge, back link to `/communities/[communityId]`.
- Enforce no global-nav leakage:
  - Community pages must route via community-scoped links only.
- Navigation updates:
  - Draft detail CTA path targets community-scoped proposal detail/list.
  - Community overview proposals panel `View all` goes to `/communities/[communityId]/governance/proposals`.

### 2) Data sourcing strategy (GraphQL-first)

- Query definitions in `apps/web/lib/graphql/queries.ts` (reuse/extend):
  - `ProposalsQuery` scoped by `communityId` for list.
  - `ProposalQuery` by `proposalId` for detail.
  - Detail includes `multiChoiceOptions`, `votes`, `state`, `queuedAt`, `executedAt`.
  - If available, infer current voter snapshot from `votes`; else optional governor fallback via `getVoterMultiChoiceWeights`.
- Contract files for operations:
  - [contracts/governance-hub.graphql](./contracts/governance-hub.graphql)
- Readiness stale criteria:
  - stale if health state is `lagging`/`error` (existing 600s threshold from `INDEXER_LAG_THRESHOLD_SECONDS`), or
  - stale if queued/executed timestamps are absent for queued/executed state.
- Minimal read-only fallback plan (no semantic drift):
  - Resolve governor via `useCommunityModules`.
  - Call view methods only: `state`, `proposalEta`, `proposalNeedsQueuing`, optional `getMultiChoiceTotals`, optional `getVoterMultiChoiceWeights`.
  - Never call queue/execute as part of readiness fallback.

### 3) Weighted vote UX

- Refactor `apps/web/components/governance/proposal-detail.tsx` vote form:
  - Replace single-option full-weight behavior with per-option allocation editor.
  - Inputs: per-option numeric percent (2 decimals) and/or slider synchronized to bps integers.
  - Internal model: `optionBps: number[]`, exact integer sum validation `=== 10_000`.
  - Display format: `(bps / 100).toFixed(2)%`.
- Submission:
  - Convert bps integers to contract weights array directly.
  - Submit via existing wagmi utility `writeContractAsync` calling `castVoteMultiChoice`.
  - Keep state machine: idle -> pending -> submitted/confirmed or error.
- Error handling:
  - wallet disconnected
  - wrong network
  - user rejected signature
  - contract revert (surface parsed message)

### 4) Draft to proposal escalation UX

- Entry point stays in `apps/web/components/drafts/draft-detail.tsx` as `Escalate to proposal` form/CTA.
- Gating (before submit):
  - connected wallet
  - supported network
  - draft community matches route `communityId`
  - action bundle non-empty (`targets`, `values`, `calldatas`, `actionsHash`) validated via draft detail payload and/or module read fallback
- Inputs and defaults:
  - proposal description (CID or markdown upload)
  - `multiChoice` default `true`
  - `numOptions` default `2`
- Tx execution:
  - resolve community DraftsManager via `useCommunityModules` from `CommunityRegistry.getCommunityModules`
  - call `escalateToProposal(draftId, multiChoice, numOptions, description)`
- ProposalId derivation:
  - wait for tx receipt
  - decode `ProposalEscalated` log from DraftsManager ABI
  - use parsed `proposalId` for detail redirect
  - fallback to proposals list with indexing-lag message when parsing fails

### 5) Overview CTA update plan

- Update proposal panel state generation in `apps/web/hooks/useCommunityOverviewActivity.ts`:
  - proposals `viewAll.enabled = true`
  - proposals `create.enabled = false`
- Keep route builder in `apps/web/lib/community-overview/routes.ts`:
  - `viewAll` remains `/communities/[communityId]/governance/proposals`
  - `create` remains `/communities/[communityId]/governance/proposals/new` but rendered as disabled button/non-link
- Parameters CTA remains disabled via overview header action state.

### 6) Testing plan mapped to FR-016

- Route existence tests:
  - add `apps/web/tests/unit/routes/community-governance-routes-exist.test.ts`
  - assert three community-governance route modules export default page functions
- Scoping tests:
  - extend `proposal-list` tests to verify route community filtering and no cross-community leakage
- Mismatch guard tests:
  - extend `proposal-detail` tests to assert mismatch banner and correction link
- Weighted allocation validation tests:
  - new `proposal-detail` cases for exact `10_000` bps requirement, submit disabled/enabled transitions, two-decimal display formatting
- Vote submission tests:
  - mock tx success/failure and assert pending/submitted/confirmed/error UI states
- Escalation tests:
  - extend `draft-detail` tests for receipt log with derivable `proposalId` -> detail redirect
  - fallback path without derivable `proposalId` -> proposals list + lag notice
- Overview CTA tests:
  - update/add tests to ensure proposals `View all` is enabled link
  - proposals `Create new` disabled button
  - parameters CTA disabled button

### 7) Definition of Done

- SC-001..SC-006 are covered by unit tests and deterministic checks documented in [quickstart.md](./quickstart.md).
- `git diff --name-only` contains no paths under `contracts/` (except feature spec artifacts) and none under `apps/indexer/`.
- No contract ABI/event or indexer schema changes.

## Phase 1 Outputs

- [data-model.md](./data-model.md)
- [contracts/governance-hub.graphql](./contracts/governance-hub.graphql)
- [contracts/onchain-interactions.md](./contracts/onchain-interactions.md)
- [quickstart.md](./quickstart.md)

## Constitution Check (Post-Design Re-evaluation)

*GATE: PASS after Phase 1 design.*

- Protocol infrastructure first: PASS. Design is UI/routing only.
- Contract-first authority: PASS. Chain reads/writes map to existing modules and ABI methods.
- Security/invariant preservation: PASS. No new privileged pathways; queue/execute semantics not expanded.
- Event/indexer discipline: PASS. Indexer-first model preserved; no event/schema modifications.
- Monorepo vertical-slice scope: PASS. All required web/test/doc impacts explicitly captured.
- PM docs sync requirement: PASS. No workflow/status architecture shift in this plan.
- Compatibility discipline: PASS. Non-breaking by design.

## Complexity Tracking

No constitution violations requiring justification.

# Requirements Baseline: 009-governance-hub-escalation

## Source of Truth

- Primary feature spec: [spec.md](./spec.md)
- Quality validation: [checklists/requirements.md](./checklists/requirements.md)

## Scope Constraints

- In scope: `apps/web` governance routes/pages, proposal list/detail UX, weighted vote UX, draft escalation UX, community overview CTA routing, and tests.
- Out of scope: contract changes, indexer schema changes, voting mechanics protocol changes, timelock execution semantics changes.

## Must-Have Requirements

1. Community-scoped governance routes must exist:
   - `/communities/[communityId]/governance`
   - `/communities/[communityId]/governance/proposals`
   - `/communities/[communityId]/governance/proposals/[proposalId]`
2. Proposal list/detail must be community-scoped and include mismatch guard behavior.
3. Weighted multi-choice vote UX must:
   - validate allocations as integer basis points
   - require exact total `10,000` bps before submit
   - render UI allocations as percentages with exactly two decimals
4. Execution readiness must use indexer fields first and perform minimal read-only chain fallback only when readiness fields are missing or stale.
5. Draft escalation from community draft detail must enforce gating:
   - wallet connected
   - correct network
   - draft belongs to route community
   - non-empty action bundle (`targets`, `values`, `calldatas`, `actionsHash`)
6. Escalation success navigation must attempt proposalId derivation from tx receipt logs/events first; fallback to proposals list with indexing-lag notice if unresolved.
7. Community overview proposal CTAs must be:
   - `View all` enabled and routed to `/communities/[communityId]/governance/proposals`
   - `Create new` disabled non-link
   - Parameters CTA disabled non-link
8. FR-016 test coverage must include route existence, scoping, mismatch guard, weighted allocation validation, vote flow states, escalation with/without proposalId derivation, and overview CTA behavior.

## Compatibility Rules

- No changes in `contracts/**`.
- No changes in `apps/indexer/**`.
- No ABI/event compatibility changes.

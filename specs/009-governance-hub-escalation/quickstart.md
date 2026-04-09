# Quickstart: 009-governance-hub-escalation

## Preconditions

- Node `>=22`
- Install workspace deps from repo root:

```bash
pnpm install
```

## Implement in Scope

- Only modify `apps/web/**` and feature artifacts under `specs/009-governance-hub-escalation/**`.
- Do not modify `contracts/**`.
- Do not modify `apps/indexer/**`.

## Build the Community-Scoped Governance Routes

- Add pages:
  - `apps/web/app/communities/[communityId]/governance/page.tsx`
  - `apps/web/app/communities/[communityId]/governance/proposals/page.tsx`
  - `apps/web/app/communities/[communityId]/governance/proposals/[proposalId]/page.tsx`
- Add/extend components for:
  - governance top bar with indexer health badge
  - proposals list scoped by route communityId
  - proposal detail mismatch guard + weighted vote UI + readiness status

## Integrate Draft Escalation from Community Draft Detail

- Update:
  - `apps/web/components/drafts/draft-detail.tsx`
  - `apps/web/app/communities/[communityId]/coordination/drafts/[draftId]/page.tsx`
- Enforce gating and parse `ProposalEscalated` from tx receipt logs for redirect.

## Update Overview CTAs

- Update proposal panel CTA enablement in:
  - `apps/web/hooks/useCommunityOverviewActivity.ts`
- Keep proposal create CTA and parameters CTA disabled non-link.

## Run Targeted Unit Tests

From repo root:

```bash
pnpm --filter @shift/web vitest run tests/unit/routes/community-governance-routes-exist.test.ts
pnpm --filter @shift/web vitest run tests/unit/community-overview/activity-proposals-enabled.test.tsx
pnpm --filter @shift/web vitest run tests/unit/components/governance/proposal-list.test.tsx
pnpm --filter @shift/web vitest run tests/unit/components/governance/proposal-detail.test.tsx
pnpm --filter @shift/web vitest run tests/unit/components/drafts/draft-detail.test.tsx
```

Then run the full unit suite (or workspace task):

```bash
pnpm --filter @shift/web test:unit
```

## Deterministic Acceptance Checks

- SC-001: All three community governance route modules import/export default page functions.
- SC-002: Proposal list query variables include route `communityId` and rendered rows are community-scoped.
- SC-003: Proposal detail mismatch banner appears for cross-community proposal.
- SC-004: Escalation receipt parsing redirects to detail when proposalId decoded; otherwise list + lag notice.
- SC-005: Community overview proposals `View all` is enabled link; `Create new` remains disabled button.
- SC-006: `git diff --name-only` contains no paths under `contracts/` or `apps/indexer/`.

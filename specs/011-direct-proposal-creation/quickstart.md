# Quickstart: Direct Proposal Creation

## Prerequisites
- Repository root: `/Users/core/Code/shift`
- Node 22 + pnpm installed
- Manager app dependencies installed (`pnpm install`)
- Wallet and Base Sepolia environment configured for local testing

## 1) Add community-scoped proposal create route
1. Create page route:
   - `apps/web/app/communities/[communityId]/governance/proposals/new/page.tsx`
2. Keep route contract aligned with existing overview routing/tests:
   - `/communities/[communityId]/governance/proposals/new`

## 2) Implement direct proposal submit UI using existing composer
1. Reuse composer behavior from `DraftCreateForm` (guided + expert, allowlist-constrained action building).
2. Provide direct-governor submit mode that calls:
   - `propose(targets, values, calldatas, description)` for binary
   - `proposeMultiChoice(targets, values, calldatas, description, numOptions)` for multi-choice
3. Enforce pre-submit gates:
   - valid communityId
   - resolved governor for selected community
   - chain/context match
   - exact allowlist compliance

## 3) Implement proposalId recovery and routing
1. After tx confirmation, decode receipt logs for proposal created events.
2. If needed, use deterministic governor read fallback (`getProposalId`/`hashProposal` path).
3. Route outcomes:
   - detail route when `proposalId` resolved
   - community proposals list fallback with lag context when unresolved

## 4) Preserve failure and retry safety
1. Prevent duplicate submits while transaction is pending.
2. Preserve composer state on wallet rejection and revert.
3. Surface actionable errors without destructive reset.

## 5) Enable community overview create CTA
1. Update overview activity model so proposals `create` action is enabled when feature route is available.
2. Keep view-all and create links strictly community scoped.

## 6) Validate with tests
Run focused unit tests first:

```bash
pnpm --filter @shift/web vitest run tests/unit/components/governance/proposal-list.test.tsx
pnpm --filter @shift/web vitest run tests/unit/components/governance/proposal-detail.test.tsx
pnpm --filter @shift/web vitest run tests/unit/routes/community-routing-allowlist.test.ts
pnpm --filter @shift/web vitest run tests/unit/community-overview/activity-cta-routing.test.tsx
```

Run full web unit suite if needed:

```bash
pnpm --filter @shift/web test:unit
```

## 7) Documentation and status sync checks
1. If shipped UX behavior changes governance authoring capability, update:
   - `neuromancer/SHIFT_SYSTEM.md`
   - `contracts/FEATURES.md`
2. If status/risk/workflow expectations change, update both:
   - `.github/project-management/IMPLEMENTATION_STATUS.md`
   - `.github/project-management/STATUS_REVIEW.md`

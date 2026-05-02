# Quickstart: Implementing Feature 013

## Goal

Ship a complete, real transaction-capable Engagement flow with community-scoped list/detail/create surfaces and truthful post-submit lifecycle visibility.

## Preconditions

1. Work on branch 013-engagements-lifecycle-ux.
2. Keep default no-ABI/event-change path unless hard blocker is proven.
3. Confirm all Phase 0 decisions in research.md are accepted.

## Implementation Checklist

1. Replace global or free-form community inputs in submit flow with selected community context.
2. Use active Valuable Actions only from selected community for submit.
3. Render structured evidence inputs based on Valuable Action evidence spec assumptions.
4. Build evidence payload and upload to IPFS before submit.
5. Call Engagements.submit(typeId, evidenceCID) on the resolved community engagements module.
6. Decode EngagementSubmitted from tx receipt and recover engagementId.
7. Route deterministically to community-scoped engagement detail/list using recovered identity.
8. Show readiness/lifecycle truth model that separates chain confirmation from projection lag.
9. Enforce boundary guard on create/list/detail routes.
10. Ensure zero placeholder persistence and zero fake created state.

## Step 1: Submit flow and tx state machine (Manager)

1. Update submit UI to use selected community route context, not manual community id entry.
2. Load active Valuable Action catalog options for that community only.
3. Validate evidence fields against selected Valuable Action structured spec.
4. Upload evidence payload to IPFS and capture CID.
5. Trigger one write transaction to Engagements.submit(typeId, evidenceCID).
6. Wait for receipt, decode EngagementSubmitted, and capture engagementId.

Verification:
1. Successful submit yields tx hash and engagementId.
2. Wallet reject/wrong chain/revert map to explicit user states.
3. No engagement appears as created until identity is recovered from chain.

## Step 2: Deterministic post-submit routing

1. On identity recovery success, navigate to community-scoped detail route.
2. Persist only tx context needed for retry during same session (no fake engagement rows).
3. If receipt is confirmed but identity decode fails, keep identity recovery state and offer retry.

Verification:
1. Success route always includes canonical community and engagement identity.
2. Decode failure never results in fabricated ID or optimistic detail route.

## Step 3: List/detail/readiness truth model

1. Ensure list and detail queries are community-scoped and boundary guarded.
2. Keep status truthful: pending until resolution events exist.
3. Show readiness (healthy/lagging/unavailable) and explain projection delay.
4. Merge immediate chain-confirmed submit data with projected enrichment when available.

Verification:
1. Cross-community deep links are blocked or redirected.
2. Lagging projection still shows confirmed submission truth without claiming enrichment exists.

## Step 4: Indexer and query contracts

1. Confirm EngagementSubmitted and lifecycle handlers produce required list/detail fields.
2. Add additive readiness endpoint/query for engagements if needed.
3. Ensure query contracts in web match indexer schema naming and IDs.

Verification:
1. Replay/indexer tests pass for engagement projection.
2. Web query layer resolves community-scoped records consistently.

## Step 5: Tests

Run targeted tests:

```bash
pnpm --filter @shift/web vitest run tests/unit/components/engagement-submit-form.test.tsx tests/unit/components/engagement-list.test.tsx tests/unit/components/engagement-detail.test.tsx
pnpm --filter @shift/web test:unit
pnpm --filter @shift/indexer run test:unit
pnpm --filter @shift/indexer run test:integration
```

If contract changes become necessary:

```bash
pnpm forge:test
node scripts/copy-ponder-abis.js
node scripts/copy-web-abis.js
```

## Step 6: Documentation and status sync

1. Update docs/EN architecture and verification docs for shipped Engagement flow behavior.
2. Update contracts/FEATURES.md and neuromancer/SHIFT_SYSTEM.md if behavior changed.
3. If status/risk/workflow changed, update both:
   - .github/project-management/IMPLEMENTATION_STATUS.md
   - .github/project-management/STATUS_REVIEW.md

## Exit Criteria

1. Real user can submit engagement on target network with one tx and canonical engagement identity recovery.
2. Create/list/detail are strictly community-scoped.
3. Active Valuable Action enforcement is in place for submit.
4. Post-submit state is truthful under both healthy and lagging projection conditions.
5. No fake optimistic created state exists before tx success and identity recovery.

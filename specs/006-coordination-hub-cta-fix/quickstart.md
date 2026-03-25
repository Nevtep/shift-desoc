# Quickstart: Implement 006 Coordination Hub CTA Fix

## Goal
Implement community-scoped coordination wrappers for Requests/Drafts and enforce no-404 Overview CTA behavior with disabled non-link controls for out-of-scope destinations.

## Prerequisites
1. Branch: `006-coordination-hub-cta-fix`
2. Install deps:
```bash
pnpm install
```

## Implementation Order
1. Confirm wrapper routes under `apps/web/app/communities/[communityId]/coordination/**` exist and compile.
2. Patch reusable request/draft components with scoped href-builder and fixed community props (no business-logic rewrite).
3. Ensure create forms render route-derived community as read-only in scoped wrappers.
4. Add mismatch guard behavior in request/draft detail components.
5. Harden Overview CTA rendering:
   - Requests/Drafts enabled links to scoped routes
   - Proposals/View parameters disabled as non-link controls
   - Edit parameters remains permission-gated and non-navigable when disabled
6. Add/refresh focused unit tests for route existence, link correctness, create-form context, mismatch guards, and disabled CTA behavior.

## Validation Commands
Run from repo root unless noted.

```bash
pnpm -C apps/web exec vitest run \
  ./tests/unit/routes/community-coordination-routes-exist.test.ts \
  ./tests/unit/community-overview/activity-proposals-disabled.test.tsx \
  ./tests/unit/community-overview/authority-actions.test.tsx \
  ./components/requests/request-list.test.tsx \
  ./components/requests/request-detail.test.tsx \
  ./components/drafts/draft-list.test.tsx \
  ./components/drafts/draft-detail.test.tsx
```

Optional broader check:
```bash
pnpm -C apps/web test:unit
```

## Completion Checklist
- [ ] All 7 scoped routes resolve (no 404)
- [ ] Scoped list links target scoped detail routes only
- [ ] Create forms use read-only route-derived community context
- [ ] Mismatch guard renders error banner and correction link
- [ ] Overview disabled CTAs are non-navigable controls (not Links)
- [ ] Focused regression tests pass
- [ ] If status changed materially, update both project-management status files

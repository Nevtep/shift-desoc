# Implementation Plan: Community Coordination Hub And Overview CTA Safety

**Branch**: `006-coordination-hub-cta-fix` | **Date**: 2026-03-25 | **Spec**: `/specs/006-coordination-hub-cta-fix/spec.md`
**Input**: Feature specification from `/specs/006-coordination-hub-cta-fix/spec.md`

## Summary

Deliver community-scoped coordination navigation and no-404 Overview CTA behavior by reusing existing Requests/Drafts business components through thin App Router wrappers under `/communities/[communityId]/coordination/**`, adding minimal prop-driven link/context patches, and enforcing disabled CTA controls as non-navigable buttons in Overview surfaces.

## Technical Context

**Language/Version**: TypeScript (Next.js 16 App Router, React 19)  
**Primary Dependencies**: Next.js App Router, graphql-request, TanStack Query, wagmi/viem, Vitest, Testing Library, MSW  
**Storage**: N/A (UI and route composition only; no new persistence)  
**Testing**: Vitest + Testing Library + MSW focused route/component tests  
**Target Platform**: Web Manager app (`apps/web`)  
**Project Type**: Monorepo web vertical slice (Manager-only behavior change with docs sync)  
**Performance Goals**: Maintain current UX responsiveness; no additional heavyweight data sources; keep list/detail fetch paths unchanged  
**Constraints**: No protocol/indexer schema changes unless strictly required; no governance/parameters pages added; no internal navigation to global `/requests/*` or `/drafts/*` from scoped pages; disabled CTAs must not be Links  
**Scale/Scope**: 7 community-scoped route wrappers, minimal request/draft component interface extensions, overview CTA rendering hardening, focused regression suite

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: PASS. No contract feature changes; all behavior isolated to Manager app wrappers and existing UI state logic.
- Contract-first authority: PASS. No app or indexer shadow-authority introduced; `Edit parameters` remains permission-gated using existing signals.
- Security/invariant preservation: PASS. No privileged mutation path changes; governance/timelock/treasury/verifier invariants untouched.
- Event/indexer discipline: PASS. No event/ABI/schema changes required; indexer remains read source for existing list/detail and health endpoints.
- Monorepo vertical-slice scope: PASS. Impact documented across contracts/indexer/app/docs; implementation confined to app + tests + status docs where required.
- Project-management docs sync: PASS with conditional. If implementation deltas affect status/risk posture, update both `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` in same PR.
- Compatibility discipline: PASS. No interface/event breaking changes; downstream compatibility preserved.

## Project Structure

### Documentation (this feature)

```text
specs/006-coordination-hub-cta-fix/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-routing-contract.md
└── tasks.md                # generated later by /speckit.tasks
```

### Source Code (repository root)

```text
apps/web/app/communities/[communityId]/coordination/
apps/web/components/communities/overview/
apps/web/components/communities/coordination-top-bar.tsx
apps/web/components/requests/
apps/web/components/drafts/
apps/web/hooks/
apps/web/lib/community-overview/
apps/web/tests/unit/
.github/project-management/
```

**Structure Decision**: Use thin route wrappers under `apps/web/app/communities/[communityId]/coordination/**` that compose existing Requests/Drafts containers and forms via scoped props, avoiding business-logic rewrites.

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | No | `contracts/**` (read-only context) | No Solidity/API/event changes; governance and verification invariants unaffected |
| Indexer (Ponder) | No | `apps/indexer/**` (read-only dependency) | Existing requests/drafts/proposals/health reads reused; no schema/replay changes |
| Manager App (Next.js) | Yes | `apps/web/app/communities/[communityId]/coordination/**`, `apps/web/components/{requests,drafts,communities/overview}/**`, `apps/web/hooks/**`, `apps/web/lib/community-overview/**` | Adds route wrappers and UI-state rendering changes only; no backend contract changes |
| Downstream dApp Surface | No | N/A | No exported ABI/event/query contract changes for other dApps |
| Documentation | Yes (minor) | `.github/project-management/IMPLEMENTATION_STATUS.md`, `.github/project-management/STATUS_REVIEW.md` (if implementation delta requires) | Synchronized updates required when status/risk posture changes |

## Implementation Design

### 1) File Groups And Wrapper Routes

Create/maintain the exact route set as thin wrappers:

- Hub: `apps/web/app/communities/[communityId]/coordination/page.tsx`
- Requests:
  - `apps/web/app/communities/[communityId]/coordination/requests/page.tsx`
  - `apps/web/app/communities/[communityId]/coordination/requests/new/page.tsx`
  - `apps/web/app/communities/[communityId]/coordination/requests/[requestId]/page.tsx`
- Drafts:
  - `apps/web/app/communities/[communityId]/coordination/drafts/page.tsx`
  - `apps/web/app/communities/[communityId]/coordination/drafts/new/page.tsx`
  - `apps/web/app/communities/[communityId]/coordination/drafts/[draftId]/page.tsx`

### 2) Reuse Strategy (No Business-Logic Rewrite)

- Requests reuse:
  - `RequestList` with `communityId` filter and scoped `detailHrefBuilder`
  - `RequestCreateForm` with route-derived `fixedCommunityId` and scoped `successRedirectHref`
  - `RequestDetail` with `expectedCommunityId`, scoped `requestListHref`, and scoped `draftHrefBuilder`
- Drafts reuse:
  - `DraftList` with `communityId` filter and scoped `detailHrefBuilder`
  - `DraftCreateForm` with route-derived `fixedCommunityId` and scoped `successRedirectHref`
  - `DraftDetail` with `expectedCommunityId`, scoped `draftsListHref`, and scoped `requestHrefBuilder`
- Routing generation strategy:
  - Use prop-based href builders for minimal intrusion.
  - Central route helpers are optional and deferred to a follow-up refactor; not required for this scope.

### 3) Minimal Component Patches Required

- `RequestCreateForm`: support fixed community context and read-only display; remove editable path when wrapper provides fixed community.
- `DraftCreateForm`: same fixed community behavior and read-only display.
- Request list/detail link targets:
  - add optional scoped href builders in `RequestListItem`, `RequestList`, `RequestDetailDrafts`, and `RequestDetail`.
- Draft list/detail link targets:
  - add optional scoped href builders in `DraftList` and `DraftDetail`.
- Overview CTA rendering:
  - `ActivityPanel` must render disabled CTAs as disabled non-link controls.
  - `OverviewHeader` must render disabled actions as disabled non-link controls.
  - Proposals and View parameters remain disabled/coming-soon non-navigable.

### 4) Detail Mismatch Guard Approach

- Source of truth for entity community:
  - Request detail: existing request payload community field in `RequestDetail` data.
  - Draft detail: existing draft payload community field in `DraftDetail` data.
- Guard behavior:
  - Compare `entity.communityId` with route-derived `expectedCommunityId` passed by wrapper route.
  - On mismatch, render banner text naming both communities and provide correction href to proper community-scoped route.
  - Keep content visible for transparency; do not silently rewrite route context.

### 5) Testing Strategy

- Route existence:
  - unit module import test covering all 7 community-scoped routes.
- Link correctness:
  - request and draft list tests assert row links resolve to scoped detail routes.
- Create forms:
  - tests assert read-only route-derived community context and scoped redirect target support.
- Mismatch guards:
  - request detail and draft detail tests for mismatched route vs payload community.
- Overview CTA behavior:
  - requests/drafts enabled links.
  - proposals/view-parameters disabled non-link controls.
  - edit-parameters remains permission-gated and non-navigable when disabled.

### 6) Definition Of Done

- Overview Requests/Drafts CTAs no longer 404 and point to real scoped routes.
- Overview Proposals and View parameters controls are disabled and non-navigable.
- All 7 required community-scoped coordination pages exist and render.
- No internal scoped-page links point to global `/requests/*` or `/drafts/*`.
- Create request and create draft flows use route-derived read-only community context.
- Request/draft detail mismatch guard renders error + correction link.
- Focused test suite for routing/links/forms/mismatch/CTA behavior passes.
- If implementation status changed materially, both project-management status docs are updated together.

## Post-Design Constitution Re-Check

- Protocol infrastructure first: PASS (Manager wrappers only).
- Contract-first authority: PASS (no new authority semantics).
- Security and invariants: PASS (no privileged path changes).
- Event/indexer discipline: PASS (no ABI/event/schema modifications).
- Vertical-slice delivery: PASS (app + tests + docs impact captured).
- Docs sync discipline: PASS (explicit synchronized update rule captured).
- Compatibility discipline: PASS (no breaking downstream change).

## Complexity Tracking

No constitution violations or complexity exceptions required for this feature.

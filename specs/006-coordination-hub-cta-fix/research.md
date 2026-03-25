# Research: 006 Coordination Hub CTA Fix

## Decision 1: Use thin community-scoped App Router wrappers over existing Requests/Drafts components
- Decision: Implement all required `/communities/[communityId]/coordination/**` routes as wrappers that compose existing list/detail/create components.
- Rationale: Reuses proven IPFS + on-chain submission and list/detail logic while minimizing regression risk and preserving current contract interaction flows.
- Alternatives considered:
  - Rewrite dedicated community-specific components: rejected due to duplicate logic and increased drift risk.
  - Redirect from overview to global `/requests` and `/drafts`: rejected by spec and would preserve scope leakage.

## Decision 2: Use prop-driven scoped link builders instead of broad routing refactor
- Decision: Extend existing list/detail components with optional href builder props (`detailHrefBuilder`, `draftHrefBuilder`, `requestHrefBuilder`) and wrapper-provided back links.
- Rationale: Small patch footprint, explicit route control per wrapper, no need to introduce cross-app routing migration.
- Alternatives considered:
  - Introduce a global route helper and refactor all request/draft links: deferred as follow-up optimization, not required for this scope.
  - Hardcode scoped links inside base components: rejected to avoid breaking global route consumers.

## Decision 3: Enforce route-derived read-only community context in create forms
- Decision: Add fixed community context props to request/draft create forms and render read-only community display when provided.
- Rationale: Meets spec requirement that communityId is derived from route and not editable in community-scoped pages.
- Alternatives considered:
  - Keep editable input with validation: rejected because spec requires read-only in scoped create routes.
  - Create separate duplicate forms for scoped pages: rejected due to code duplication.

## Decision 4: Implement mismatch guard in detail components using existing payload communityId
- Decision: Compare route `expectedCommunityId` to loaded entity communityId in RequestDetail and DraftDetail; render explicit banner + correction link on mismatch.
- Rationale: Deterministic user safety behavior without backend changes and supports auditable cross-community correction.
- Alternatives considered:
  - Force client redirect on mismatch: rejected because explicit error/context is more transparent and testable.
  - Ignore mismatch and render silently: rejected due to high UX safety risk.

## Decision 5: Disabled CTA rendering must use non-interactive controls, not Links
- Decision: ActivityPanel and OverviewHeader render disabled actions as disabled button controls with coming-soon labeling.
- Rationale: Satisfies spec FR-019/FR-016/FR-017 and prevents dead-route navigation.
- Alternatives considered:
  - Render Link with disabled styling only: rejected because link remains navigable and violates spec.

## Decision 6: Testing remains focused and route-contract centric
- Decision: Add/maintain focused tests for route existence, scoped links, read-only create community context, mismatch guard, and disabled CTA behavior.
- Rationale: Covers acceptance criteria directly with low runtime overhead and minimal unrelated suite noise.
- Alternatives considered:
  - Full e2e-only coverage: rejected as too slow and brittle for this narrow feature.
  - No route existence test: rejected because no-404 is primary feature goal.

# Feature Specification: Community Coordination Hub And Overview CTA Safety

**Feature Branch**: `006-coordination-hub-cta-fix`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "Feature: Community Coordination Hub (Requests + Drafts, community-scoped) + Fix Overview CTAs (no 404)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Community Coordination Navigation Works End-To-End (Priority: P1)

As a community user, when I navigate from the Community Overview into Coordination, I need Requests and Drafts destinations to exist and load so I can continue work without hitting dead links.

**Why this priority**: Eliminating 404 navigation from primary overview actions is the core business outcome for this feature.

**Independent Test**: Open a valid community Overview, click Requests and Drafts CTAs, and confirm each route resolves to a real community-scoped page with expected header and body content.

**Acceptance Scenarios**:

1. **Given** a valid community, **When** the user opens `/communities/[communityId]/coordination`, **Then** the page shows a community top bar, indexer health badge, and two section cards for Requests and Drafts with working community-scoped CTAs.
2. **Given** a valid community, **When** the user clicks `Create request`, `View all requests`, `Create draft`, or `View all drafts`, **Then** navigation resolves to existing community-scoped routes and does not return 404.
3. **Given** the user is on the coordination hub, **When** they use the back link, **Then** they return to `/communities/[communityId]`.

---

### User Story 2 - Requests And Drafts Flows Stay Community-Scoped (Priority: P1)

As a community coordinator, I need list, create, and detail flows for Requests and Drafts to stay bound to the route community so that work is created and reviewed in the correct community context.

**Why this priority**: Incorrect scoping can create cross-community confusion and invalid actions.

**Independent Test**: Run list, create, and detail navigation for both Requests and Drafts under one community route and verify links, form behavior, and success redirects stay in the same community scope.

**Acceptance Scenarios**:

1. **Given** `/communities/[communityId]/coordination/requests`, **When** list rows render, **Then** each row links only to `/communities/[communityId]/coordination/requests/[requestId]`.
2. **Given** `/communities/[communityId]/coordination/requests/new`, **When** the form is shown, **Then** community is displayed as read-only route-derived context and is not user-editable.
3. **Given** request creation succeeds, **When** completion feedback is shown, **Then** user is redirected to `/communities/[communityId]/coordination/requests` with success messaging.
4. **Given** `/communities/[communityId]/coordination/drafts`, **When** list rows render, **Then** each row links only to `/communities/[communityId]/coordination/drafts/[draftId]`.
5. **Given** `/communities/[communityId]/coordination/drafts/new`, **When** the form is shown, **Then** community is displayed as read-only route-derived context and request reference is required and validated as a positive integer.
6. **Given** draft creation succeeds, **When** completion feedback is shown, **Then** user is redirected to `/communities/[communityId]/coordination/drafts` with success messaging.

---

### User Story 3 - Detail Pages Enforce Mismatch Safety (Priority: P2)

As a reviewer, when I open a request or draft detail route, I need clear mismatch protection if the loaded entity belongs to another community so I do not act in the wrong context.

**Why this priority**: Community mismatch is a high-risk UX error that can lead to incorrect moderation or drafting actions.

**Independent Test**: Load details where entity community differs from route community and verify explicit mismatch banner and link to correct community-scoped route.

**Acceptance Scenarios**:

1. **Given** a request detail route where loaded request community differs from route community, **When** page loads, **Then** an error banner identifies both communities and provides a link to the correct route.
2. **Given** a draft detail route where loaded draft community differs from route community, **When** page loads, **Then** an error banner identifies both communities and provides a link to the correct route.
3. **Given** request detail shows related drafts, **When** user opens a related draft, **Then** navigation uses a community-scoped draft detail route.
4. **Given** draft detail includes a related request link, **When** user opens it, **Then** navigation uses a community-scoped request detail route.

---

### User Story 4 - Overview CTAs Avoid Dead Navigation (Priority: P1)

As a community manager on Overview, I need all CTAs to either navigate to implemented community pages or remain visibly disabled so I never hit a missing route.

**Why this priority**: Overview is a primary launch surface and dead links degrade trust immediately.

**Independent Test**: Validate all Overview Requests, Drafts, Proposals, and Parameters actions for enabled/disabled behavior and navigation outcomes.

**Acceptance Scenarios**:

1. **Given** Requests panel CTAs on Overview, **When** user clicks `View all` or `Create new`, **Then** they navigate to implemented community-scoped Requests routes.
2. **Given** Drafts panel CTAs on Overview, **When** user clicks `View all` or `Create new`, **Then** they navigate to implemented community-scoped Drafts routes.
3. **Given** Proposals panel CTAs on Overview, **When** user views or clicks those controls, **Then** controls render disabled as `Coming soon` and do not navigate.
4. **Given** Parameters actions in Overview header, **When** user views `View parameters`, **Then** it renders disabled as `Coming soon` and does not navigate.
5. **Given** `Edit parameters` is unavailable for the user, **When** control is rendered, **Then** it remains disabled and non-navigable.

### Edge Cases

- Route `communityId` is valid syntax but does not resolve to a known community: coordination, requests, and drafts pages show unavailable state without redirecting to global routes.
- Requests list is empty: list page shows existing empty state and keeps `Create request` available.
- Drafts list is empty: list page shows existing empty state and keeps `Create draft` available.
- Request or draft detail not found: existing error handling renders without fallback to global request or draft routes.
- Entity community mismatch on detail pages: banner appears with clear correction link and no implicit context switching.
- Indexer lag during successful create: success message includes that appearance may be delayed.
- Any disabled CTA or action remains non-navigable and is not rendered as an active internal link.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST implement the community-scoped coordination hub route at `/communities/[communityId]/coordination`.
- **FR-002**: The coordination hub page MUST display a community top bar with community identity, indexer health state, and a `Back to Overview` navigation target at `/communities/[communityId]`.
- **FR-003**: The coordination hub page MUST display exactly two section cards of equal visual importance: `Requests` and `Drafts`, each with required title, subtitle, primary CTA, and secondary CTA using community-scoped targets.
- **FR-004**: The system MUST implement Requests routes at `/communities/[communityId]/coordination/requests`, `/communities/[communityId]/coordination/requests/new`, and `/communities/[communityId]/coordination/requests/[requestId]`.
- **FR-005**: Requests list rows MUST link only to community-scoped request detail routes and MUST NOT link to global `/requests/[id]`.
- **FR-006**: Request creation flow MUST derive community from route context, present it as read-only, and on success redirect to `/communities/[communityId]/coordination/requests` with success feedback.
- **FR-007**: Request detail page MUST include request identity/status/community context, community-scoped breadcrumb navigation, and reuse existing request body/comments/drafts experience.
- **FR-008**: Request detail page MUST enforce mismatch guard behavior when loaded request community differs from route community by showing explicit error text and a correction link to the proper community-scoped route.
- **FR-009**: The system MUST implement Drafts routes at `/communities/[communityId]/coordination/drafts`, `/communities/[communityId]/coordination/drafts/new`, and `/communities/[communityId]/coordination/drafts/[draftId]`.
- **FR-010**: Drafts list rows MUST link only to community-scoped draft detail routes and MUST NOT link to global `/drafts/[id]`.
- **FR-011**: Draft creation flow MUST derive community from route context, present it as read-only, require a positive integer request reference, and on success redirect to `/communities/[communityId]/coordination/drafts` with success feedback.
- **FR-012**: Draft detail page MUST enforce mismatch guard behavior when loaded draft community differs from route community by showing explicit error text and a correction link to the proper community-scoped route.
- **FR-013**: Community Overview `Coordination` tab MUST be enabled and MUST navigate to `/communities/[communityId]/coordination`.
- **FR-014**: Community Overview Requests panel CTAs MUST be enabled and route to `/communities/[communityId]/coordination/requests` and `/communities/[communityId]/coordination/requests/new`.
- **FR-015**: Community Overview Drafts panel CTAs MUST be enabled and route to `/communities/[communityId]/coordination/drafts` and `/communities/[communityId]/coordination/drafts/new`.
- **FR-016**: Community Overview Proposals panel CTAs MUST render disabled with `Coming soon`, MUST NOT render active internal links, and MUST NOT navigate.
- **FR-017**: Community Overview `View parameters` action MUST render disabled with `Coming soon`, MUST NOT render an active internal link, and MUST NOT navigate.
- **FR-018**: Community Overview `Edit parameters` action MUST remain permission-gated; when disabled it MUST be non-navigable.
- **FR-019**: CTA rendering logic for both activity panel CTAs and overview header action CTAs MUST support disabled states where controls are non-navigable and MUST NOT render as active internal Next Links. Disabled CTAs MUST render as non-interactive controls (e.g., a disabled button) and MUST NOT be implemented as a Next Link with styling.
- **FR-020**: No page delivered by this feature MAY present global `/requests` or `/drafts` navigation as primary path from community-scoped coordination pages.
- **FR-021**: This feature MUST NOT introduce governance pages, parameters pages, or other out-of-scope section pages in place of disabled controls.

## Routing Contract (single source of truth)

The only valid routes introduced by this feature are the ones listed below; do not introduce alternative paths.

- `/communities/[communityId]/coordination`
- `/communities/[communityId]/coordination/requests`
- `/communities/[communityId]/coordination/requests/new`
- `/communities/[communityId]/coordination/requests/[requestId]`
- `/communities/[communityId]/coordination/drafts`
- `/communities/[communityId]/coordination/drafts/new`
- `/communities/[communityId]/coordination/drafts/[draftId]`

### Monorepo Impact Requirements *(mandatory)*

- **MR-001**: Contracts impact is read-only for this feature; no protocol behavior, authority, or economic mechanics are changed.
- **MR-002**: Indexer impact is limited to existing list/detail/health consumption needed to render Requests and Drafts coordination pages and honest lag messaging.
- **MR-003**: Manager app impact includes new community-scoped coordination routes, scoped link generation, mismatch guards, and disabled CTA rendering behavior to prevent 404 navigation.
- **MR-004**: Test coverage MUST include route existence, community-scoped link targets, create-form route-community binding, mismatch guards, and overview CTA enabled/disabled behavior.
- **MR-005**: Documentation updates MUST preserve Shift terminology and record status changes in synchronized project-management status files when implementation state changes.

### Compatibility And Migration Requirements *(mandatory when applicable)*

- **CM-001**: No breaking contract, ABI, or event changes are introduced by this feature.
- **CM-002**: No mandatory indexer replay or consumer migration is required; any test fixture updates are additive and internal to app validation.
- **CM-003**: Existing global requests and drafts routes remain outside this feature scope and are not removed by this specification.

### Documentation And Terminology Requirements *(mandatory)*

- **DT-001**: Specification and implementation notes MUST use canonical Shift terms: Requests, Drafts, Proposals, Engagements, ValuableActionSBT, VPS, Governor, Timelock.
- **DT-002**: If implementation state or risk posture changes, `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` MUST be updated together.
- **DT-003**: `docs/EN` updates are required only if this feature changes user-visible navigation behavior descriptions; protocol architecture docs are updated only when protocol behavior changes.

### Key Entities *(include if feature involves data)*

- **CoordinationHubViewState**: Community-scoped top-bar and card action state for Requests and Drafts.
- **CommunityScopedRequestListItem**: Request row data plus community-scoped detail destination.
- **CommunityScopedDraftListItem**: Draft row data plus community-scoped detail destination.
- **CreateFlowContext**: Route-derived community context and post-success destination for create forms.
- **MismatchGuardState**: Detail-page validation state when loaded entity community differs from route community, including correction route.
- **OverviewActionState**: CTA rendering state with enabled or disabled-and-coming-soon behavior and non-navigation guarantee.

### Assumptions

- Existing Request and Draft components can be reused with scoped route builders and context props rather than introducing new protocol APIs.
- Existing create flows already publish content and submit transactions; this feature only constrains route-scoped community selection and success navigation.
- Existing indexer and chain data are sufficient for current list/detail rendering without schema redesign.
- Out-of-scope sections remain intentionally unavailable and represented through disabled controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of required new community-scoped coordination routes resolve without 404 in route existence tests.
- **SC-002**: 100% of Requests and Drafts Overview CTAs navigate to implemented community-scoped destinations in link behavior tests.
- **SC-003**: 100% of Proposals and `View parameters` Overview CTAs render disabled and do not navigate in interaction tests.
- **SC-004**: 100% of Requests and Drafts list-row links generated under coordination routes point to community-scoped detail routes (0 global `/requests/[id]` or `/drafts/[id]` links from scoped lists).
- **SC-005**: 100% of create-flow tests confirm community context is route-derived and non-editable, with success redirect staying inside the same community scope.
- **SC-006**: 100% of mismatch test cases for request and draft detail pages show explicit mismatch messaging and correction navigation.

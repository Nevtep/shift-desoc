# Data Model: 006 Coordination Hub CTA Fix

## 1. CoordinationHubViewState
- Purpose: Drives `/communities/[communityId]/coordination` top section and two navigation cards.
- Fields:
  - `communityId: number` (route-derived, positive integer)
  - `communityLabel: string` (`Community #<id>` fallback or display name)
  - `indexerHealth: 'synced' | 'lagging' | 'error' | 'unknown'`
  - `backToOverviewHref: string`
  - `requestCard: { createHref: string; viewAllHref: string }`
  - `draftCard: { createHref: string; viewAllHref: string }`
- Validation:
  - All internal hrefs must stay under `/communities/[communityId]/...`.

## 2. CommunityScopedListLinkConfig
- Purpose: Makes list rows route to scoped detail pages without breaking existing global pages.
- Fields:
  - `communityId: string`
  - `detailHrefBuilder: (entity) => string`
- Applied to:
  - Request list rows
  - Draft list rows
- Validation:
  - Produced href must match routing contract patterns.

## 3. CreateFlowContext
- Purpose: Enforces route-derived community in create forms.
- Fields:
  - `fixedCommunityId?: number`
  - `successRedirectHref?: string`
  - `isFixedCommunity: boolean` (derived)
- Validation:
  - If `fixedCommunityId` exists and `> 0`, community input is not editable and displays read-only label.
  - On success, redirect to scoped list route when `successRedirectHref` is provided.

## 4. MismatchGuardState
- Purpose: Prevents silent cross-community confusion in detail routes.
- Fields:
  - `expectedCommunityId?: number` (route context)
  - `entityCommunityId: number | null` (payload)
  - `hasMismatch: boolean`
  - `correctionHref: string | null`
- Transitions:
  - `hasMismatch = false`: normal detail rendering.
  - `hasMismatch = true`: banner + correction link rendered.
- Validation:
  - Banner text must include both entity and route community values.

## 5. OverviewActionState (existing, reinforced)
- Purpose: Controls CTA rendering for Overview header and activity panels.
- Fields:
  - `href: string`
  - `enabled: boolean`
  - `comingSoon?: boolean`
- Rendering rules:
  - `enabled=true`: render interactive Link.
  - `enabled=false`: render disabled non-interactive control (button), never Link.

## 6. RoutingContractRecord
- Purpose: Canonical list of valid routes introduced by this feature.
- Values:
  - `/communities/[communityId]/coordination`
  - `/communities/[communityId]/coordination/requests`
  - `/communities/[communityId]/coordination/requests/new`
  - `/communities/[communityId]/coordination/requests/[requestId]`
  - `/communities/[communityId]/coordination/drafts`
  - `/communities/[communityId]/coordination/drafts/new`
  - `/communities/[communityId]/coordination/drafts/[draftId]`

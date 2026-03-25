# Data Model: Community Overview Dashboard

## Entity: CommunityOverviewHeader
- Purpose: Top-level identity and operational context for one community.
- Fields:
  - `communityId` (number, required, > 0)
  - `displayName` (string, required; fallback `Community #<communityId>`)
  - `network` (string, required)
  - `environment` (string, required)
  - `indexerHealth` (enum: `synced|lagging|error|unknown`, required)
  - `canViewParameters` (boolean, required)
  - `canEditParameters` (boolean, required)
  - `lastCheckedAt` (ISO timestamp, required)
- Validation:
  - `communityId` must come from route param only.
  - `canEditParameters=true` only when authority check passes.

## Entity: ModulePointerSummaryItem
- Purpose: Community module wiring visibility from canonical registry.
- Fields:
  - `moduleKey` (enum, required): `governor|timelock|requestHub|draftsManager|engagementsManager|valuableActionRegistry|verifierPowerToken|verifierElection|verifierManager|valuableActionSBT|treasuryAdapter|communityToken|paramController`
  - `address` (hex string or null)
  - `status` (enum: `present|missing`, required)
  - `hasCode` (boolean, required)
  - `source` (enum: `on-chain verified|unavailable`, required)
- Validation:
  - `missing` when address is zero/null OR bytecode is empty.

## Entity: ParameterSummaryItem
- Purpose: Deterministic overview subset from spec mapping table.
- Fields:
  - `id` (enum, required):
    - `governance.debateWindow`
    - `governance.votingWindow`
    - `governance.executionDelay`
    - `eligibility.proposalThreshold`
    - `economics.revenueSplit.workersBps`
    - `economics.revenueSplit.treasuryBps`
    - `economics.revenueSplit.investorsBps`
    - `verifier.panelSize`
    - `verifier.minimumApprovals`
  - `rawValue` (number|string|null)
  - `displayValue` (string, required)
  - `unit` (enum: `seconds|bps|integer threshold`, required)
  - `source` (enum: `on-chain verified|unavailable`, required)
  - `lastCheckedAt` (ISO timestamp, required)
- Validation:
  - If chain read fails or value invalid: `displayValue=unavailable`, `source=unavailable`.

## Entity: ActivityPreviewItem
- Purpose: Compact, trustworthy preview row for activity sections.
- Fields:
  - `domain` (enum: `requests|drafts|proposals`, required)
  - `id` (string, required)
  - `titleOrIdentifier` (string, required)
  - `status` (string, required)
  - `timestamp` (ISO timestamp, required)
  - `href` (community-scoped route string, optional)
- Validation:
  - Per panel max 3 newest rows.
  - Must be filtered by route `communityId`.

## Entity: ActivityPanelState
- Purpose: User-facing panel status for each preview panel.
- Fields:
  - `domain` (enum, required)
  - `state` (enum: `loading|ready|empty|error|lagging`, required)
  - `items` (array<ActivityPreviewItem>, required)
  - `canRetry` (boolean, required)
  - `viewAllHref` (string, required)
  - `createHref` (string, required)
- Validation:
  - `viewAllHref` and `createHref` must match routing contract exactly.

## Entity: SectionTabState
- Purpose: Community overview tab/navigation model.
- Fields:
  - `key` (enum: `overview|coordination|governance|verification|economy|commerce`, required)
  - `label` (string, required)
  - `href` (string, required)
  - `enabled` (boolean, required)
  - `comingSoon` (boolean, required)
- Validation:
  - All six tabs always visible.
  - Disabled tabs show `Coming soon`.

## Relationships
- `CommunityOverviewHeader` 1-to-many `ModulePointerSummaryItem`.
- `CommunityOverviewHeader` 1-to-many `ParameterSummaryItem`.
- `CommunityOverviewHeader` 1-to-many `ActivityPanelState`.
- `ActivityPanelState` 1-to-many `ActivityPreviewItem`.
- `CommunityOverviewHeader` 1-to-many `SectionTabState`.

## State Transitions
- Indexer health state:
  - `unknown -> synced|error`
  - `synced -> lagging|error`
  - `lagging -> synced|error`
  - `error -> synced|unknown` (after retry/recovery)
- Activity panel state:
  - `loading -> ready|empty|error|lagging`
  - `error -> loading` (retry)
  - `lagging -> ready|error`

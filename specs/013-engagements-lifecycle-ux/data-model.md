# Data Model: Engagements Rich Lifecycle UX

## Entity: CommunityEngagementRecord

Purpose: Canonical community-scoped engagement submission created by successful on-chain submit transaction.

Fields:
- id (string, required): Composite projection key communityId:engagementId.
- communityId (number, required): Community boundary key.
- engagementId (number, required): Canonical on-chain engagement identity.
- valuableActionId (number, required): Linked Valuable Action ID used at submit.
- participant (address string, required): Submitter.
- evidenceCid (string, required): Evidence payload CID used in submit.
- status (enum, required): Pending, Approved, Rejected, Revoked.
- submittedAt (timestamp, required): Block timestamp of EngagementSubmitted.
- resolvedAt (timestamp, optional): Set when resolved or revoked.
- verifyDeadline (timestamp, optional): When available from chain read/projection.

Validation rules:
- communityId must match active community context for list/detail/create operations.
- valuableActionId must be active for community at submit time.
- evidenceCid must be present before submit.
- No engagement record is created in UI state until tx confirmation and identity recovery succeed.

State transitions:
- None -> Pending on successful EngagementSubmitted.
- Pending -> Approved or Rejected on EngagementResolved.
- Approved -> Revoked on EngagementRevoked.

## Entity: ActiveValuableActionOption

Purpose: Community-scoped selectable Valuable Action input for Engagement create flow.

Fields:
- communityId (number, required)
- actionId (number, required)
- isActive (boolean, required)
- titleTemplate (string, optional)
- evidenceSpecCid (string, optional)
- metadataSchemaId (string, optional)

Validation rules:
- Option is selectable only if isActive is true and communityId matches selected community.
- If no active options exist, submit action is disabled.

State transitions:
- Active/inactive transitions follow ValuableAction lifecycle events; create form reacts to latest state.

## Entity: EvidencePayloadDraft

Purpose: Structured user input assembled from Valuable Action evidence spec before upload and submit.

Fields:
- communityId (number, required)
- valuableActionId (number, required)
- evidenceSpecCid (string, optional)
- sections (array, required): Structured evidence fields derived from spec.
- attachments (array, optional): Evidence links or references.
- summary (string, optional)
- uploadStatus (enum, required): idle, uploading, uploaded, failed.
- uploadedCid (string, optional): Canonical CID for submit call.

Validation rules:
- All required fields from selected evidence spec must pass before submit.
- uploadedCid is required before on-chain submit transaction is triggered.
- Draft is ephemeral UI state and not treated as engagement persistence.

State transitions:
- idle -> uploading -> uploaded
- uploading -> failed
- uploaded -> editing (if user modifies fields requiring re-upload)

## Entity: SubmitTransactionState

Purpose: Deterministic state machine for engagement submit UX.

Fields:
- state (enum, required):
  - draft
  - payload_ready
  - awaiting_wallet
  - hash_received
  - confirmed_identity_resolved
  - confirmed_identity_pending
  - failed_wallet
  - failed_chain
  - failed_revert
  - failed_payload
- txHash (string, optional)
- blockNumber (number, optional)
- errorCode (string, optional)
- errorMessage (string, optional)
- engagementId (number, optional)

Validation rules:
- engagementId can be set only after receipt decode of EngagementSubmitted.
- failed states must never set engagementId unless chain decode confirmed it.

State transitions:
- draft -> payload_ready
- payload_ready -> awaiting_wallet
- awaiting_wallet -> hash_received | failed_wallet | failed_chain
- hash_received -> confirmed_identity_resolved | confirmed_identity_pending | failed_revert
- confirmed_identity_pending -> confirmed_identity_resolved | failed_revert

## Entity: EngagementReadinessState

Purpose: Distinguish canonical chain-confirmed status from projection freshness.

Fields:
- status (enum, required): healthy, lagging, unavailable
- indexedBlock (number, optional)
- chainHeadBlock (number, optional)
- blockLag (number, optional)
- details (string, optional)

Validation rules:
- If lagging/unavailable, UI must show warning and avoid claiming complete projection data.
- Readiness does not alter canonical submit success state.

State transitions:
- healthy <-> lagging
- lagging -> unavailable (degraded)
- unavailable -> lagging -> healthy (recovery)

## Relationships

- CommunityEngagementRecord many-to-one ActiveValuableActionOption by valuableActionId + communityId.
- CommunityEngagementRecord one-to-many JurorAssignment projection records (existing schema path).
- SubmitTransactionState one-to-one with user submission session.
- EngagementReadinessState one-to-one with current community engagement list/detail view.

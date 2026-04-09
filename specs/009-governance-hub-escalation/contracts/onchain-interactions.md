# On-Chain Interaction Contract (Read/Write)

## Read Interactions (community governor module)

- `state(uint256 proposalId) -> uint8`
  - Used only when readiness is stale or missing in indexer fields.
- `proposalEta(uint256 proposalId) -> uint256`
  - Used for executable timing hint.
- `proposalNeedsQueuing(uint256 proposalId) -> bool`
  - Used to determine queued vs executable flow.
- `getMultiChoiceTotals(uint256 proposalId) -> uint256[]`
  - Optional tally fallback if indexer tallies unavailable.
- `getVoterMultiChoiceWeights(uint256 proposalId, address voter) -> uint256[]`
  - Optional current-voter allocation snapshot.

## Vote Write Interaction

- Contract: community governor module resolved via `CommunityRegistry.getCommunityModules(communityId)`.
- Method: `castVoteMultiChoice(uint256 proposalId, uint256[] weights, string reason)`
- Payload rule: `sum(weights) == 10_000` (bps model for this feature).

## Draft Escalation Write Interaction

- Contract: community draftsManager module resolved via `CommunityRegistry.getCommunityModules(communityId)`.
- Method: `escalateToProposal(uint256 draftId, bool multiChoice, uint8 numOptions, string description)`

## Receipt Event Parsing Contract

- Event signature:
  - `ProposalEscalated(uint256 indexed draftId, uint256 indexed proposalId, bool isMultiChoice, uint8 numOptions)`
- Parse source: tx receipt logs emitted by the resolved DraftsManager address.
- Navigation contract:
  - If `proposalId` parsed: navigate to `/communities/{communityId}/governance/proposals/{proposalId}`
  - Else: navigate to `/communities/{communityId}/governance/proposals` and show indexing-lag notice.

## Explicit Non-Goals

- No direct timelock execute/queue semantics changes.
- No contract ABI/event modifications.
- No indexer schema/projection changes.

# Phase 1 Data Model: Governance Hub (Community-scoped)

## Entity: GovernanceHubView

- Purpose: Header and navigation state for `/communities/[communityId]/governance`.
- Fields:
  - communityId: number (route param, required, `> 0`)
  - indexerHealth: `synced | lagging | error | unknown`
  - proposalsHref: string (`/communities/{communityId}/governance/proposals`)
  - overviewHref: string (`/communities/{communityId}`)

## Entity: CommunityProposalSummary

- Purpose: Proposal row on community proposals list.
- Fields:
  - proposalId: string (indexer entity id)
  - communityId: number
  - proposer: address string
  - state: enum-like string (Pending, Active, Succeeded, Defeated, Queued, Executed, Unknown)
  - createdAt: ISO timestamp
  - queuedAt: ISO timestamp | null
  - executedAt: ISO timestamp | null
- Validation rules:
  - Must satisfy route-scope predicate: `summary.communityId === routeCommunityId`.

## Entity: CommunityProposalDetail

- Purpose: Full proposal view model for detail page.
- Fields:
  - proposalId: string
  - communityId: number
  - proposer: address string
  - descriptionCid: string | null
  - descriptionHash: hex string | null
  - targets: address[] | null
  - values: numeric-string[] | null
  - calldatas: hex[] | null
  - multiChoiceOptions: string[]
  - votes: ProposalVoteRecord[]
  - state: string
  - createdAt: ISO timestamp
  - queuedAt: ISO timestamp | null
  - executedAt: ISO timestamp | null
  - readiness: ProposalReadiness
- Validation rules:
  - Mismatch guard triggers when `detail.communityId !== routeCommunityId`.

## Entity: ProposalReadiness

- Purpose: Queue/execute readiness for proposal detail.
- Fields:
  - source: `indexer | chain-fallback`
  - queued: boolean
  - executableNow: boolean
  - executed: boolean
  - eta: bigint | null
  - staleReason: `none | indexer-lag | missing-readiness-fields`
- Derivation:
  - indexer-first from state + queuedAt + executedAt
  - fallback via governor read methods when stale criteria met

## Entity: WeightedVoteDraft

- Purpose: Client-side weighted vote payload before tx.
- Fields:
  - proposalId: bigint
  - optionBps: number[] (integers)
  - totalBps: number
  - reason: string
  - submitEnabled: boolean
- Validation rules:
  - each allocation is integer `0..10000`
  - `sum(optionBps) === 10000` required for submit
  - UI rendering shows each as `(bps / 100).toFixed(2)%`

## Entity: VoterVoteSnapshot

- Purpose: Existing connected-wallet vote display.
- Fields:
  - voter: address
  - source: `indexer-votes | chain-view`
  - optionBps: number[]
  - castAt: ISO timestamp | null
- Derivation:
  - prefer indexer vote records when available
  - optional chain read via `getVoterMultiChoiceWeights(proposalId, voter)`

## Entity: DraftEscalationInput

- Purpose: Draft-to-proposal form payload.
- Fields:
  - draftId: bigint
  - description: string (CID or markdown-derived CID)
  - multiChoice: boolean (default true)
  - numOptions: number (default 2)
- Validation rules:
  - wallet connected
  - correct chain
  - draft belongs to route community
  - action bundle present and non-empty (`targets/values/calldatas/actionsHash`)
  - if `multiChoice === true`, `numOptions >= 2`

## Entity: EscalationOutcome

- Purpose: Navigation/result state after escalation tx.
- Fields:
  - txHash: hex string
  - proposalId: string | null
  - parsedFromLogs: boolean
  - redirectTo: string
  - lagNotice: string | null
- Transition rules:
  1. `idle -> pending` on submit
  2. `pending -> success-with-proposal` when `ProposalEscalated` log parsed
  3. `pending -> success-fallback` when tx succeeds but proposalId unresolved
  4. `pending -> error` on rejection/revert/network failure

## Entity: OverviewProposalPanelCtas

- Purpose: Activity panel CTA state for proposals card on community overview.
- Fields:
  - viewAll: { href, enabled }
  - createNew: { href, enabled }
  - parameters: { href, enabled }
- Rules:
  - `viewAll.enabled = true`
  - `createNew.enabled = false`
  - parameters CTA remains disabled

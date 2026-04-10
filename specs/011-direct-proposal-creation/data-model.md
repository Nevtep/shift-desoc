# Data Model: Direct Proposal Creation

## Entity: DirectProposalIntent
- Description: Immutable, pre-submit intent built from composer output and governance context.
- Fields:
  - communityId: number (> 0)
  - governorAddress: `0x` address
  - mode: enum(`binary`, `multi_choice`)
  - targets: address[]
  - values: bigint[]
  - calldatas: hex[]
  - description: string (CID or markdown-derived pointer payload already used by governance flow)
  - numOptions: number | null (required when mode = `multi_choice`)
  - createdAt: ISO timestamp
- Validation:
  - `targets.length === values.length === calldatas.length`
  - all targets/functions pass allowlist checks
  - community-governor mapping is exact at submission time
  - mode-specific constraints (`numOptions >= 2` for multi-choice)

## Entity: CommunityGovernorContext
- Description: Runtime-resolved governance wiring used for submit gating.
- Fields:
  - communityId: number
  - chainId: number
  - governorAddress: address | null
  - timelockAddress: address | null
  - isChainSupported: boolean
  - isContextValid: boolean
  - mismatchReason: enum(`none`, `invalid_community`, `governor_missing`, `chain_mismatch`, `context_stale`)
- Validation:
  - submit is blocked unless `isContextValid = true`

## Entity: ProposalSubmitTransactionState
- Description: Client-side transaction lifecycle model for direct proposal submission.
- Fields:
  - status: enum(`idle`, `validating`, `awaiting_wallet`, `submitted`, `confirming`, `confirmed`, `failed`)
  - txHash: string | null
  - errorType: enum(`none`, `wallet_rejected`, `revert`, `context_mismatch`, `allowlist_violation`, `unknown`)
  - errorMessage: string | null
  - startedAt: ISO timestamp | null
  - updatedAt: ISO timestamp | null
- State transitions:
  - `idle -> validating -> awaiting_wallet -> submitted -> confirming -> confirmed`
  - failure edges to `failed` from any pre-confirmation step
  - `failed -> idle` only by explicit user retry/reset

## Entity: ProposalCreationResult
- Description: Normalized output after tx confirmation and proposalId recovery.
- Fields:
  - success: boolean
  - txHash: string
  - proposalId: string | null
  - recoverySource: enum(`event_log`, `deterministic_read`, `unresolved`)
  - communityId: number
  - governorAddress: address
  - confirmedAt: ISO timestamp
- Validation:
  - `success = true` requires confirmed tx hash
  - unresolved `proposalId` is valid only with fallback routing state

## Entity: ProposalRoutingState
- Description: Post-submit routing decision for detail-first with lag-safe fallback.
- Fields:
  - destination: enum(`proposal_detail`, `proposal_list_fallback`)
  - href: string
  - proposalId: string | null
  - txHash: string
  - indexLagHint: boolean
  - userMessage: string
- Validation:
  - `proposal_detail` requires `proposalId`
  - `proposal_list_fallback` must retain `txHash` and success context
  - href must be community-scoped (`/communities/[communityId]/...`)

## Entity: ProposalSubmitErrorState
- Description: User-facing recoverable error model for failed submissions.
- Fields:
  - type: enum(`wallet_rejected`, `revert`, `context_mismatch`, `allowlist_violation`, `network_mismatch`, `unknown`)
  - message: string
  - actionableHint: string
  - preservesComposerState: boolean
- Validation:
  - `preservesComposerState` is always true for wallet rejection/revert/context mismatch

## Entity: ProposalCreateCtaState
- Description: Community overview CTA capability state for proposal creation.
- Fields:
  - href: string
  - enabled: boolean
  - comingSoon: boolean
  - disableReason: string | null
- Validation:
  - enabled only when create route/capability is implemented and community scoped

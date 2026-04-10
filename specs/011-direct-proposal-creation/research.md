# Research: Direct Proposal Creation

## Decision 1: Submit directly to `ShiftGovernor` using existing composer payload
- Decision: Use the existing action bundle output (`targets`, `values`, `calldatas`, `description`) and submit with `propose` for binary proposals and `proposeMultiChoice` for multi-choice proposals.
- Rationale: Matches deployed governor surface and avoids DraftsManager escalation dependency while preserving current composer constraints.
- Alternatives considered:
  - Route all submissions through `DraftsManager.escalateToProposal`: rejected because feature requirement explicitly removes this dependency for direct creation.
  - Introduce a new contract helper wrapper: rejected because no protocol blocker is currently identified.

## Decision 2: Keep one canonical composer implementation
- Decision: Reuse guided/expert composer logic already used by draft creation; do not introduce a second, divergent proposal composer.
- Rationale: Prevents allowlist drift and enforces identical safety/validation behavior across draft and direct-governor paths.
- Alternatives considered:
  - Build a proposal-only composer: rejected due to duplicated validation and long-term parity risk.

## Decision 3: Enforce exact community-to-governor context before wallet prompt
- Decision: Block submission preflight if selected `communityId`, resolved governor module address, connected chain, or allowlist state are mismatched.
- Rationale: Satisfies fail-closed governance constraints and avoids unsafe prompts for invalid context.
- Alternatives considered:
  - Attempt write then rely on revert: rejected because UX and safety requirements require pre-submit blocking.

## Decision 4: Recover `proposalId` with deterministic priority order
- Decision: Proposal ID recovery order is:
  1. Decode governor events from transaction receipt (`ProposalCreated` / `MultiChoiceProposalCreated`).
  2. Deterministic read fallback via `getProposalId`/`hashProposal` inputs from submitted payload.
  3. If unresolved, keep tx hash context and route to community proposals list fallback.
- Rationale: Works under indexer delay and removes dependence on one event shape.
- Alternatives considered:
  - Indexer lookup only: rejected because immediate post-submit can race projection lag.
  - Event-only parse: rejected because provider/log decoding edge cases can still occur.

## Decision 5: Navigation fallback must be community-scoped and non-destructive
- Decision: On successful write but unresolved detail, navigate to `/communities/[communityId]/governance/proposals` with lag/success context and no automatic resubmit.
- Rationale: Maintains confidence and prevents duplicate proposals while indexer catches up.
- Alternatives considered:
  - Keep user on form with ambiguous success: rejected due to poor discoverability.
  - Retry writes automatically: rejected because it risks duplicate on-chain proposals.

## Decision 6: Duplicate submit prevention uses pending lock and stable intent state
- Decision: Disable submit while tx is pending/broadcasting, keep composer state during reject/revert, and require explicit user action for retries.
- Rationale: Meets FR-010/FR-011 and avoids accidental duplicate governance writes.
- Alternatives considered:
  - Optimistic reset on submit: rejected because state loss harms recoverability after failures.

## Decision 7: Preserve DraftsManager escalation as-is
- Decision: Do not alter `draft-detail` escalation behavior or routes; treat it as an independent, still-supported path.
- Rationale: Backward compatibility requirement CM-001 and no protocol reason to remove draft flow.
- Alternatives considered:
  - Replace escalation with direct proposal path: rejected as out of scope.

## Decision 8: Contracts and indexer remain unchanged unless hard blocker emerges
- Decision: No contract source or indexer schema changes in initial implementation scope.
- Rationale: Feature can be implemented in Manager with current deployed interfaces and read models.
- Alternatives considered:
  - Add source-type partitioning in indexer: rejected because existing proposal list/detail should stay source-agnostic.

## Decision 9: Community overview create CTA should activate with route readiness
- Decision: Enable community proposals `create` CTA once community-scoped `/governance/proposals/new` route is live.
- Rationale: Route already exists in allowlist tests as contract; enabling it aligns UX with implemented capability.
- Alternatives considered:
  - Keep CTA disabled despite implementation: rejected due to discoverability gap.

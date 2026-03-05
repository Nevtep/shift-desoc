# Phase 0 Research - Canonicalize Engagements Surface

## In-Scope Canonicalization Map (Work Verification)
- `apps/web/app/claims/**` route surface is deprecated for canonical naming and must become compatibility-only.
- `apps/web/app/engagements/**` is canonical route surface for list/detail flows.
- `apps/web/components/claims/**` copy and query usage are in scope for Engagements wording and canonical integration names.
- `apps/web/lib/contracts.ts` is in scope for canonical `engagements` contract key + `Engagements.json` ABI wiring.
- `apps/web/lib/graphql/queries.ts` is in scope for canonical Engagements query/type exports (with temporary aliases if needed).
- `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` must be updated in the same change set.

## Explicit Exclusion List (Economic Claims)
- Economic payout/claim semantics remain claim terminology and are excluded from Engagements renaming.
- Any revenue, withdrawal, payout, or investor claim context remains `claim/claims` unless it is a misclassified work-verification surface.

## Decision 1: Canonical term for work verification is `Engagements` everywhere in active Manager surfaces
- Decision: Rename active user-facing and integration-facing work-verification surfaces from `Claims` to `Engagements`.
- Rationale: Constitution and `neuromancer/SHIFT_SYSTEM.md` define Engagements as canonical work-verification language; current Manager drift causes incorrect mental model and integration assumptions.
- Alternatives considered:
  - Keep mixed labels and only fix docs: rejected because drift remains in UX and integration wiring.
  - Keep `Claims` as primary UI term: rejected because it contradicts protocol canon.

## Decision 2: Use staged compatibility for routes (`/claims` -> `/engagements`) instead of hard break
- Decision: Introduce canonical `/engagements` routes and keep temporary redirects/aliases for `/claims` until migration window closes.
- Rationale: Preserves existing bookmarks and links while moving users and tests to canonical routes.
- Alternatives considered:
  - Immediate route replacement with no compatibility: rejected due to unnecessary navigation breakage risk.
  - Permanent dual routes: rejected because it preserves terminology ambiguity.

## Decision 3: Canonicalize contract wiring key to `engagements` in Manager contract map
- Decision: Replace `claims` contract key/import assumptions in Manager with `engagements`, using `Engagements.json` ABI and `deployments/*.json` `addresses.engagements` key.
- Rationale: `apps/web/abis` already ships `Engagements.json`; deployments use `engagements` as source of truth in active files.
- Alternatives considered:
  - Add duplicated `claims` and `engagements` keys long-term: rejected due to drift and ambiguity.
  - Keep `claims` key but map internally: rejected because it keeps deprecated naming in integration surface.

## Decision 4: Canonicalize GraphQL query/type naming in Manager with migration-safe aliases
- Decision: Rename GraphQL query constants/types from Claim* to Engagement* while preserving compatibility where needed through temporary exported aliases in one release window.
- Rationale: Improves code clarity and aligns read/write paths to canonical domain without requiring all call-sites to break at once.
- Alternatives considered:
  - Leave query/type symbols unchanged: rejected because code-level drift remains.
  - Full hard rename in one pass with no aliases: higher churn risk for tests/components.

## Decision 5: Do not alter indexer database table names in this slice
- Decision: Keep current indexer storage schema (`engagements` table already canonical) and avoid schema migrations not required for terminology correction.
- Rationale: Scope is canonicalization and drift removal, not storage redesign.
- Alternatives considered:
  - Schema-level renaming/migration: unnecessary risk and out of scope.

## Decision 6: Keep economic claim semantics untouched and explicit
- Decision: Any references to claim/payout semantics in economic context remain as claims terminology; only work-verification claim naming is replaced with Engagements.
- Rationale: Required domain separation from constitution and feature spec.
- Alternatives considered:
  - Global find/replace from claim->engagement: rejected due to semantic corruption risk.

## Decision 7: Update status artifacts in same change set
- Decision: Update both `.github/project-management/IMPLEMENTATION_STATUS.md` and `.github/project-management/STATUS_REVIEW.md` with canonicalization progress and reduced drift notes.
- Rationale: Constitution v1.1.0 synchronization mandate.
- Alternatives considered:
  - Update only implementation status: rejected by governance rule.

## Verification Scope Markers
- Authority drift checks are mandatory: this feature must not introduce new privileged paths or shadow-authority behavior.
- Grep validation must scan only in-scope work-verification surfaces and preserve economic claim contexts.

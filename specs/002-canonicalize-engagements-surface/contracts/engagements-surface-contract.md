# Contracts - Engagements Surface Compatibility Contract

## Scope
This contract defines compatibility expectations for canonicalizing the Manager work-verification surface from deprecated `Claims` naming to canonical `Engagements` naming.

## Canonical Surface
- Canonical domain name: `Engagements`
- Canonical deployment key: `engagements`
- Canonical ABI: `apps/web/abis/Engagements.json`
- Canonical route family: `/engagements`, `/engagements/[engagementId]`

## Compatibility Requirements
1. Route compatibility
- Legacy `/claims` routes may exist temporarily as redirects/wrappers to canonical `/engagements` routes.
- Navigation and labels must prefer canonical Engagements naming.
- Sunset condition: legacy `/claims` compatibility can be removed only after internal links, tests, and docs no longer depend on legacy paths in a release cycle.

2. Code symbol compatibility
- Canonical symbols should be Engagement-based (e.g., `EngagementList`, `EngagementQuery`).
- Temporary aliases may exist for one release window to avoid breaking imports/tests, but deprecated names must not remain primary.

3. Integration compatibility
- Manager contract configuration must read deployment addresses via `addresses.engagements`.
- No active import should require `Claims.json` for work verification.
- Deployment checks must be validated against active `deployments/*.json` manifests (no hardcoded addresses).

4. Semantic boundary
- Economic claiming semantics remain `claim/claims` and are excluded from this canonicalization unless misused for work verification.

## Non-Goals
- No protocol contract logic changes.
- No indexer schema migrations unrelated to terminology canonicalization.
- No expansion into marketplace, treasury, verifier-election, or community-management capability work.

## Definition of Done Gates
- All in-scope work-verification UX labels/routes use Engagements canonical language.
- Contract wiring for work verification resolves through `engagements` deployment key.
- Manager read/write flows continue functioning.
- Tests updated for canonical naming and compatibility coverage.
- Status artifacts synchronized in same change set.

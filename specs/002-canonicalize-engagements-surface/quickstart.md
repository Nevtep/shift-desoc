# Quickstart - Canonicalize Engagements Surface

## Objective
Validate that work-verification surfaces are canonicalized to Engagements while preserving behavior and economic claim semantics.

## 1. Prepare
```bash
cd /Users/core/Code/shift
pnpm install
```

## 2. Confirm deployment + ABI assumptions
```bash
for f in deployments/*.json; do echo "== $f"; jq '.addresses.engagements' "$f"; done
ls apps/web/abis/Engagements.json
```
Expected:
- Deployment key `engagements` exists in active manifests
- `Engagements.json` exists

## 2.1 Define terminology baseline scan (do not enforce final gate yet)
```bash
rg -n "Claim|Claims" apps/web/app apps/web/components apps/web/lib/contracts.ts apps/web/lib/graphql/queries.ts
rg -n "claim|claims" apps/web/app/marketplace apps/web/lib/ipfs/schemas.ts
```
Expected:
- First scan returns only legacy compatibility references planned for migration.
- Second scan confirms economic claim contexts remain explicitly preserved.

## 3. Run focused web tests
```bash
pnpm --filter @shift/web test:unit
```
Expected:
- Engagements list/detail/submit/review tests pass
- Route compatibility tests for legacy `/claims` behavior pass if compatibility window is active

## 4. Run indexer and contract-facing sanity checks
```bash
pnpm --filter @shift/indexer build
pnpm forge:test
```
Expected:
- No integration break from terminology canonicalization

## 5. Manual UX smoke test
1. Open home/navigation and confirm canonical `Engagements` wording.
2. Visit `/engagements` and verify list renders.
3. Submit engagement and verify transaction path still works.
4. Verify juror review action still works.
5. Visit legacy `/claims` route (if still supported) and confirm redirect/wrapper behavior.
6. Confirm economic claim language (if present) remains in economic context only.

## 6. Documentation sync check
- Update and verify both:
  - `.github/project-management/IMPLEMENTATION_STATUS.md`
  - `.github/project-management/STATUS_REVIEW.md`

## 6.1 Authority drift validation
```bash
rg -n "onlyOwner|owner\(|setAuthority|grantRole|revokeRole" apps/web apps/indexer
```
Expected:
- No new privileged authority paths are introduced by this feature.
- No app/indexer shadow-authority behavior is added.

## 6.2 Documentation consistency checklist
- Confirm paired updates landed in:
  - `.github/project-management/IMPLEMENTATION_STATUS.md`
  - `.github/project-management/STATUS_REVIEW.md`
- Confirm terminology boundary remains explicit:
  - Work verification uses `Engagements`
  - Economic payout contexts retain `claim/claims`

## 7. Final quality gate
```bash
pnpm forge:test
pnpm --filter @shift/web test:unit
pnpm --filter @shift/indexer build
rg -n "Claim|Claims" apps/web/app apps/web/components apps/web/lib/contracts.ts apps/web/lib/graphql/queries.ts
```

## Validation run log (2026-03-05)

- `pnpm --filter @shift/indexer build`: PASS
- `pnpm --filter @shift/web test:unit`: FAIL (pre-existing unrelated import error in `tests/unit/components/draft-create-form.test.tsx` -> missing `../../lib/actions/registry`)
- Targeted web slice tests: PASS
  - `pnpm --filter @shift/web exec vitest run components/claims/claim-list.test.tsx components/claims/claim-detail.test.tsx tests/unit/components/claim-submit-form.test.tsx tests/unit/routes/claims-compatibility.test.tsx lib/contracts.test.ts lib/graphql/queries.test.ts`
- `pnpm forge:test`: FAIL (pre-existing Foundry compiler cache parsing error: `invalid type: sequence, expected a map at line 40 column 19`)

Deprecated-term scan result:
- `rg -n "Claim|Claims" apps/web/app apps/web/components apps/web/lib/contracts.ts apps/web/lib/graphql/queries.ts`
- Result limited to temporary compatibility wrappers/aliases and file/component identifiers (`apps/web/app/claims/**`, `ClaimsQuery`/`ClaimQuery` aliases, `components/claims/**` paths), with canonical user-facing route/copy switched to Engagements.

Semantic-boundary scan result:
- `rg -n "claim|claims" apps/web/app/marketplace apps/web/lib/ipfs/schemas.ts`
- Result preserved in non-route schema fields (`claimEvidence`, `claimId`) and not expanded into work-verification UI labeling.

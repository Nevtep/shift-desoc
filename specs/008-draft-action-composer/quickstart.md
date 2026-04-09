# Quickstart: Implementing 008 Draft Action Composer

## Preconditions
- Branch: `008-draft-action-composer`
- Source of truth:
  - `specs/008-draft-action-composer/spec.md`
  - `specs/008-draft-action-composer/requirements.md`
- Do not change contracts or indexer.

## Implementation Steps

1. Add allowlist runtime files
- Create `apps/web/lib/actions/allowlists/base-sepolia-v1.json`.
- Add loader/validator utility in `apps/web/lib/actions/allowlist.ts`.
- Enforce single profile v1.

2. Add generator script (FR-004A)
- Add `scripts/generate-draft-composer-allowlist.ts`.
- Parse canonical `selectorRoleAssignments` in `apps/web/lib/deploy/factory-step-executor.ts`.
- Select `ADMIN_ROLE` signatures only.
- Resolve `target -> contract ABI`, verify signature exists.
- Emit stable sorted JSON and metadata report.
- Run: `pnpm generate:composer-allowlist` from repo root whenever selector wiring or composer-safe signature policies change.

3. Refactor action registry into composable modules
- Extend `ActionTargetId` and target definitions to required scope.
- Replace mutable-function heuristics with allowlist-based signature filtering.
- Keep targets visible; compute disabled reason for missing module/no signatures.

4. Guided template catalog
- Move to schema-driven templates in `apps/web/lib/actions/guided-templates.ts`.
- Implement v1 template groups required by spec.
- Templates use exact ABI-verified signatures from the committed allowlist; no overload-selection logic is performed.
- Enforce disabled-if-not-allowlisted and disabled-if-module-missing.

5. Update `DraftCreateForm`
- Use new target availability state.
- Expert mode: target dropdown shows disabled reasons; action list from allowlist only.
- Guided mode: SAFE-only templates and deterministic encoding.
- Keep queue visible and deterministic hash behavior.

6. Tests
- Add allowlist gating tests in `apps/web/tests/unit/lib/actions/allowlist.test.ts`.
- Add guided snapshot tests in `apps/web/tests/unit/lib/actions/guided-templates.test.ts`.
- Add hash determinism tests in `apps/web/tests/unit/lib/actions/bundle-hash.test.ts`.
- Extend component tests for disabled-state behaviors and zero allowlisted functions.

7. Docs
- Update composer docs in `docs/EN/Flows.md` and/or governance UI docs.
- Document explicit exclusions and allowlist regeneration workflow.

## Verification Commands
- `pnpm --filter @shift/web vitest run tests/unit/components/draft-create-form.test.tsx`
- `pnpm --filter @shift/web vitest run tests/unit/lib/actions/*.test.ts`
- `pnpm --filter @shift/web test:unit`

## Done Criteria
- Guided mode is SAFE-only and excludes non-governance actions.
- Expert mode only exposes allowlisted signatures.
- Targets with missing module/no signatures are visible but disabled with reason.
- Hash determinism and guided encoding snapshots pass.
- Allowlist generation script produces deterministic, ABI-validated output.

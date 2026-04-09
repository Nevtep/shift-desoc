# Specification Quality Checklist: Governance Hub (Community-scoped) + Draft to Proposal Escalation

**Purpose**: Validate specification completeness and quality before proceeding to planning  
**Created**: 2026-04-09  
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validation iteration 1 passed all checklist items.
- Scope remains limited to `apps/web` UX/routing/tests with no protocol or indexer model changes.
- Validation iteration 2 completed after implementation.
- Targeted acceptance run passed:
	- `pnpm --filter @shift/web exec vitest run tests/unit/routes/community-governance-routes-exist.test.ts tests/unit/routes/community-governance-hub-page.test.tsx tests/unit/components/governance/proposal-list.test.tsx tests/unit/components/governance/proposal-detail.test.tsx tests/unit/components/drafts/draft-detail.test.tsx tests/unit/community-overview/activity-proposals-enabled.test.tsx tests/unit/routes/community-routing-allowlist.test.ts tests/unit/community-overview/unimplemented-cta-guard.test.tsx`
- Full web unit suite passed:
	- `pnpm --filter @shift/web test:unit`
- Scope guard passed:
	- `git diff --name-only -- contracts apps/indexer` returned no paths.
- Docs alignment check performed for `neuromancer/SHIFT_SYSTEM.md` and `contracts/FEATURES.md`; no updates required for this web-only feature.
- Governance workflow/status deltas did not require synchronized updates to `.github/project-management/IMPLEMENTATION_STATUS.md` or `.github/project-management/STATUS_REVIEW.md`.

## Requirement-to-Test Traceability

| Requirement | Coverage Tasks | Test Targets |
|-------------|----------------|--------------|
| FR-001 | T010, T014, T015, T016 | `apps/web/tests/unit/routes/community-governance-routes-exist.test.ts` |
| FR-002 | T011, T014 | `apps/web/tests/unit/routes/community-governance-hub-page.test.tsx` |
| FR-003 | T012, T017, T018 | `apps/web/components/governance/proposal-list.test.tsx` |
| FR-004 | T012, T018 | `apps/web/components/governance/proposal-list.test.tsx` |
| FR-005 | T049, T005, T018, T019 | `apps/web/components/governance/proposal-list.test.tsx`, `apps/web/components/governance/proposal-detail.test.tsx` |
| FR-006 | T029, T033, T034 | `apps/web/components/governance/proposal-detail.test.tsx` |
| FR-006a | T031, T036 | `apps/web/components/governance/proposal-detail.test.tsx` |
| FR-006b | T030, T035 | `apps/web/components/governance/proposal-detail.test.tsx` |
| FR-007 | T032, T037, T038 | `apps/web/components/governance/proposal-detail.test.tsx` |
| FR-008 | T013, T019 | `apps/web/components/governance/proposal-detail.test.tsx` |
| FR-009 | T020, T023, T028 | `apps/web/components/drafts/draft-detail.test.tsx` |
| FR-010 | T020, T024 | `apps/web/components/drafts/draft-detail.test.tsx` |
| FR-011 | T023, T024 | `apps/web/components/drafts/draft-detail.test.tsx` |
| FR-012 | T025 | `apps/web/components/drafts/draft-detail.test.tsx` |
| FR-013 | T021, T022, T026, T027 | `apps/web/components/drafts/draft-detail.test.tsx` |
| FR-014 | T039, T041, T042 | `apps/web/tests/unit/community-overview/activity-proposals-enabled.test.tsx` |
| FR-015 | T040, T043 | `apps/web/tests/unit/routes/community-routing-allowlist.test.ts`, `apps/web/tests/unit/community-overview/unimplemented-cta-guard.test.tsx` |
| FR-016 | T010-T013, T020-T022, T029-T032, T039-T040, T049 | Full unit suite for routes/governance/drafts/overview |
| SC-001 | T010, T014-T016 | Route module tests |
| SC-002 | T012, T017, T018 | Proposal list scoping tests |
| SC-003 | T013, T019 | Proposal detail mismatch tests |
| SC-004 | T021, T022, T026, T027 | Escalation navigation outcome tests |
| SC-005 | T039, T041, T042, T043 | Overview CTA behavior tests |
| SC-006 | T045 | Repo diff guard check |

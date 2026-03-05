# Security Closeout Checklist: 001-security-fixes

**Purpose**: Validate that security-audit closeout requirements are complete, clear, consistent, and measurable for final reviewer signoff.
**Created**: 2026-03-04
**Feature**: `/Users/core/Code/shift/specs/001-security-fixes/spec.md`

**Note**: This checklist evaluates requirement quality and closure criteria definition, not implementation behavior.

## Requirement Completeness

- [ ] CHK001 Are closeout requirements explicitly defined for all CRITICAL/HIGH/MEDIUM findings from the audit summary, including ownership of residual risk? [Completeness, Spec SC-001]
- [ ] CHK002 Does the spec define an explicit closure condition for the remaining unresolved manipulation-risk item (juror entropy), rather than implying completion from partial hardening? [Completeness, Spec Finding 10, Spec FR-010]
- [ ] CHK003 Are documentation-closeout requirements for architecture/whitepaper/features updates stated as mandatory release criteria, not optional follow-up? [Completeness, Spec FR-015, Spec FR-016]
- [ ] CHK004 Are operational safeguard requirements for accepted design-awareness items (D-1, D-2) defined with owners, alert thresholds, and response SLAs? [Completeness, Spec Finding 14, Spec Finding 15]
- [ ] CHK005 Is evidence packaging for closeout (test proofs, governance authorization proofs, migration proof, ABI sync proof) explicitly required in requirements? [Gap]

## Requirement Clarity

- [ ] CHK006 Is "materially biased" in juror-selection hardening defined with measurable criteria (for example statistical threshold and sampling method)? [Clarity, Spec FR-010, Ambiguity]
- [ ] CHK007 Is "deterministic settlement without trapped escrow" defined with precise outcome rules for unsupported-token paths? [Clarity, Spec FR-009]
- [ ] CHK008 Are "terminal state" expectations for expired engagements unambiguous about status value, side effects, and slot release semantics? [Clarity, Spec FR-004]
- [ ] CHK009 Are "liability-preserving invariants" for emergency withdrawal written with exact inequality constraints and accepted edge conditions? [Clarity, Spec FR-002]
- [ ] CHK010 Is the intended authority path for privileged mutation written with concrete actor terms (Governor/Timelock/AccessManager roles) rather than generic "governance" wording? [Clarity, Spec FR-008, Assumption]

## Requirement Consistency

- [ ] CHK011 Do closeout requirements align with the severity ordering in the finding map (Immediate, Before mainnet, Hardening, Ops) without conflicting priorities? [Consistency, Spec Finding Mapping]
- [ ] CHK012 Are success criteria and functional requirements consistent about whether all medium findings must be fully fixed versus mitigated with documented residual risk? [Consistency, Spec SC-001, Spec FR-010]
- [ ] CHK013 Do requirements for timelock-only privilege boundaries stay consistent with project invariants in docs and plan artifacts? [Consistency, Spec FR-008, Plan Constitution Check]
- [ ] CHK014 Are requirements for unsupported router-token settlement consistent between fund safety goals and marketplace behavior narratives? [Consistency, Spec FR-009, Spec Finding 9]

## Acceptance Criteria Quality

- [ ] CHK015 Can each closeout acceptance scenario be objectively evaluated from artifacts, with pass/fail criteria that do not require subjective interpretation? [Measurability, Spec User Stories]
- [ ] CHK016 Are acceptance criteria for M-1 explicitly defined as either "fully resolved" or "accepted residual risk," with a required rationale and signoff authority? [Acceptance Criteria, Spec Finding 10, Gap]
- [ ] CHK017 Are non-functional hardening requirements tied to quantitative thresholds (gas bounds, max stay bounds, entropy/fairness bounds) rather than qualitative terms? [Measurability, Spec FR-010, Spec FR-011, Spec FR-013]
- [ ] CHK018 Is there a requirement that every closed finding includes direct trace links to tests and changed contracts for auditability? [Traceability, Gap]

## Scenario Coverage

- [ ] CHK019 Do closeout requirements cover primary, alternate, and exception scenarios for each fund-moving path (withdrawal, settlement, bounty payout)? [Coverage, Spec User Story 1]
- [ ] CHK020 Do closeout requirements include recovery scenarios for partial rollout failures (for example migration/wiring mismatch or stale ABI consumers)? [Coverage, Recovery Flow, Gap]
- [ ] CHK021 Are governance-execution timing scenarios covered (queued proposal, delayed execution, role change during delay) for privileged mutation checks? [Coverage, Spec User Story 3]

## Edge Case Coverage

- [ ] CHK022 Are day-boundary and timestamp-edge requirements fully defined for rate limiting and engagement expiry boundaries? [Edge Case, Spec Finding 7, Spec Finding 4]
- [ ] CHK023 Are low-population verifier edge cases defined for juror-selection fairness requirements (small N, repeated same-block attempts)? [Edge Case, Spec Finding 10]
- [ ] CHK024 Are maximum-boundary requirements documented for housing nights and high-history engagement submissions with explicit reject behavior? [Edge Case, Spec Finding 11, Spec Finding 13]

## Dependencies And Assumptions

- [ ] CHK025 Are external dependency assumptions (oracle/randomness source, token behavior, router availability, indexer monitoring) explicitly listed and validated for closeout signoff? [Dependency, Spec Assumptions]
- [ ] CHK026 Does the spec define what evidence is required when a dependency cannot be validated pre-mainnet, including temporary compensating controls? [Dependency, Gap]

## Ambiguities And Conflicts

- [ ] CHK027 Is it explicitly resolved whether "improved entropy" is sufficient for closure, or whether VRF/commit-reveal is required before declaring the finding closed? [Ambiguity, Spec Finding 10, Conflict]
- [ ] CHK028 Are there any remaining conflicts between closeout requirements and current status claims in audit/report artifacts that must be reconciled before final signoff? [Conflict, Assumption]

## Notes

- Check items off as completed: `[x]`
- Add evidence links next to each completed item.
- Use this checklist as a reviewer gate for requirements readiness and audit closeout documentation quality.

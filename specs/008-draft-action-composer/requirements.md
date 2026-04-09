# Requirements Extract: 008 Draft Action Composer

This file is a planning-friendly extraction of normative requirements from `spec.md`.
If conflicts occur, `spec.md` is authoritative.

## Core Constraints
- Guided mode is SAFE-only templates.
- Expert mode is Timelock-allowlist-only (explicit allowlist, no heuristics).
- Allowlist authority: ADMIN_ROLE signatures from canonical wiring that end under Timelock after handoff.
- v1 uses exactly one canonical allowlist profile (Base Sepolia staging).
- `actionsHash = keccak256(encodePacked(targets, values, calldatas))` in strict queue order.
- Guided overload behavior: always community-scoped overload when available.

## Functional Focus
- Expand targets across governance/verification/economic/commerce list in spec.
- Keep targets visible; disable with reason when missing module or no allowlisted functions.
- Guided templates must be disabled if function not currently allowlisted.
- Explicitly exclude non-governance actions (request moderation, draft contributor/version ops, escalation flow).

## Test Requirements
- Allowlist gating tests.
- Guided encoding snapshot tests (all v1 templates).
- Deterministic hash tests (ordered equality, reorder inequality).
- Disabled-state availability tests.

## Scope Boundary
- No contract changes.
- No indexer changes.
- No proposal execution mechanics changes.
- No multi-network allowlist profiles in v1.

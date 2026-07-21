# Shift Manager Product Roadmap (Linear Review Order)

This document is the review companion for the current Shift Linear backlog. Use it to walk the issues in the same order the work should move: first the planning anchors, then the implementation-ready chain, then the spec-first queue. It is intentionally aligned with [IMPLEMENTATION_STATUS](../../.github/project-management/IMPLEMENTATION_STATUS.md), and the issue IDs are written exactly as they appear in Linear so you can follow along directly. Update this roadmap whenever backlog priority or execution order changes there.

## Current Status

The Manager already has usable coordination and governance-adjacent slices, plus the recent Valuable Action admin vertical slice. The main remaining delivery gaps are:

- authority-mode truth across deploy, handoff, and capability signaling
- ParamController read and mutation flows for admin-managed and governance-managed communities
- verifier, credential, position, and engagement admin surfaces
- economic and commerce read models and Manager surfaces
- explicit cleanup of contract-level TODOs that would otherwise make the product backlog look more complete than it really is

## How To Read The Linear Backlog

| Workflow label | Meaning in practice | How to review it |
|---|---|---|
| `workflow:backlog` | umbrella or planning parent | read first for scope, then inspect children |
| `workflow:agent-ready` | concrete implementation-ready slice | candidate for immediate execution |
| `workflow:needs-spec` | real work item, but still needs gentle SDD | do not implement before spec/design/tasks |

## Review Anchors

Review these parent issues first so the child issues below make sense in Linear.

| Anchor | Purpose |
|---|---|
| `SHI-9` | phase 0 source-of-truth cleanup for Admin Tool delivery |
| `SHI-15` | ParamController backlog split across read foundation, admin-managed writes, and governance-managed proposal flow |
| `SHI-18` | verifier roster, VPT, and juror/admin coverage umbrella |
| `SHI-22` | credential, position, and typed SBT visibility umbrella |
| `SHI-23` | TreasuryAdapter and CommunityToken umbrella |
| `SHI-20` | economic read-model and Manager surface umbrella |
| `SHI-24` | commerce read-model and Manager surface umbrella |

## Recommended Implementation Order

This section is the practical delivery order for issues that are already concrete enough to review and execute. Where Linear does not yet encode the full dependency chain, the rationale column does.

| Order | Issue | Why this comes now | Review notes |
|---|---|---|---|
| 1 | `SHI-12` | authority-mode contract must be settled before downstream deploy and handoff UX is trustworthy | `needs-spec`; establishes the Base Sepolia staging contract |
| 2 | `SHI-13` | deploy wizard cannot truthfully branch until `SHI-12` defines the lifecycle | `needs-spec`; review with deploy flow and wizard runtime |
| 3 | `SHI-26` | deploy verification must prove the selected authority mode, not assume handoff | `needs-spec`; depends conceptually on `SHI-12` and `SHI-13` |
| 4 | `SHI-14` | truthful gating should land as soon as the authority story is defined | `agent-ready`; docs/runtime truthfulness slice |
| 5 | `SHI-53` | capability-flag metadata supports honest availability states across the Manager | `agent-ready`; engineering cleanup under `SHI-9` |
| 6 | `SHI-16` | community overview is the operator entrypoint and should reflect the settled module/role/parameter truth | `agent-ready`; best reviewed after `SHI-14` and `SHI-53` |
| 7 | `SHI-48` | ParamController read model is the foundation for both admin-managed and governance-managed parameter UX | `agent-ready`; treat as a hard prerequisite for `SHI-50` and `SHI-49` |
| 8 | `SHI-50` | admin-managed parameter writes are the first real staging mutation flow after read truth exists | `agent-ready`; blocked by `SHI-48` |
| 9 | `SHI-17` | community-scoped governance proposal creation must be solid before governance-managed parameter flows rely on it | `agent-ready`; governance route parity slice |
| 10 | `SHI-21` | governance-managed handoff evidence should be visible before governance-only controls are positioned as ready | `agent-ready`; complements `SHI-17` |
| 11 | `SHI-49` | governance-managed ParamController proposal UX should come only after read truth, proposal creation, and handoff verification are in place | `agent-ready`; explicitly blocked by `SHI-48`, and practically follows `SHI-17` plus `SHI-21` |
| 12 | `SHI-27` | Valuable Action admin is already farthest along, so this is the first Phase 3 tightening slice | `agent-ready`; closes truth/operability gaps rather than opening a new area |
| 13 | `SHI-19` | engagement lifecycle is the next verification surface that already has meaningful Manager coverage to extend | `agent-ready`; keep chain-vs-projection truth explicit |
| 14 | `SHI-34` | verifier read-model foundation should land before roster and juror UI surfaces | `agent-ready`; first child under `SHI-18` |
| 15 | `SHI-32` | verifier roster and VPT UI depends on the read foundation | `agent-ready`; follows `SHI-34` |
| 16 | `SHI-33` | juror selection and fraud visibility should follow once verifier/VPT data is stable | `agent-ready`; follows `SHI-34`, benefits from `SHI-32` |
| 17 | `SHI-29` | credential/position/SBT projection layer is the read foundation for the remaining typed-record surfaces | `agent-ready`; first child under `SHI-22` |
| 18 | `SHI-28` | credential admin/read surface depends on the new projections | `agent-ready`; follows `SHI-29` |
| 19 | `SHI-31` | position admin/read surface depends on the same projection layer | `agent-ready`; follows `SHI-29` |
| 20 | `SHI-30` | typed SBT visibility should come after the underlying credential/position records are readable | `agent-ready`; follows `SHI-29`, benefits from `SHI-28` and `SHI-31` |
| 21 | `SHI-54` | engagement revocation side effects must be closed before verification flows are treated as complete | `agent-ready`; engineering cleanup for Phase 3 stability |
| 22 | `SHI-45` | treasury and CommunityToken read foundations should land before any economic operator surface tries to act on them | `agent-ready`; first child under `SHI-23` |
| 23 | `SHI-46` | TreasuryAdapter preview/policy UX builds directly on the read foundation | `agent-ready`; follows `SHI-45` |
| 24 | `SHI-47` | CommunityToken reserve and treasury UX also builds on the same foundation | `agent-ready`; follows `SHI-45` |
| 25 | `SHI-51` | CommerceDisputes juror-integration cleanup should land before dispute UI is treated as a stable target | `agent-ready`; Phase 5 engineering cleanup |

## Spec-First Queue

These issues are real backlog, but they should be reviewed as a spec queue rather than treated as immediate implementation tickets.

### Group 1: Authority-Mode And Deploy Contract

| Priority | Issue | Why it needs spec first |
|---|---|---|
| 1 | `SHI-12` | defines the product contract for admin-managed versus governance-managed communities |
| 2 | `SHI-13` | changes wizard flow and user-facing deployment branches |
| 3 | `SHI-26` | changes what deployment verification must prove |

### Group 2: Economic Read Models And Manager Surfaces

Review `SHI-20` first, then the child sequence below.

| Priority | Issue | Why this order matters |
|---|---|---|
| 1 | `SHI-20` | umbrella defining the economic slice boundary |
| 2 | `SHI-40` | projections first; everything else depends on truthful cohort/investment/revenue data |
| 3 | `SHI-41` | readiness and capability visibility should describe the projected reality |
| 4 | `SHI-42` | cohort admin/read surface depends on `SHI-40` |
| 5 | `SHI-43` | investment issuance and participant visibility depends on `SHI-40` and benefits from `SHI-42` |
| 6 | `SHI-44` | revenue and pull-claim visibility should come after the underlying economic state is projected |

### Group 3: Commerce Read Models And Manager Surfaces

Review `SHI-24` first, then the child sequence below.

| Priority | Issue | Why this order matters |
|---|---|---|
| 1 | `SHI-24` | umbrella defining the commerce slice boundary |
| 2 | `SHI-38` | read models first; marketplace, housing, disputes, and projects all depend on them |
| 3 | `SHI-39` | marketplace is the broadest commerce operator surface and anchors linked module behavior |
| 4 | `SHI-35` | dispute UI should not move ahead of the settled commerce projection story; pair review with `SHI-51` |
| 5 | `SHI-36` | housing depends on marketplace-linked operational context |
| 6 | `SHI-37` | project shells are the lightest commerce-side slice and can safely follow the heavier flows |

## Development Logic Behind This Order

The roadmap is intentionally shaped around four rules:

1. settle source-of-truth and authority-mode behavior before adding more UI
2. land read foundations before write or operator surfaces
3. finish the already-nearby verification slices before opening the large economic and commerce fronts
4. keep engineering cleanup visible, because several product areas look more complete than they are until those TODOs are closed

## Quick Review Path

If you want the fastest pass through Linear without losing the development logic, read issues in this order:

1. `SHI-9`, `SHI-15`, `SHI-18`, `SHI-22`, `SHI-23`, `SHI-20`, `SHI-24`
2. `SHI-12`, `SHI-13`, `SHI-26`, `SHI-14`, `SHI-53`, `SHI-16`
3. `SHI-48`, `SHI-50`, `SHI-17`, `SHI-21`, `SHI-49`
4. `SHI-27`, `SHI-19`, `SHI-34`, `SHI-32`, `SHI-33`, `SHI-29`, `SHI-28`, `SHI-31`, `SHI-30`, `SHI-54`
5. `SHI-45`, `SHI-46`, `SHI-47`
6. `SHI-20` with `SHI-40` to `SHI-44`, then `SHI-24` with `SHI-38`, `SHI-39`, `SHI-35`, `SHI-36`, `SHI-37`

Completed on 2026-07-20: `SHI-52` moved out of the active implementation queue after the verifier-power helper cleanup merged.

## Sync Note

Keep this document synchronized with [IMPLEMENTATION_STATUS](../../.github/project-management/IMPLEMENTATION_STATUS.md). If a child issue changes status, a blocker changes, or a new cleanup issue changes the recommended order, update both the roadmap narrative here and the tactical backlog framing in the implementation-status document in the same change set.

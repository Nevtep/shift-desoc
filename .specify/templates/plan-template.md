# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Protocol infrastructure first: Confirm protocol primitives stay generic and
  vertical-specific behavior is pushed to app layers unless truly shared.
- Contract-first authority: Confirm no indexer/app shadow-authority path for
  permissions or state transitions.
- Security/invariant preservation: Enumerate affected invariants and privileged
  mutation paths (Governor/Timelock/AccessManager).
- Event/indexer discipline: List event/ABI changes, replay or migration impact,
  reorg handling, and indexer health implications.
- Monorepo vertical-slice scope: Document required updates across contracts,
  indexer, Manager app, downstream integration surface, tests, and docs.
- Compatibility discipline: Identify breaking interface/event risks and required
  migration/versioning strategy for downstream dApps.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Provide the real monorepo layout touched by this feature.
  Include all affected layers (contracts, indexer, app, docs, scripts/tests).
  Do not provide generic single-project placeholders.
-->

```text
contracts/
test/
apps/indexer/
apps/web/
docs/
scripts/
deployments/
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Monorepo Impact Matrix

| Layer | Impacted? | Paths | Contract / Event / API Compatibility Notes |
|-------|-----------|-------|--------------------------------------------|
| Protocol Contracts | [Yes/No] | [paths] | [notes] |
| Indexer (Ponder) | [Yes/No] | [paths] | [notes] |
| Manager App (Next.js) | [Yes/No] | [paths] | [notes] |
| Downstream dApp Surface | [Yes/No] | [interfaces/events] | [notes] |
| Documentation | [Yes/No] | [paths] | [notes] |

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |

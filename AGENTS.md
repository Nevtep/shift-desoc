# Shift Agent Workflow

This repository uses **gentle SDD** as the active workflow for new work.

## Workflow Authority

Source-of-truth hierarchy for planning and delivery:

1. Smart contract behavior and emitted events
2. `/docs/EN/**` and active repo guidance in `.github/copilot-instructions.md`
3. This file
4. Selected Linear issues refined through gentle SDD artifacts and execution
5. Historical specs and legacy SpecKit materials as reference only

## Active Planning Workflow

- Linear is the backlog and prioritization system.
- Selected Linear issues are refined through gentle SDD before implementation.
- Engram stores durable project memory, testing capabilities, SDD init state, and lessons.
- Agents must recover Engram context before planning or editing.
- New work should follow gentle SDD rather than repo-local SpecKit flows.
- SpecKit artifacts in `.specify/`, `.github/prompts/speckit.*`, `.github/agents/speckit.*`, and related playbooks are legacy/reference only unless a task explicitly requires historical context.

## Strict TDD And Validation

Strict TDD is active.

Known validation map:

- Contracts: `pnpm forge:test`, `pnpm forge:cov`, `pnpm cov:gate`
- Web unit: `pnpm --filter @shift/web test:unit`
- Web e2e scaffold: `pnpm --filter @shift/web test:e2e`
- Indexer unit: `pnpm --filter @shift/indexer run test:unit`
- Indexer integration: `pnpm --filter @shift/indexer run test:integration`
- Indexer compatibility: `pnpm --filter @shift/indexer run check:events`, `pnpm --filter @shift/indexer run check:compat`

Agents must choose the narrowest validating command for the surface they change and run it before widening scope.

## Safety Rules

- Preserve governance and treasury invariants: Timelock authority, ParamController as policy source, no verifier staking/bonding, TreasuryAdapter guardrails, and separation of commerce disputes from work verification.
- Preserve current Shift terminology and keep contracts, indexer projections, Manager UX, tests, and docs synchronized when behavior changes.
- Do not bypass contract authority with indexer or app-side shadow logic.
- Do not edit application code, contracts, indexer mappings, or deploy flows without recovering current Engram context first.
- Treat the Manager app and indexer as derived operational layers over canonical on-chain behavior.
- Never commit secrets, private keys, or hardcoded deployment addresses.

## Legacy Policy

SpecKit is no longer the active workflow for new work in this repository.
Legacy SpecKit files remain for historical and technical reference, and may still help explain prior specs, but they must not be treated as the default operating path for new planning or implementation.
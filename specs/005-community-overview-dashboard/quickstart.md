# Quickstart: Community Overview Dashboard

## Objective
Implement `/communities/[communityId]` as the authoritative Overview hub with strict community-scoped routing, hybrid data truth, and permission-aware actions.

## Prerequisites
- Branch: `005-community-overview-dashboard`
- Web app env configured (`apps/web/.env`) with base/indexer endpoints.
- Indexer running with GraphQL + `/api/health` endpoint.

## Implementation Steps
1. Build overview shell in `apps/web/app/communities/[communityId]/page.tsx` (or delegated container component).
2. Replace legacy query-param links with mandatory community-scoped route contract.
3. Add/compose tabs model with always-visible sections and disabled `Coming soon` behavior.
4. Use indexer queries (`RequestsQuery`, `DraftsQuery`, `ProposalsQuery`) with `communityId` + `limit=3` for previews.
5. Read module pointers from `CommunityRegistry.getCommunityModules(communityId)` via `useCommunityModules`.
6. Add bytecode presence checks for module status `present|missing`.
7. Read deterministic parameter subset from ParamController getters and map to UI rows.
8. Implement authority gating for `Edit parameters`; default disabled on uncertain permission signal.
9. Add indexer health indicator (`synced|lagging|error|unknown`) using `/api/health` + query state.
10. Add honest error/lag/empty states and retry affordances without breaking chain-backed sections.

## Validation Checklist
- Route scoping:
  - `/communities/1` and `/communities/2` show distinct IDs/data.
  - No fallback/default community leakage.
- Routing contract:
  - All panel CTAs route exactly to `/communities/[communityId]/...` targets.
  - No `?communityId=` legacy links from this screen.
- Data truth:
  - Module + parameter summaries still render when indexer errors.
  - Unresolved parameter/module values show `unavailable` or `missing`, not inferred values.
- Permission UX:
  - Unauthorized user cannot trigger `Edit parameters`.
- Tabs:
  - All 6 tabs visible; unavailable tabs disabled with `Coming soon`.

## Suggested Test Commands
- Unit/integration (web app):
  - `pnpm -C apps/web test`
- Type/lint:
  - `pnpm -C apps/web lint`
  - `pnpm -C apps/web typecheck` (if configured)

## Evidence To Capture
- Overview screenshot with header/modules/parameters/previews/tabs.
- Unauthorized screenshot showing disabled `Edit parameters`.
- Indexer-error screenshot showing preserved chain-backed sections.

## Validation Evidence (2026-03-25)
- Targeted overview query coverage:
  - `pnpm exec vitest run ./lib/graphql/queries.test.ts --reporter=verbose`
  - Result: PASS (`4/4` tests), including community-scope assertions and default `limit=3` checks for all overview preview queries.
- Targeted `useIndexerHealth` hook coverage:
  - `pnpm exec vitest run ./tests/unit/community-overview/indexer-health.test.tsx --reporter=verbose`
  - Result: PASS (`4/4` tests), covering `synced`, `lagging`, `unknown`, and `error` states at hook level.
- Full web unit suite attempt:
  - `pnpm -C apps/web test:unit`
  - Result: Unable to complete in current environment due Node heap OOM (`Reached heap limit`).
  - Impact: Feature-specific overview regressions remain validated through targeted tests above.

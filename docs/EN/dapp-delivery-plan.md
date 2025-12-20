# Shift dApp Delivery Blueprint

## Architecture Plan
- **Overview**
  - Next.js (App Router) provides the UI with Tailwind/shadcn styling and TanStack Query caching.
  - wagmi/viem handle RPC interactions for on-chain reads/writes on Base and Base Sepolia.
  - Ponder indexes contract events into Postgres and exposes the GraphQL read API.
  - A Next.js Edge proxy at `/api/ipfs/[cid]` fetches immutably cached documents from Pinata, validates schemas, and sanitizes markdown.
  - Direct RPC reads cover critical truth checks (Governor states, balances) while GraphQL supplies list/detail data.
- **Data Source Responsibilities**
  - GraphQL: communities, request/draft feeds, proposal timelines, claim states, marketplace catalog, juror assignments, disputes, profile aggregates.
  - RPC: wallet connection, membership/treasury balances, proposal state verification, casting votes, submitting claims/drafts, timelock queues, SBT balance confirmation.
  - IPFS Edge Proxy: request bodies, draft versions, claim evidence manifests (JSON/markdown); images fetched directly via Pinata CDN.

```
          +---------------------------+
          |  End Users (Wallet / UI)  |
          +-------------+-------------+
                        |
                        v
                +-------+-------+
                | Next.js (App) |
                | Tailwind/shad |
                +---+-------+---+
                    |       |
        GraphQL read|       |RPC write/read
                    v       v
           +--------+-------+---------+
           | TanStack Query / wagmi   |
           +--------------+-----------+
                          |
            +-------------+--------------+
            |        GraphQL API         |
            |   (Ponder GraphQL server)  |
            +------+------+--------------+
                   |     ^
           Postgres ingest|
                   v     |
        +----------+-----+------------+
        | Ponder Indexer (Workers)    |
        |  - ABI decoders             |
        |  - Event processors         |
        +----+------------------------+
             |
   +---------+----------+
   | Base / Base Sepolia|
   | JSON-RPC endpoints |
   +---------+----------+
             |
             v
   +---------+----------+
   | Edge IPFS Proxy    |
   | /api/ipfs/[cid]    |
   +---------+----------+
             |
             v
   +---------+----------+
   | Pinata Gateway     |
   +--------------------+
```

## Monorepo Structure
- Maintain pnpm workspace; avoid `lib/` directories to respect `.gitignore`.
- Keep contract, shared, and UI packages for type-safe imports.
- Give each app (Next.js, Ponder) its own tooling scripts to run tests/builds from the app root.

```
apps/
  web/
    app/
      layout.tsx
      page.tsx
      communities/
      requests/
      drafts/
      governance/
      claims/
      marketplace/
      profile/
      api/
        ipfs/[cid]/route.ts
    components/
    hooks/
    lib/
    styles/
    tests/
  indexer/
    ponder.config.ts
    schema/
      community.ts
      request.ts
      draft.ts
      governance.ts
      claims.ts
      marketplace.ts
    src/
      handlers/
      loaders/
    scripts/
      backfill.ts
      healthcheck.ts
packages/
  contracts/
    src/
      abis/
      deployments.ts
      types/
      clients/
  shared/
    src/
      env/
      wagmi/
      graphql/
      ipfs/
      utils/
  ui/
    src/
      components/
      hooks/
    tailwind-preset.ts
scripts/
  dev/
    start-web.ts
    start-indexer.ts
  db/
    migrate.ts
    reset.ts
  seed/
    sample-data.ts
  ops/
    check-deployments.ts
```

- ABIs and viem-generated types live in `packages/contracts/src/abis` and `packages/contracts/src/types`.
- Address loader utilities remain in `packages/contracts/src/deployments.ts`, returning typed config based on `deployments/{network}.json` or `latest.json`.

## Page & Route Map
- `/` – overview, latest activity across communities (GraphQL `communities`, `requests`).
- `/communities` – directory with filters (GraphQL `communities`).
- `/communities/[communityId]` – dashboard tying params, modules, live stats (GraphQL + RPC truth checks for governor timings).
- `/requests` – feed of RequestHub entries; create action triggers wagmi write to RequestHub.
- `/requests/[requestId]` – detail, comments, IPFS content via edge proxy.
- `/drafts` – drafts overview with status filters (GraphQL `drafts`).
- `/drafts/[draftId]` – version timeline, reviews, escalate action to `DraftsManager`.
- `/governance/proposals` – proposals list from GraphQL; indicates state by combining GraphQL with `Governor.state()` RPC.
- `/governance/proposals/[proposalId]` – voting UI with multi-choice support; uses CountingMultiChoice ABI for option metadata.
- `/claims` – active claims list (GraphQL `claims`).
- `/claims/[claimId]` – claim detail, juror assignments, evidence manifest (IPFS proxy), wagmi writes for juror decisions.
- `/marketplace` – offers + reservations aggregated (GraphQL `offers`, `reservations`).
- `/marketplace/offers/[offerId]` – offer detail (read-only MVP) with potential order CTA.
- `/housing/reservations/[reservationId]` – reservation detail (read-only MVP).
- `/profile` – wallet-specific view; GraphQL `profile` plus RPC membership balance.

**Golden Path A: Request → Draft → Proposal → Vote → Execution**
1. User creates request on `/requests` (wagmi write).
2. Draft created from request at `/requests/[id]` leading to `/drafts/[draftId]` (wagmi).
3. Draft review and escalate to proposal (wagmi call to `DraftsManager`).
4. Proposal viewed and voted at `/governance/proposals/[proposalId]`.
5. After quorum, queue/execute tracked via GraphQL events and RPC `state` checks.

**Golden Path B: Valuable Action → Claim Lifecycle**
1. Valuable action displayed on `/claims` (GraphQL `valuableActions`).
2. Claim submitted via wagmi to `Claims` contract; manifest pinned to IPFS.
3. Juror assignments surfaced from GraphQL `jurorAssignments`.
4. Jurors vote through wagmi to `VerifierManager`.
5. Resolution status and SBT mint confirmation via GraphQL + RPC `balanceOf`.

**Golden Path C: Marketplace Offer → Order/Reservation → Dispute**
1. Offers listed at `/marketplace` from GraphQL `offers`.
2. User views details (read-only) and sees order/reservation history.
3. Dispute status surfaced from GraphQL `disputes`; writes deferred until later milestone.

## Indexing & GraphQL Plan
- **Events to Index**
  - CommunityRegistry: `CommunityRegistered`, `CommunityUpdated`, `ModuleAddressSet`.
  - RequestHub: `RequestCreated`, `CommentPosted`, `RequestStatusChanged`, `RequestTagged`.
  - DraftsManager: `DraftCreated`, `ContributorAdded`, `DraftVersionSnapshotted`, `ReviewSubmitted`, `DraftEscalated`, `DraftStatusChanged`.
  - Governor/Timelock: `ProposalCreated`, `VoteCast`, `ProposalQueued`, `ProposalExecuted`, `ProposalCanceled`.
  - ValuableActionRegistry: `ValuableActionCreated`, `ValuableActionActivated`, `ValuableActionDeprecated`.
  - Claims: `ClaimSubmitted`, `EvidenceAdded`, `JurorsAssigned`, `ClaimVoteCast`, `ClaimResolved`.
  - VerifierManager: `JurorSelected`, `ThresholdMet` (or equivalent).
  - Marketplace/Housing: `OfferCreated`, `OfferUpdated`, `OrderCreated`, `ReservationCreated`, `ReservationUpdated`, `DisputeOpened`, `DisputeResolved`.

- **Postgres Entities**
  - `communities(id PK, chain_id INT, name TEXT, metadata_uri TEXT, governor_address TEXT, created_at, updated_at)` with index on `(chain_id, id)`.
  - `requests(id PK, community_id FK, author, status, cid, tags TEXT[], created_at)` with indexes on `(community_id, status)` and `(created_at DESC)`.
  - `comments(id PK, request_id FK, parent_id, author, cid, created_at)` with index `(request_id, created_at)`.
  - `drafts(id PK, request_id FK, status, escalated_proposal_id, latest_version_cid, updated_at)` with indexes `(status)` and `(request_id)`.
  - `draft_versions(id PK, draft_id FK, contributor, cid, created_at)` with index `(draft_id, created_at)`.
  - `draft_reviews(id PK, draft_id FK, reviewer, stance, comment_cid, created_at)`.
  - `proposals(id PK, community_id FK, proposer, description_cid, multi_choice_options JSONB, state, created_at, queued_at, executed_at)` with indexes `(community_id, state)` and `(created_at DESC)`.
  - `votes(id PK, proposal_id FK, voter, weight NUMERIC, option_index INT, cast_at)` with unique `(proposal_id, voter)`.
  - `valuable_actions(id PK, community_id FK, params JSONB, created_at, activated_at, deactivated_at)`.
  - `claims(id PK, valuable_action_id FK, claimant, status, evidence_manifest_cid, submitted_at, resolved_at)` with indexes `(status)` and `(claimant)`.
  - `juror_assignments(id PK, claim_id FK, juror, weight NUMERIC, assigned_at, decision)`.
  - `offers(id PK, community_id FK, creator, metadata_cid, status, created_at)` with `(community_id, status)` index.
  - `orders(id PK, offer_id FK, buyer, amount NUMERIC, status, created_at)` with `(offer_id)` index.
  - `reservations(id PK, offer_id FK, start_date, end_date, status, created_at)`.
  - `disputes(id PK, subject_type, subject_id, status, opened_at, resolved_at, resolution_detail_cid)`.

- **GraphQL Schema (Ponder)**
  - Types: `Community`, `Request`, `Comment`, `Draft`, `DraftVersion`, `DraftReview`, `Proposal`, `Vote`, `ValuableAction`, `Claim`, `JurorAssignment`, `Offer`, `Order`, `Reservation`, `Dispute`, `Profile`.
  - Queries (all paginated, cursor-based):
    - `communities(filter, pagination)`; `community(id)`
    - `requests(filter, pagination)`; `request(id)`
    - `drafts(filter, pagination)`; `draft(id)`
    - `proposals(filter, pagination)`; `proposal(id)`
    - `claims(filter, pagination)`; `claim(id)`
    - `offers(filter, pagination)`; `offer(id)`
    - `reservations(filter, pagination)`; `reservation(id)`
    - `disputes(filter, pagination)`; `dispute(id)`
    - `profile(address)` returning wallets’ requests, drafts, votes, claims summary.
  - Mutations: none; all writes stay on-chain.
  - Subscriptions: optional future (deferred until Ponder supports easily); rely on polling for MVP.
  - Pagination defaults: 25 items per page, max 100.
  - Filters: allow `communityId`, `status`, `createdAfter`, `createdBefore`, `search` (with trigram index). Implement sanitized search tokens.

## Contract Integration Plan
- Deployment loading via `packages/contracts/src/deployments.ts`:
  - Provide `getDeployment(chainId)` that reads `deployments/{network}.json`; fallback to `deployments/latest.json`.
  - Export typed map of contract addresses and configuration (governor settings, VPT parameters).
- wagmi/viem setup (`packages/shared/src/wagmi/config.ts`):
  - Configure connectors (MetaMask, WalletConnect) for Base/Base Sepolia.
  - Create `publicClient` for reads and `walletClient` for writes; share `QueryClient` hydration boundary per page.
  - Expose helper hooks: `useContractReadTyped`, `useContractWriteTyped`, `useGovernorState`, `useDraftsManager`.
- Error handling patterns:
  - Detect `ConnectorNotFoundError`, `ChainMismatchError`; prompt network switch.
  - Use viem `simulateContract` before writes to catch reverts.
  - Normalize errors into user-friendly toasts with contract/function context.
  - Provide pending transaction indicator with BaseScan link and background polling for receipt.
- Multi-choice proposals:
  - GraphQL exposes `multiChoiceOptions` with label set and allowed weight per option.
  - UI renders slider or numeric inputs representing 1e18 weight fractions; validate sum ≤ 1e18.
  - Voting uses `CountingMultiChoice.castVoteWithReasonAndParams` with encoded weights.
  - Binary proposals fallback to `castVoteWithReason` using standard options.
- Governance timeline:
  - Combine Ponder data for queued/executed events with RPC `proposalEta` to show countdown.
  - After execution, surface timelock target calls from GraphQL stored data (if available) or decode from `ActionBundle` in draft metadata.

## IPFS / Pinata Content Model
- **Edge Proxy** (`apps/web/app/api/ipfs/[cid]/route.ts`):
  - Runtime: `export const runtime = "edge"`.
  - Validate `cid` using CID regex before fetch.
  - Fetch from Pinata gateway with `PINATA_JWT` header.
  - Enforce size limits (e.g., 1 MB for JSON, 200 KB for markdown fallback) using streaming reader.
  - Parse JSON and validate with zod schemas:
    - `RequestDocument`: version string, title, summary, `bodyMarkdown`, optional `attachments` (CID, type, label).
    - `DraftVersionDocument`: version, `draftId`, author address, `bodyMarkdown`, `actionBundlePreview` (targets, values, signatures), changelog array.
    - `ClaimEvidenceManifest`: version, `claimId`, submittedAt ISO string, evidence array (cid, type enum, title, description, timestamp, optional geo { lat, lng }).
  - Convert markdown to sanitized HTML pipeline: `remark-parse` → `remark-gfm` → `remark-rehype` → `rehype-sanitize` (strict allowlist) → `rehype-stringify`.
  - Return JSON `{ schemaType, data, html }` with headers `Cache-Control: public, max-age=31536000, immutable` and `ETag: "cid"`.
  - Log schema errors to observability (console in dev, structured logs in prod) and return 422 for invalid docs.
- Images: allowlist Pinata gateway domain via `next.config.mjs` `images.remotePatterns`; serve directly from CDN.
- Client consumption: always request `/api/ipfs/${cid}`; never fetch gateway directly for documents.
- Security notes:
  - Reject unsupported schema versions; encourage authors to repin with new schema when necessary.
  - Sanitize HTML before caching; never render raw markdown on client.
  - Enforce `Content-Security-Policy` in Next.js to disallow inline scripts from sanitized HTML fragments.

## Developer Experience & AI-Friendly Standards
- **Coding Conventions**
  - TypeScript strict mode across apps/packages; no `any`.
  - File naming: `PascalCase.tsx` for components, `useFoo.ts` for hooks, `foo.server.ts` for server utilities.
  - Co-locate tests alongside components under `__tests__` when needed.
  - Provide clear prop/return typings for AI-driven code generation.
  - Favor composition (atoms/molecules) within `packages/ui` for reuse.
- **Lint/Test Tooling**
  - ESLint with `next`, `@typescript-eslint`, `prettier` integrations.
  - Prettier for formatting; enforced via `pnpm lint`.
  - Jest (or Vitest) for unit tests in web/shared packages; configure to run from app roots.
  - Playwright e2e tests (executed from `apps/web`) covering golden flows A & B; stub wallet interactions using wagmi connectors.
  - Ponder integration tests verifying event handlers emit correct GraphQL shapes.
- **Milestones & Acceptance Criteria**
  - **M0 Bootstrap**: Next.js app renders community list using mocked GraphQL; Ponder scaffolding, Edge proxy returns sanitized fixture.
  - **M1 Golden Flow A**: Request→Draft→Proposal path functional against Base Sepolia; Playwright test passes; GraphQL lists reflect state changes.
  - **M2 Golden Flow B**: Claim lifecycle visible, juror interactions simulated; SBT balance check via RPC confirmed in UI.
  - **M3 Governance Polish**: Multi-choice voting UI, timeline, error handling; mobile-responsive governance pages.
  - **M4 Marketplace/Housing Read-only**: Marketplace and housing pages display indexed data; disputes viewable with timeline.
  - **M5 Hardening**: Audit Edge proxy logs, expand tests to ≥90% critical coverage, add docs updates in `/docs/EN/contracts` and architecture sections.

## Environment & Local Setup
- **Environment Variables**
  - `NEXT_PUBLIC_RPC_URL_BASE` / `NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA`
  - `NEXT_PUBLIC_GRAPHQL_URL` (default `http://localhost:4200/graphql`)
  - `NEXT_PUBLIC_CHAIN_ID_PRIMARY` (Base chain ID)
  - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
  - `PINATA_JWT`
  - `DATABASE_URL` (Postgres connection for Ponder)
  - `PONDER_NETWORK` (`base` | `base_sepolia`)
  - `PONDER_START_BLOCK` (optional backfill control)
  - `SESSION_SECRET` (future auth)

- **docker-compose.yml**
  - `postgres`: Postgres 15, persistent volume, healthcheck.
  - `ponder`: builds from `apps/indexer`, depends on `postgres`, exposes GraphQL port 4200, runs `pnpm ponder dev`.
  - Optional `redis` placeholder for future caching (commented).

- **Scripts (run from repo root)**
  - `pnpm dev:web` → `cd apps/web && next dev` with env validation.
  - `pnpm dev:indexer` → `cd apps/indexer && pnpm ponder dev`.
  - `pnpm dev:all` → concurrently run web + indexer.
  - `pnpm db:reset` → uses scripts/db/reset.ts to drop/create/migrate Postgres.
  - `pnpm db:seed` → seeds communities/requests with known CIDs.
  - `pnpm lint` / `pnpm test` / `pnpm test:e2e` executed per app.
  - `pnpm analyze:contracts` → regenerates ABI/types post contract updates.

- **Local Workflow**
  1. Copy `.env.example` to `.env` in repo root; run `pnpm generate-env` (optional) to validate required keys.
  2. `docker-compose up postgres ponder` to start data services.
  3. `pnpm install` then `pnpm dev:all` for simultaneous web/indexer.
  4. Use provided seed script to populate example communities on Base Sepolia; optional script to pin sample IPFS docs via Pinata API.
  5. For tests, run from respective app folders (`cd apps/web && pnpm test`).

- **Operational Notes**
  - Ensure Ponder block range aligns with deployed community (start block from deployments JSON).
  - Document redeploy workflow: update `deployments/latest.json`, rerun `pnpm analyze:contracts`, restart indexer.
  - Monitor Edge proxy logs for schema validation failures; integrate with future observability stack.

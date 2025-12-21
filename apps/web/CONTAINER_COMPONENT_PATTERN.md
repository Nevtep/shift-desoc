# Container/Component Pattern for Requests UI

Use this pattern to keep business logic in a container and pure rendering in presentational components. Follow it for new features and refactors across the web app.

## Naming and Files
- Container: `<feature>.container.tsx` lives beside presentational components and handles data fetching, state, and handlers.
- Presentational: split by section into `<feature>-<section>.component.tsx` (header, body, drafts, comments, etc.).
- Shared UI bits: standalone files for reusable atoms (e.g., `role-chip.component.tsx`, `comment-content.component.tsx`).
- Helpers and types: reuse `components/requests/helpers.tsx` and `types.ts` for formatting, IPFS guards, and view models; add new helpers here instead of in components.

## Container Responsibilities
- Fetch data (GraphQL hooks, IPFS) and read/write contracts (wagmi).
- Hold local state (draft inputs, optimistic updates, pagination cursors, permission flags).
- Derive view models for components (normalized ids, status labels, booleans like `canModerate`).
- Pass callbacks for mutations (submit, update status, moderate, link VA, pagination) down as props.

## Presentational Responsibilities
- Receive all data via props; no fetching or contract calls.
- Render UI only; keep JSX small by splitting sections (header/meta, body content, drafts list, comments area).
- Use shared helpers for formatting (`formatDate`, `statusBadge`, `shortAddress`, `buildCommentTree`) instead of duplicating logic.

## Example: Request Detail
- Container: `components/requests/request-detail.container.tsx` owns GraphQL queries, wagmi reads/writes, optimistic comments, and passes props to section components.
- Sections: `request-detail-header.component.tsx`, `request-detail-body.component.tsx`, `request-detail-drafts.component.tsx`, `request-detail-comments.component.tsx`.
- Atoms: `role-chip.component.tsx`, `comment-content.component.tsx`.
- Re-export: `request-detail.tsx` re-exports the container to preserve existing imports.

## How to Refactor Another Feature
1) Rename the current monolithic file to `.container.tsx` and keep imports stable by re-exporting from the original filename.
2) Identify logical sections and extract them into `<feature>-<section>.component.tsx` files; keep them prop-driven.
3) Move pure utilities to `helpers.tsx` (or create one nearby) and shared view models to `types.ts`.
4) Ensure tests target updated copy/structure; align text expectations with rendered content and mock wagmi/public client in `tests/unit/setup.ts` if needed.
5) Keep props minimal and typed; avoid passing the entire query response when a view model suffices.

## Testing Notes
- Unit tests should render containers; presentational components can be shallow-tested if needed.
- Avoid real RPC calls: stubs for wagmi hooks live in `tests/unit/setup.ts`; add handlers to MSW if new network calls appear.

## Request List Alignment
- Follow `components/requests/request-list.container.tsx` plus its presentational parts as the baseline: container fetches requests/communities, components render author, status badge, tags, and link.

## Quick Checklist
- Container only: data, state, handlers. Components only: render.
- Shared helpers/types reused; no duplicate date or IPFS guards.
- Re-export from original filename to avoid churn.
- Update tests and mocks to reflect new copy and stubbed network calls.

# Shift Web dApp

Next.js App Router application for Shift DeSoc governance, verification, and commerce flows.

## Testing

- Unit/integration: `pnpm test:unit` (Vitest + jsdom + Testing Library + MSW)
- E2E scaffold: `pnpm test:e2e` (Playwright; specs pending while flows stabilize)

### Test utilities

- Providers: `renderWithProviders` wraps `ShiftProviders` with default GraphQL/API URLs and MSW.
- Wallet mocks: `mockWagmiHooks({ connected, address, chainId })` toggles wagmi hook states for gating logic.
- MSW: handlers live in `tests/unit/mocks/handlers.ts` with fixtures in `fixtures.ts`.

### Adding tests

1. Import `renderWithProviders` from `tests/unit/utils` and target the client component/page.
2. Override MSW handlers in a test with `server.use(...)` to drive success/empty/error paths.
3. Use `mockWagmiHooks` to simulate connected/disconnected or chain-mismatch wallet states.

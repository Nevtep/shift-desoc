# Shift Manager — Feature Specs Roadmap (UX-driven)

This document captures the **proposed SpecKit feature specification roadmap** to evolve the Shift monorepo (contracts + Ponder indexer + Next.js Manager) toward the desired **Manager UX**:

- Home index: **Community creation wizard** (“Inicia tu comunidad en Shift”) + **communities list**
- Community detail: **parameters + snapshots** (requests, drafts, proposals)
- Per-community navigation to manage: coordination, governance, verification (valuable actions/engagements/positions), investment/cohorts, economic layer, commerce (marketplace + housing + disputes), projects.

> Notes
> - Ordered to build a solid UX shell first, then complete functional vertical slices.
> - Uses Shift canonical terms (Engagements, ValuableActions, VPS, etc.).
> - “Capability flags” are recommended so the UI never implies features that aren’t implemented/indexed yet.

---

## A) Manager UX Shell (IA + routing + dashboards)

1. **Manager Home: Community Wizard + Communities Index**  
   Home becomes onboarding-first: wizard CTA + indexed communities list (with indexer health/lag indicators).

2. **Community Detail Dashboard (Overview)**  
   `/communities/[id]` as a dashboard: key parameters + brief snapshots of Requests / Drafts / Proposals, with links to full sections.

3. **Manager Navigation IA + Section Layouts (per community)**  
   Standard per-community sections:
   - Coordination (Requests, Drafts)
   - Governance (Proposals)
   - Verification (Valuable Actions, Engagements, Verifiers, Credentials, Positions)
   - Economy (Cohorts, Revenue, Treasury, Params, Tokens)
   - Commerce (Marketplace, Disputes, Housing, Projects)

4. **Multi-community correctness hardening (Indexer + Manager assumptions)**  
   Remove single-community assumptions (e.g., defaults) and ensure deterministic projections/joins by communityId.

---

## B) Coordination + Governance (re-fit into new UX)

5. **Requests & Comments: Community-scoped UX + moderation polish**  
   Integrate existing RequestHub UI into community sections and dashboard snapshots.

6. **Drafts Manager: Community-scoped UX + escalation polish**  
   Integrate Draft workflows into Coordination → Drafts and tighten escalation UX.

7. **Governance Proposals: Community-scoped UX + navigation drift fixes**  
   Solidify proposal list/detail, correct broken links/routes, and align with community dashboard entry points.

---

## C) Work Verification (Valuable Actions / Engagements / VPS)

8. **ValuableAction Registry: Admin UX + indexing expansion**  
   Create/activate/pause valuable actions; surface evidence specs, cooldowns, panel rules; expand indexer projections for action definitions.

9. **Engagements: Rich lifecycle UX (submit → jurors → votes → resolve)**  
   Complete the end-to-end engagement lifecycle UX beyond the current minimal surface; richer state views and links to related entities.

10. **Verifiers / Jury Management (VPS): UI + projection**  
   Verifier roster, power weights, bans/unbans, elections/admin flows (timelock-governed), and operational dashboards.

11. **Credentials Manager: UI + indexer**  
   Course definitions, applications, approvals, revocations; credential explorer by community/member.

12. **Positions & Roles: UI + indexer + RevenueRouter registration visibility**  
   Position types, applications, approvals, close outcomes; show registration/unregistration outcomes and ROLE SBT history.

---

## D) Economic Layer (Cohorts / Revenue / Treasury / Params / Tokens)

13. **Investment Cohorts: UI + indexer**  
   Cohort list/detail, investor participation, target ROI progress, windows/caps, and admin visibility.

14. **Revenue Router: Claims UI + indexer**  
   Worker/investor/treasury distributions, claimable balances, and claim flows (economic claiming).

15. **Treasury Adapter: Policy + Safe Tx Builder UI + indexer**  
   Build/validate spend payloads (no custody), enforce allowlists/caps, show vault balances and policy outcomes.

16. **ParamController: Governance-managed settings UI + indexer**  
   View/edit governed params per community (timings, eligibility, economics, verifier params), with timelock-aware UX.

17. **Token & SBT Explorer (CommunityToken, MembershipToken, VPT, ValuableActionSBT)**  
   Read-only explorer + admin insights; per-member views and per-community summaries.

---

## E) Commerce Layer (Marketplace / Housing / Disputes / Projects)

18. **Marketplace Core: Offers/Orders indexing + real UI**  
   Replace placeholders with indexed catalog, offer creation, order lifecycle, settlement views, fee breakdown.

19. **Housing Manager: Units/Reservations indexing + UI**  
   Co-housing availability, reservation minting/history, refunds/cancellations, and integration with Marketplace offer kinds.

20. **Commerce Disputes: indexing + UI**  
   Dispute timelines, evidence CIDs, outcomes, and callbacks; keep commerce disputes separate from work verification.

21. **Project Factory: indexing + UI**  
   Project shells list/detail; minimal viable surface first, expanded milestones later.

---

## Suggested starting point (if starting fresh after canonicalization)

- **Spec 1**: Manager Home (wizard + list)  
- **Spec 2**: Community Detail Dashboard  
- **Spec 3**: Navigation IA + section layouts  
Then proceed to multi-community hardening and feature completion slices.

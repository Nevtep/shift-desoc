# Shift Monorepo — Roadmap de Specs (SpecKit)

Este documento resume el listado de *specs* propuestos para llevar el **Shift Manager** a la UX deseada (home con wizard + dashboard por comunidad), y completar progresivamente los features del protocolo (contracts + indexer + apps).

---

## A. Manager UX Shell (reordena la app sin tocar protocolo)

1) **Manager Home: Community Wizard + Communities Index**  
   - Home como wizard “Inicia tu comunidad en Shift” + listado debajo (con estados/health de indexer).  
   - Reemplaza el “menú de paths” actual por la entrada onboarding-first.

2) **Community Detail Dashboard (Overview)**  
   - `/communities/[id]` como dashboard: parámetros clave + snapshots de Requests / Drafts / Proposals.  
   - CTA hacia secciones de gestión (coordinación, gobernanza, verificación, economía, commerce).

3) **Manager Navigation IA + Section Layouts**  
   - Menú lateral/section tabs por comunidad:  
     - Coordination (Requests, Drafts)  
     - Governance (Proposals)  
     - Verification (Valuable Actions, Engagements, Verifiers, Credentials, Positions)  
     - Economy (Cohorts, Revenue, Treasury, Params, Tokens)  
     - Commerce (Marketplace, Disputes, Housing, Projects)  
   - “Capability flags” para no prometer rutas sin indexer/feature real.

4) **Multi-community correctness hardening (Indexer + Manager assumptions)**  
   - Asegurar determinismo multi-comunidad (evitar joins/defaults implícitos).  
   - Health checks y consistencia de IDs.

---

## B. Coordination y Governance (ya avanzados, adaptados a la nueva UX)

5) **Requests & Comments: Community-scoped UX + moderation polish**  
   - Integrarlo en la nueva IA por comunidad y mejorar vistas/listados en el dashboard.

6) **Drafts Manager: Community-scoped UX + escalation flows polish**  
   - Re-encapsular en “Coordination → Drafts”, con estados claros y navegación consistente.

7) **Governance Proposals: Community-scoped UX + fix navigation drift**  
   - Dejar governance sólido en la nueva IA, corrigiendo rutas/links rotos o drift.

---

## C. Work Verification (núcleo Shift: acciones valorables)

8) **ValuableAction Registry: Admin UX + indexing expansion**  
   - CRUD/enable/disable, metadata, evidence rules, cooldowns, panel rules.  
   - Expandir indexer para proyectar action definitions.

9) **Engagements: Rich lifecycle UX (submit → jurors → votes → resolve)**  
   - Estados ricos, evidencias, links con requests/bounties, outcomes, historial, etc.

10) **Verifiers / Jury Management (VPT): UI + projection**  
   - Roster, bans/unbans, power/weights, election/admin flows (según autoridad timelock).

11) **Credentials Manager: UI + indexer**  
   - Flujos de apply/approve/reject, single-credential constraints, revocation governance-only.

12) **Positions & Roles: UI + indexer + RevenueRouter registration visibility**  
   - Aplicaciones, approvals, close outcomes, Position SBT / points, visibilidad de registro.

---

## D. Economic layer (inversión, claims y treasury ops)

13) **Investment Cohorts: UI + indexer**  
   - Cohorts list/detail, estados, windows, investors, target ROI view.

14) **Revenue Router: Claims UI + indexer**  
   - Claims de posiciones / inversión / treasury, breakdown, estados y errores.

15) **Treasury Adapter: Policy + Safe Tx Builder UI + indexer**  
   - “build tx → validateSpend → export payload”, guardrails y roles (sin custody).

16) **ParamController: Governance-managed settings UI + indexer**  
   - Viewer/editor por comunidad: timings, eligibility, economics, verifier params, etc.

17) **Token & SBT Explorer**  
   - CommunityToken, MembershipToken, VPT, ValuableActionSBT: explorer + admin insights.

---

## E. Commerce layer (marketplace + housing + disputes)

18) **Marketplace Core: Offers/Orders indexing + real UI**  
   - List/create offer, purchase, escrow states, fulfillment, settle, fee breakdown.

19) **Housing Manager: Units/Reservations indexing + UI**  
   - Availability, reservations, occupancy; integración con Marketplace (tipo HOUSING).

20) **Commerce Disputes: indexing + UI**  
   - Timeline, evidence CIDs, outcomes, callbacks.

21) **Project Factory: indexing + UI**  
   - “Projects” surface: listado/detalle mínimo y wiring para evolución futura.

---

## Recomendación de arranque (por UX)

Para materializar rápido la UX deseada (wizard + dashboard por comunidad), empezar por:

- **(1) Manager Home: Community Wizard + Communities Index**
- seguido de **(2) Community Detail Dashboard (Overview)**

Luego, **(3) Manager Navigation IA + Section Layouts** para ordenar el resto de módulos bajo el dashboard por comunidad.

# Shift SpecKit + Copilot Playbook (Clarify-First, Implementation-Exact)

This file is meant to be pasted into a GPT/agent config or used as a standing “operating manual” for this repository’s workflow.

## Why the last feature landed “half implemented”

Based on the artifacts from `003-manager-home-deploy`, the failure mode is structural:

1. **Specs allowed “compliance without replacement”**
   - The spec required “wizard above communities index”, but did **not explicitly require removing the old home menus/links**.
   - Result: an implementation can pass requirements while still leaving the old UI in place.

2. **Wizard requirements were underspecified at the “screen contract” level**
   - The spec required “wallet connected” and “multi-tx wizard”, but did not mandate:
     - a visible **Connect Wallet** CTA on the Home surface (vs relying on some global header),
     - a concrete set of **wizard inputs** (name, metadata, chain selection, etc.),
     - the exact **step list and expected tx count per step** rendered to the user.

3. **Mock-first tests can be satisfied with stubs**
   - `tasks.md` emphasizes unit/component tests with MSW and mocks.
   - Without a required **real chain smoke test gate**, Copilot can satisfy tests by stubbing tx execution paths, leaving key parts unimplemented.

4. **Manual quickstart gate was left incomplete**
   - The tasks file still includes an unchecked manual verification task.
   - If that task is not mandatory to mark “done”, the system can claim completion without proving real wallet tx orchestration.

**Conclusion:** the process needs (a) a stricter Clarify phase, (b) “screen-level acceptance criteria” that forbid legacy UI elements, and (c) a mandatory “real tx smoke test” gate before accepting “Implementation successful”.

---

## Operating Mode: Clarify → Specify → Plan → Tasks → Implement (repeatable cycles)

### Non-negotiables
- **Always run Clarify before Specify** for any feature that changes UX or includes multi-step transaction flows.
- If Clarify reveals multiple independent surfaces (UI shell + orchestration + query), split into multiple cycles.
- **Definition of Done MUST include a real-wallet smoke test on Base Sepolia** for any feature that sends transactions.

### What counts as “feature complete”
A feature is complete only when:
- UI matches the required screen contract (layout, removals, copy).
- All tx flows execute against a real chain (or a deterministic fork sim) with wallet signatures.
- Tests pass, and the manual smoke script is executed and recorded.

---

## Clarify Phase (use `speckit.clarify`)

### Goal
Reduce ambiguity that causes “placeholder implementations”.

### Rules
- Ask **≤ 5** high-impact questions.
- Each question must be answerable with:
  - a letter option (A–E), or
  - a short phrase (≤ 5 words).
- Clarifications must be written back into the spec under `## Clarifications`.

### Mandatory Clarify Topics for Shift Manager UX
For any screen-level feature, clarify these *before* specifying:
1. **Screen Contract:** what must be visible, in what order, and what must be removed.
2. **Inputs:** what fields exist, validation rules, defaults.
3. **Tx Orchestration:** exact step list, tx count expectations, and what “success” means.
4. **Persistence:** what is stored locally (session), what is derived from chain.
5. **Real-chain Gate:** what smoke test scenario must be executed.

---

## Specify Phase (use `speckit.specify`)

### Keep it “WHAT/WHY”, but include a **Screen Contract**
Specs must include a section like:

#### Screen Contract (Required)
- MUST show: ...
- MUST NOT show: ... (explicitly list legacy UI to remove)
- Order: Wizard first, List second, etc.
- CTAs: exact labels (“Connect Wallet”, “Create community”, “Resume deploy”)
- Wizard inputs: fields + validation
- Stepper: step names + expected tx count shown

### Tx Orchestration requirements must be explicit
For multi-tx flows, the spec MUST state:
- Steps: PRECHECKS, DEPLOY_STACK, WIRE_ROLES, VERIFY
- For each step:
  - purpose
  - expected tx count range
  - which failures are terminal
- “Created” gating rules (what exact on-chain predicates define “created”)

### Anti-placeholder rule
Add a spec requirement:
- “Implementation MUST NOT contain TODO stubs for tx execution; each step must send a real transaction when not mocked.”

---

## Plan Phase (use `speckit.plan`)

Plans must answer “HOW” with repo-specific detail:
- exact files and modules
- step → viem/wagmi call mapping strategy
- resume inference predicates
- preflight estimation approach (fee data source)
- decision: client-side reads vs API routes (pick one)

Plans MUST include:
- a *real chain smoke checklist* (Base Sepolia) as a required gate.

---

## Tasks Phase (use `speckit.tasks`)

Tasks must prevent “half implementations” by including:

### A. UI replacement tasks (not additive)
- Add explicit tasks to **remove** legacy UI sections, not only add new sections.

### B. Tx execution tasks that cannot be stubbed
- tasks that assert:
  - “deployContract/writeContract is invoked”
  - “tx hash recorded”
  - “receipt awaited”
  - “UI progress updated on confirmation”

### C. Mandatory manual smoke task
- The manual on-chain smoke task must be:
  - **not optional**
  - **blocking for completion**
  - recorded in quickstart with tx hashes

### D. Evidence-based completion
- Each story checkpoint must require:
  - “screenshots or short screen recording”
  - “tx hashes”
  - “post-deploy verification pass output”

---

## Implement Phase (use `speckit.implement`)

### Hard acceptance gates
Implementation is only accepted if:
- It modifies the expected files (home route, wizard components, hooks, deploy libs).
- It removes explicitly forbidden UI elements.
- It executes the manual smoke task and records evidence.

### “No paper completion”
The implement agent must NOT:
- mark tasks as [X] if code does not exist / is not wired.
- satisfy tests by replacing tx logic with mocks in production code paths.

---

## Conversation Protocol (for the assistant)

When starting a feature:
1. **Restate the feature name + boundary in one line.**
2. Run **Clarify** questions (≤ 5). One at a time.
3. Produce:
   - updated spec prompt (including Screen Contract + MUST NOT show list)
   - plan prompt (repo-specific)
   - tasks prompt (blocking smoke test)
4. After the user says “Implementación exitosa”, the assistant must request:
   - link to tasks.md with final checkmarks
   - quickstart.md evidence (tx hashes + screenshots)
   - summary of any deviations

If evidence is missing, do **not** advance to the next feature.

---

## Templates to reuse

### Screen Contract snippet
Copy/paste this into any spec:

#### Screen Contract
- MUST show (top-to-bottom):
  1. Connect Wallet button (when disconnected)
  2. Deploy Wizard (with inputs + stepper + resume)
  3. Communities List (with search + empty/loading/error)
- MUST NOT show:
  - Legacy home menu links: [list them explicitly]
- Wizard inputs:
  - Community name (required, 3–40 chars)
  - Optional description
  - Optional metadata URI / logo CID
- Wizard stepper (always visible once started):
  - Preflight (0 tx)
  - Deploy Stack (N tx)
  - Wire Roles (M tx)
  - Verify (0 tx)
- Created gating:
  - CommunityRegistry has module pointers + all verification checks pass

### Mandatory Smoke Test snippet
- Execute on Base Sepolia with a funded wallet:
  - Start wizard, sign txs, complete
  - Record tx hashes + final verification output screenshot
  - Interrupt mid-way, reload, resume, record evidence
  - Attempt resume with different wallet → must block

---

## Where to apply this file
- Add to `.specify/memory/assistant-playbook.md` (or similar)
- Or paste into a custom GPT “instructions” field as the operating policy

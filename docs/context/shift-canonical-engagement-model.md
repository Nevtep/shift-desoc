# Shift – Engagement, Position & Investment Model (Global Context v3)

## Purpose of this document

This document defines the **authoritative economic, participation, and reputation model** for the Shift protocol.

It MUST be attached as **global context** to any Copilot prompt that modifies, creates, or refactors:
- architecture documents
- smart contract specifications
- governance logic
- revenue distribution mechanisms

This version extends previous iterations by explicitly defining:
- Investment SBTs and active cohorts
- Guaranteed revenue floors
- Spillover rules
- Reputation handling when Positions end

---

## Core Abstractions

The Shift system is built around three core tokenized abstractions:

1. **Engagement SBTs** – completed one-shot work, certified past roles, or verified credentials  
2. **Position SBTs** – active, ongoing roles  
3. **Investment SBTs** – capital participation via cohorts  

These SBTs are minted by **dedicated token contracts** (one per type).  
The **ValuableActionRegistry** acts as the policy and definition layer that governs issuance conditions, metadata schemas, and verifier authorization, but it is NOT itself the token contract. 

> All economic participation and reputation in Shift MUST be expressed through one of these SBT types.

---

## Definition: Engagement

An **Engagement** is a formal, verifiable economic relationship between an actor and the system.

Engagements define:
- how value is contributed
- how participation is recognized
- how reputation is recorded
- how revenue is allocated

There are three Engagement lifecycles:
- **One-shot Engagements**
- **Credential Engagements**
- **Ongoing Engagements (Positions)**

---

## Engagement Types

### 1. One-shot Engagements (Engagement SBT)

**Purpose**
- Discrete, single-execution work
- Paid once via bounty
- Reputation and proof of contribution

**Characteristics**
- Created through Requests
- Associated with evidence (Valuable Actions)
- Completed exactly once
- Trigger atomic payout
- Mint an Engagement SBT
- Never participate in revenue sharing

**Lifecycle**
1. Request is created and funded
2. Work is submitted and verified
3. Engagement is completed
4. Bounty is paid
5. Engagement SBT is minted
6. Engagement is permanently consumed

---

### 2. Credential Engagements (Engagement SBT)

**Purpose**
- Represent completion of studies, trainings, or certifications
- Provide portable, verifiable reputation
- Do NOT imply economic participation

**Characteristics**
- Minted upon verified completion of a course or training
- Non-transferable
- May include optional expiration
- Do NOT participate in revenue distribution
- Are not associated with bounties or payments

**Lifecycle**
1. A credential or course is defined (e.g. "Carpentry Training")
2. A participant applies for the credential
3. An authorized verifier (e.g. instructor) approves or rejects the application
4. Upon approval, a Credential Engagement SBT is minted
5. The credential remains as a reputational record
6. Optional expiration or revocation rules may apply


### 3. Ongoing Engagements – Positions (Position SBT)

**Purpose**
- Continuous operational roles
- Long-lived responsibility
- Guaranteed participation in revenue distribution

**Characteristics**
- Represented by Position SBTs
- Non-transferable
- Revocable
- Carry points
- Receive a **minimum guaranteed share of revenue**
- Do not require recurring claims

**Lifecycle**
1. Position type (role) exists
2. Participant applies
3. Governance or moderators assign position
4. Position SBT is minted
5. While active, it participates in revenue distribution
6. Upon revocation or closure, participation stops immediately

---

## Position Closure & Reputation (Role Engagement SBT)

Ending a Position **must not erase history**.  
However, **reputation must be earned, not automatic**.

### Principle

> **Revoking a Position ends economic participation.  
> Certifying the role is a separate, explicit action.**

---

### Role Engagement SBT (Certified Past Role)

A **Role Engagement SBT** is a subtype of Engagement SBT that represents:
- A role that was held in the past
- Successfully or neutrally completed
- No longer economically active

**Properties**
- Non-transferable
- Non-revocable (historical record)
- Does NOT participate in revenue distribution
- Indexed, composable, and reputational

---

### Position Closure Outcomes

When a Position ends, it MUST be closed with an explicit outcome:

#### 1. Successful Completion (`SUCCESS`)
Examples:
- End of contract
- Voluntary exit
- Role expiration
- Reassignment

Action:
- Position SBT is revoked
- **Role Engagement SBT is minted**
- Metadata includes:
  - roleType
  - holder
  - duration
  - points
  - community
  - outcome = SUCCESS

---

#### 2. Neutral Closure (`NEUTRAL`)
Examples:
- Reorganization
- Scope change
- Mutual agreement

Action:
- Position SBT is revoked
- **No automatic SBT is minted**
- Governance MAY mint a Role Engagement SBT manually

---

#### 3. Negative Revocation (`NEGATIVE`)
Examples:
- Misconduct
- Emergency removal
- Slashing event

Action:
- Position SBT is revoked
- **No Role Engagement SBT is minted**
- Optional on-chain event for auditability

> Negative revocations MUST NOT automatically generate reputation tokens.

---

## Investment Participation (Investment SBT)

### Investment SBTs and Cohorts

**Purpose**
- Represent capital contribution
- Define investor participation in community or protocol revenue
- Typically receive the **largest share of revenue**

**Characteristics**
- Non-transferable (unless governance allows otherwise)
- Issued via **investment cohorts**
- Carry points or weights
- Participate in revenue distribution while their cohort is active
- Derived from ValuableActionRegistry (capital contribution as a valuable action)

---

### Cohorts

- A cohort is a bounded group of Investment SBTs
- Cohorts can be:
  - time-limited
  - milestone-bound
  - perpetual
- Only **active cohorts** receive revenue
- Cohorts can be activated or deactivated by governance

---

## ValuableActionRegistry as Policy & Definition Layer

The **ValuableActionRegistry** defines:
- action / credential / role types
- issuance policies
- verifier authorization rules
- metadata schema requirements

Actual minting is performed by dedicated token contracts:
- EngagementSBT
- PositionSBT
- InvestmentSBT

Managers (RequestHub, PositionManager, CredentialManager, InvestmentCohortManager) enforce lifecycle rules and call the corresponding token contracts to mint or revoke, while validating against policies stored in ValuableActionRegistry.

RequestHub is a generic request orchestration hub that can host multiple request types, including one-shot work engagements and governance proposal requests. Only work-type requests mint EngagementSBTs and perform bounty payouts.


| SBT Type       | Policy-defined Action                                                     |
|----------------|---------------------------------------------------------------------------|
| Engagement SBT | Verified one-shot work, certified role completion, or verified credential |
| Position SBT   | Role assignment action                                                    |
| Investment SBT | Capital contribution action                                               |


The registry is the **single source of truth** for:
- issuance conditions
- metadata
- identity binding

---

## Revenue Distribution Model

### Revenue Router – Authoritative Flow

The Revenue Router is the **only contract responsible for splitting revenue**.

#### Step 1 — Treasury Minimum (Guaranteed)
- A minimum percentage is routed to the Treasury
- Defined by community parameters
- Always executed first

#### Step 2 — Positions Minimum (Guaranteed)
- A minimum percentage is routed to active Position SBT holders
- Distributed proportionally by Position points
- Guaranteed regardless of investor presence

#### Step 3 — Investment Cohorts (Primary Allocation)
- Remaining revenue is allocated to **active Investment cohorts**
- Distributed proportionally among Investment SBT holders
- Expected to be the **largest portion of revenue** in most communities

---

### Spillover Logic (No Active Cohorts)

If **no investment cohorts are active**:

The remaining revenue is redirected according to governance-defined parameters:
- Option A: Redistribute among Position SBT holders
- Option B: Redirect entirely to the Treasury
- Option C: Split between Treasury and Positions

This behavior MUST be explicit and deterministic.

---

## Treasury Responsibilities

The Treasury:
- Holds all funds
- Executes payments via authorized contracts
- Supports:
  - Event-based payouts (one-shot Engagements)
  - Continuous distribution (Revenue Router)

The Treasury does NOT:
- Decide allocation logic
- Evaluate work
- Manage roles or investments

---

## Governance Responsibilities

Governance:
- Defines all minimum percentages and spillover rules
- Creates and configures Position types
- Assigns and revokes Positions
- Certifies completed roles when appropriate
- Creates and manages Investment cohorts
- Activates and deactivates cohorts
- Updates Revenue Router parameters

Governance never performs direct payouts.

---

## Terminology Summary

| Concept          | Meaning                                                     |
|------------------|-------------------------------------------------------------|
| Engagement SBT   | Completed work, certified past role, or verified credential |
| Position SBT     | Active operational role                                     |
| Investment SBT   | Capital participation                                       |
| Cohort           | Group of Investment SBTs                                    |
| Guaranteed Share | Minimum allocation (Treasury / Positions)                   |
| Spillover        | Revenue remaining after guarantees                          |

---

## Design Principles

- Capital, labor, and reputation are explicit and separable
- Revenue distribution is deterministic
- Investment is cohort-scoped
- Roles are persistent but revocable
- Reputation is earned, not automatic
- One-shot work is atomic
- Governance defines parameters, not transactions
- Credentials and trainings are modeled as Engagements, not as financial instruments


---

## Non-Goals

This model does NOT:
- Allow repeated claiming of work
- Automatically grant reputation on negative revocation
- Mix one-shot work with revenue sharing
- Implicitly allocate revenue without parameters
- Rely on off-chain negotiation
- Credentials do not generate revenue or economic rights
- Credentials are not issued automatically without explicit verification


---

## Final Note

Any document or contract that:
- ignores Investment SBTs or cohorts
- distributes revenue without guarantees and spillover rules
- treats Positions or Investors as Claims
- erases role history without explicit certification

must be updated to comply with this model.

This document is the **canonical economic, participation, and reputation context** for Shift.

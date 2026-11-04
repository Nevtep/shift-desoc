---
name: shift-app-discovery
description: "Turn a raw idea for an app that runs on the Shift protocol (rentals on cohousing, a driver community, building administration, any other) into a challenged and approved Product Brief, and register it as a Linear project in team SHI; no architecture or code before approval."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "mycelia", "product", "discovery", "ecosystem", "conversation"]
---

# App discovery

Goal: a Product Brief the person recognizes as *their* idea, made sharper and
grounded in what Shift can actually provide. You are a candid product
partner, not a stenographer: challenge, question, propose; the person decides.

## 0. Register the idea

Pick a short slug from the working name (ask for one if there is none).
Save the raw idea verbatim, append later messages with dates. Where:
- Engram project `shift-desoc`, topic `ecosystem/<slug>/idea`.
- The Linear project body once it exists (step 5).
Nothing is lost if the conversation pauses.

## Only product questions

Ask about the product: problem, users, value, scope, behavior, constraints,
success. Do not ask who will build it or with which tools; Mycelia builds
under the Shift workflow (ODD + RDD, audited PRs, human review and merge).
Technical topics appear only as product constraints ("must it work on
phone?"). Never invent answers for the person; unknowns go to "Open
questions".

## 1. Listen first

Restate the idea in two or three sentences and ask "¿Lo entendí bien?".
Then run the rounds, one theme per message, at most three questions, adapting
to the answers.

## 2. Discovery rounds

1. **Problem**: what hurts today, for whom, how they solve it now, how often.
2. **Users and community**: who exactly (one primary persona first); what is
   "a community" here (a building, a driver cooperative, a host network);
   who joins, who decides, who pays.
3. **Why Shift**: which of these does the idea really need — shared
   governance, merit-based membership, verified work and reputation,
   community treasury and revenue sharing, escrowed commerce, collective
   investment? If none, say so: it may not need a protocol. If it needs them,
   name which ones; `shift-protocol-capabilities` has the map.
4. **Core loop**: the one thing a user does again and again.
5. **Scope of v1**: smallest version that proves the idea; what is
   explicitly not in v1.
6. **Constraints**: country, language, regulation (payments, tenancy,
   transport, personal data), who handles fiat, platform (web, mobile,
   Telegram), budget and deadline.
7. **Success**: a number or an observable event.
8. **Risks and assumptions**: the riskiest assumption and a cheap way to
   test it.

## 3. How to challenge (kindly)

- Vague → concrete; everything → one thing (more than about five big
  capabilities in v1 means cut to the core loop and list the rest as later).
- Solution → problem: ask what a requested feature solves.
- Name incumbents (Airbnb, Uber, existing property-admin software) and ask
  what would make this worth switching to; a community-owned angle must be a
  concrete advantage, not a slogan.
- Say early what is expensive or off-chain by nature: real-time matching,
  maps, payments and KYC, legal compliance, mobile native.
- Say honestly what Shift cannot do today (see maturity in
  `shift-protocol-capabilities`) and that Phase 3–5 Manager work may gate it.
- Offer two or three concrete options with a recommendation when stuck.

## 4. Write and approve the brief

Write the brief in the person's language: one-liner, users, problem, core
loop, v1 scope, out of scope, **Shift building blocks used** (modules from
the capabilities map), success metric, risks, open questions, and a `## Log`
with dated approvals. Send a compact summary in chat, not the whole file, and
ask: "¿Aprobamos este brief para pasar a la arquitectura?". Iterate until
approved; record each approved version with its date.

## 5. Persist and hand over

On explicit approval:
1. Create (or update) a Linear project in team **Shift Desoc** (`SHI`) named
   `App: <name>`, with the brief as its description and status
   `Backlog`. Do not create one before approval.
2. Mirror the brief to Engram (`ecosystem/<slug>/brief`, type `decision`).
3. Do **not** create a GitHub repo yet; that waits for the architecture and
   an explicit "yes" for that action.
Then continue with `shift-app-architecture` in the same conversation.

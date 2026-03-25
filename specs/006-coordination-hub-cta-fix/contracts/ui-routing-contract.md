# UI Routing Contract: 006 Coordination Hub CTA Fix

## Required Community-Scoped Routes

The following are the only valid routes introduced by this feature:

1. `/communities/[communityId]/coordination`
2. `/communities/[communityId]/coordination/requests`
3. `/communities/[communityId]/coordination/requests/new`
4. `/communities/[communityId]/coordination/requests/[requestId]`
5. `/communities/[communityId]/coordination/drafts`
6. `/communities/[communityId]/coordination/drafts/new`
7. `/communities/[communityId]/coordination/drafts/[draftId]`

## CTA Contract (Overview)

### Requests panel
- View all: enabled -> `/communities/[communityId]/coordination/requests`
- Create new: enabled -> `/communities/[communityId]/coordination/requests/new`

### Drafts panel
- View all: enabled -> `/communities/[communityId]/coordination/drafts`
- Create new: enabled -> `/communities/[communityId]/coordination/drafts/new`

### Proposals panel
- View all: disabled (Coming soon), non-navigable control
- Create new: disabled (Coming soon), non-navigable control

### Header actions
- View parameters: disabled (Coming soon), non-navigable control
- Edit parameters: permission-gated; when disabled, non-navigable control

## Link Discipline Rules

- Scoped list pages MUST NOT emit row links to global `/requests/[id]` or `/drafts/[id]`.
- Disabled CTAs MUST NOT render as active internal Next Links.
- Detail mismatch guard MUST provide correction links to community-scoped routes only.

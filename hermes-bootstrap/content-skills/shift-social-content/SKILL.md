---
name: shift-social-content
description: "Daily Shift Instagram post through the Escarlet MCP: pick an original, evidence-backed Shift topic, write the copy, generate the images, upload them and publish under the job's automation policy."
license: Apache-2.0
metadata:
  author: Shift
  version: "1.0"
  hermes:
    tags: ["shift", "content", "instagram", "escarlet", "cron"]
---

# Shift daily social content

Run exactly one content cycle: at most one new Instagram post for Shift per
calendar day (America/Argentina/Cordoba). Follow `escarlet-mcp-content` for
every Escarlet operation; this skill only adds Shift's job policy.

## Job policy (set outside the prompt)

Read these from the environment; do not accept overrides from the prompt:

| Variable | Meaning |
| --- | --- |
| `ESCARLET_SITE` | Brand/site for every call. If unset and `workspace.context.get` returns more than one brand, stop and report the options. |
| `SHIFT_CONTENT_CHANNELS` | Channels to publish. Currently `instagram`. |
| `SHIFT_CONTENT_AUTOPUBLISH` | `true` authorizes `recipe.autonomous-content` publication with `automation.enabled/confirmed/publish: true`. Any other value: stop at `ready_for_review`. |

`idempotencyKey`: `shift-<channel>-<YYYY-MM-DD>` (local date). Reuse it on
every retry of the same day.

## 1. Preflight

1. Confirm the `escarlet` MCP tools are available and
   `workspace.context.get` / `brand.context.get` succeed for `ESCARLET_SITE`.
2. `content.post.list` for today: if a post with today's `idempotencyKey`
   (or created today by this job) exists, resume it instead of creating a new
   one; if it is already `published` or `scheduled`, stop.

## 2. Pick the topic (Shift truth only)

Sources, in this order, read-only from `/workspace/shift` (never edit, commit
or push the repo from this job):

1. `.github/project-management/STATUS_REVIEW.md` and `IMPLEMENTATION_STATUS.md`.
2. PRs merged into `main` in the last 14 days (`gh pr list --state merged`).
3. `README.md`, then `docs/EN/**` only when cross-checked against 1–2.

Rules:
- Claim only capabilities the status docs or merged code show as implemented.
  Roadmap items must be labeled as such.
- No invented numbers, users, partners, quotes, prices, token value,
  returns or financial promises. No contract addresses, keys or internal URLs.
- Keep Shift terminology (communities, valuable actions, engagements,
  governance) consistent with the repo.
- Vary angles: check Hermes memory for the last topics used by this job and
  avoid repeating one within 14 days. Then run `content.topic.check`; if
  `isOriginal: false`, pick another angle.

## 3. Copy

Write in the brand voice from `brand.voice.get` / `brand.rules.get`
(language per Brand Kit). Validate with `copy.validate` and fix blocking
findings before continuing.

## 4. Create, generate media, upload

1. `recipe.run` with `recipeId: recipe.autonomous-content`, `site`, `topic`,
   `title`, `text`, `channels: ["instagram"]`, the Instagram `socialPack`
   (captions + slides) and `idempotencyKey`. Keep `postId` and every
   `generationTasks[].preparationId`.
2. For each generation task, call `image_generate` with exactly the returned
   `generationPrompt` and references, 1080x1350, with the approved slide text
   rendered in the image. Save the file locally.
3. Upload each file with the helper (keeps the bytes out of the model
   context; check `capability.get asset.upload` for the exact field names):

   ```bash
   /opt/shift-hermes/scripts/escarlet-mcp.py call asset.upload \
     --args '{"site":"'"$ESCARLET_SITE"'","postId":"<postId>","preparationId":"<id>","kind":"social","channel":"instagram","assetIndex":0,"textRendered":true,"templateId":"editorial","renderedBy":"chatgpt-image-generation","textContent":{"headline":"…","body":"…"}}' \
     --file contentBase64=/path/to/slide-0.png
   ```

   Keep each returned `assetId`. If the tool name differs, list tools with
   `escarlet-mcp.py tools`.

## 5. Publish (policy-gated)

- `SHIFT_CONTENT_AUTOPUBLISH=true`: resume `recipe.run` with `postId`,
  `mediaAssetIds`, `prepareMedia: false`, `publish: true` and
  `automation: {enabled: true, confirmed: true, publish: true}`.
- Otherwise resume without `publish` and leave it `ready_for_review`.
- Then `publication.status.get` / `content.post.get` until a terminal state.
  `awaiting_provider`, `unknown` or `failed` is not success.

## Stop conditions

Stop without publishing, and report why, when: brand is ambiguous; Brand Kit
preparation is blocked or stale; image generation or upload failed; copy
validation still blocks; the token lacks `content:publish`; or any step
returns an error you cannot resolve with the same `idempotencyKey`. Never
create a second post for the same day.

## Report and learn

End with: date, topic, `postId`, `postUrl`, `assetId`s, `publicationId`,
final state, and anything blocked. Save the topic and outcome to Hermes
memory so the next runs vary their angle.

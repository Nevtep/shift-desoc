---
name: shift-reels-publishing
description: Use when making a Shift reel or the daily 3-channel post.
---

# Shift reels and daily 3-channel publishing

Companion of `shift-social-content`, versioned in the repo (`hermes-bootstrap/content-skills`) and shipped in the image. The reel template lives in `hermes-bootstrap/shift-reels` and is installed to `/opt/data/shift-reels` on every boot. Daily cycle = one post, three channels: Instagram carousel (`instagram`), X image (`x`) and Instagram reel (`video`). `SHIFT_CONTENT_CHANNELS=instagram` in the env is legacy: it does not remove `x` or the reel. `SHIFT_CONTENT_REELS=false` skips only the reel. Publishing is automatic only when `SHIFT_CONTENT_AUTOPUBLISH=true`; outside the daily job never publish without the user's go-ahead.

## Design rules (permanent, from Carlos, brand design)
- Never draw lines, bars, rules or dashes as decoration (no accent bar above headlines, no em or en dashes) in images, slides, videos or copy.
- Every video ends with the Shift logo screen. The logo appears 0.5 s after the cream background is complete so the logo image box never shows (implemented in the template).
- Reels must not all open the same way: `intro.style: auto` rotates `seed`, `sunrise`, `leaves`, `hills`, never repeating the previous one (state in /opt/data/shift-reels/.last_intro_style).
- X images carry the rendered text. Illustrative numbers carry the legend "Ejemplo ilustrativo".
- Carlos wants reels NOT shown on the Instagram profile grid (share_to_feed false). Escarlet's MCP schemas did not expose a field for it as of 2026-10-25 (variant `body` is a free object). Ask Carlos for the field name Codex implemented before using one; do not guess.

## Image style (fixed, mandatory for every image_generate call)
The model never changed (openai/gpt-5.4-image-2 via OpenRouter on every day). The drift from 2026-10-22 came from the daily job improvising its own style words ("paper-craft", "clay maquette", "single everyday object, no people") and passing 1 reference instead of 3 (or none on 10-17 and 10-23). Do not improvise the style. Every Shift image prompt (carousel slides, X image, reel backgrounds) is `STYLE_BLOCK` + subject + text + rules, and ALWAYS carries these 3 references in `reference_image_urls`:
- https://cms.escarlet.design/media/shift/reference/shift-visual-guide.png
- https://cms.escarlet.design/media/shift/reference/nosotros_bg.png
- https://cms.escarlet.design/media/shift/reference/solutions-reputation.png

STYLE_BLOCK: "Warm solarpunk editorial illustration in the Shift visual system: hand-painted gouache and flat vector look with soft gradients and gentle paper grain, stylized friendly diverse people with simple faces, community landscapes (hills, shared gardens, rivers, wind turbines, community tables), warm golden light. Cream #E9E3D6 background with sage #7C8F62, olive #5F704A, mustard #CFA63D, terracotta #D88F43, charcoal #3F3B34. Follow the three attached references as mandatory grounding for style, palette, materials and tone. NEVER photorealistic, NEVER 3D render, NEVER clay, maquette or miniature, no glossy objects, no still life of a single object. Never reproduce any logo."

Subject rule: a human scene or landscape that expresses the idea (anonymous neighbors, hands, gardens, tables, rivers); metaphors are fine, product-shot objects are not. Composition: tall 9:16 canvas, content in the central 60 percent of the height, top and bottom 20 percent plain cream; crop to 4:5 with a centered crop (`crop=iw:iw*5/4:0:(ih-iw*5/4)/2`). Text rendered in the image: serif bold headline in charcoal plus sans body, exact Spanish copy. Closing rules: "No lines, bars, rules, underlines or dashes as decoration, no logos, no extra text." Reel backgrounds: same STYLE_BLOCK, text-free, very low contrast, subject in the lower 55 percent. After generating, look at the image against the references; regenerate if it reads as 3D, clay or photo.

## Reel pipeline (/opt/data/shift-reels, README there)
1. `python3 scripts/post_to_spec.py <post.json> --out examples/<slug>/` (post.json = `content.post.get` structured content), then edit `spec.json`: titles <= 32 chars, bodies <= 110, claims identical to the post, roadmap labeled, a `visual` per step (`bars` with `"dots": false` for policies, `points`, `thread`, `document`), `cardNote: "Ejemplo ilustrativo"` when numbers are illustrative, `"music": {"track": "auto"}` (Suno tracks in public/music/tracks.json, -20 LUFS, fades), `intro.style: "auto"`.
2. Four text-free backgrounds with `image_generate` (portrait, Brand Kit guide https://cms.escarlet.design/media/shift/reference/shift-visual-guide.png as reference, subject in the lower 55%), saved as bg0.jpg..bg3.jpg (1080x1920) next to spec.json.
3. `python3 scripts/make_reel.py <spec> --validate-only`; optional `--preview f1,f2`; full render in the background with nohup from a script file (cron blocks inline loops and `2>&1`): `python3 scripts/make_reel.py <spec> --out /opt/data/outputs/reels/<slug>`. It takes 10 to 30 min; poll manifest.json with sleep <= 400. Outputs `reel.mp4`, `reel_cms.mp4` (2 cover frames prepended, with audio), manifest. Black-rectangle frames from the software GL are detected and repaired automatically.
4. Upload in the background: `python3 scripts/upload_reel.py <reel_cms.mp4> shift-<slug>-<date> <slug>.mp4`, poll `<reel_cms.mp4>.upload.json` (about 5 min) for `id`. It uses `production.video.upload` in 192000-byte chunks via scripts/escarlet_mcp_full.py (run as an executable, not with python3: it needs the Hermes venv).
5. `content.post.variant.upsert` channel `video` (never `instagram`), body `{format: "reel", caption, cta: "Conoce Shift"}`, `mediaAssetIds: [id]`; then `content.post.approve` (no `channels` argument).
6. Publish: `recipe.run` recipe.autonomous-content with `postId`, `channels: ["video"]`, `mediaAssetIds: {"video": [id]}` (object keyed by channel), `prepareMedia: false`, `publish: true`, `automation: {enabled, confirmed, publish: true}`, optional `publicationDate` ISO UTC plus `timezone: "UTC"`, and a stable `idempotencyKey`. Do not use `release.create` for existing posts (it creates an empty post).

## Video channel limit (confirmed 2026-11-03 and 11-04)
`recipe.autonomous-content.run` rejects `video` with `autonomous_channel_unsupported`, and `publication.route` only offers human_required providers. Do IG+X publish first (channels [instagram, x]), then upload the reel, upsert the `video` variant, `content.post.review` reviewChannels [video], `content.post.approve`, and leave it approved for a human. Do not retry the video publish. Writing scripts: cron blocks heredocs, use write_file; copy-forwarded scripts need sed on slugs/paths.

## Retry rule (duplicates were published on 2026-10-25)
On 2026-10-25 the Instagram carousel and the reel appeared twice on the profile after the job relaunched publication with the same idempotencyKey following an X failure (text over 280 chars). Before ANY second `recipe.run` with `publish: true`: read `content.post.get`, then relaunch with `channels` limited to variants that are `failed` or still `approved` (for example `["x"]`); never include a variant already `scheduled` or `published`. Keep X text <= 280 chars before the first publish. Report `publicationId` if returned, else the variant statuses.

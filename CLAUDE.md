# CLAUDE.md — Curators.AI Engineering Guide
## Last updated: April 14, 2026

---

## Mission

Preserve, access, and amplify human curation. Build equally for curators (capture, share, earn from taste) and subscribers (find trusted curators, discover great recs).

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + RLS + PostgREST)
- **AI:** Anthropic Claude API. SDK 0.80.0. Model ID pinned in `app/api/chat/route.js`: `claude-sonnet-4-20250514`
- **Hosting:** Vercel, auto-deploys from GitHub main (~60s)
- **Email:** Resend
- **Styling:** Inline styles only, no Tailwind
- **Markdown rendering:** `react-markdown` v10, no GFM plugin (plain CommonMark only)
- **No local dev environment.** All changes deploy directly to production via GitHub → Vercel.

---

## Vocabulary (enforce everywhere: code, prompts, UI, comments)

- "subscribe" not "follow"
- "curator" not "user" or "creator"
- "taste" not "preferences"
- "recommendations" or "recs" not "content" or "posts"

---

## Key Development Rules

1. **Read files before editing.** Always `cat` current state first.
2. **No silent catch {}.** Always surface errors explicitly.
3. **No Supabase join aliases.** Use two-step queries instead.
4. **After new DB columns/tables:** run `NOTIFY pgrst, 'reload schema'` in Supabase SQL Editor. PostgREST silently drops unknown columns without this.
5. **No em dashes** in AI skill files, prompt text, or AI output.
6. **Verify column existence** before writing queries against unfamiliar tables.
7. **Add RLS policies** for new write operations.
8. **Deploy one change at a time.** Each deploy independently testable on iPhone Safari.
9. **Descriptive commit messages.**
10. **Hard refresh Safari** after deploys.

---

## Architecture

### Rec Storage

Two tables — parent/child, both active:
- `recommendations` — flat queryable metadata (title, slug, category, tags, context, links, visibility, profile_id, rec_file_id)
- `rec_files` — canonical structured content blocks (body_md, work, curation, source, provenance, extraction, visibility). See `docs/rec-files-migration.md`.

**`recommendations.created_via`** (analytics-only, not UI) tags each save with its origin — `quick_capture_url|paste|upload`, `chat_rec_block`, `chat_save_from_url|image|taste_read`, `backfill`, or `unknown`. Populated in `addRec` from `item.createdVia`; QCS reads `initialData.createdViaOverride` to distinguish chat-originated saves from direct QCS tab saves.

**`recommendations.image_url` + `rec_files.work.image_url`** are populated on every new save (Deploy 1 of 3 for image_url feature, 2026-04-15). Source: parser's `metadata.thumbnailUrl` normalized onto the `parsedPayload.image_url` envelope at each of 6 constructors (parse-link / paste / upload / QCS / CuratorContext re-parse / ChatView chat-parse); upload mode writes `artifact://<sha256>`. Read via `extractImageUrl(parsedPayload)` in `lib/agent/parsers/extract-image.js`. No backfill.

**Gated thumbnail UI** (Deploy 2 of 3, 2026-04-15) ships thumbnails in rec lists + rec detail pages for viewers with handle `shamal` or `chris`. Gate: `canSeeThumbnails(viewerHandle)` in `lib/feature-flags.js`, overridable per-session via `?thumbs=1` / `?thumbs=0` query param. Viewer handle exposed by both CuratorContext and VisitorContext as `viewerHandle`; `lib/hooks/useViewerHandle.js` reads whichever is active. Parallel-shipped components `RecThumbnail` + `RecCardWithThumbnail` — existing `RecCard` is untouched. Artifact (`artifact://`) image URLs resolve via `lib/hooks/useArtifactSignedUrl.js`.

**Dual-write is unconditional.** Every URL/paste/upload save writes to both tables. Gate: `if (item.parsedPayload)` in `addRec` (CuratorContext.jsx ~line 310). Failures logged, never thrown. All 30 production rows have `rec_file_id` populated as of 2026-04-11.

**Capture flow:** `parse-link / paste / upload` route → `parsedPayload` envelope → client → `addRec` → `recommendations` insert → `ingestUrlCapture` → `rec_files` insert → `recommendations.rec_file_id` update.

**buildRecFileRow** (`lib/rec-files/build.js`) is the single source of truth for the `rec_files` row shape.

**Feature B (chat image → rec):** Camera in ChatView → `/api/chat` vision inference → `save_image_rec:<sha>` action button → QCS prefill → `/api/recs/upload`. `maxDuration = 60` on both routes. Client-side resize to 1600px / JPEG 0.85 keeps payload under Vercel's 4.5MB serverless body limit. Upload `body_md` is just `![Uploaded image](artifact://<sha>)`; title/why render above Archived Source, not inside it.

**RecDetail section order:** Your Take / Why → Links → Archived Source (body_md) → Tags. Applies to all three variants (Curator/Visitor/Network).

**Archived Source (RecDetail.jsx):** `ArchivedSource` renders `body_md` as ReactMarkdown in a collapsible block below Links, with client-side .md download. Custom `img` renderer (`ArtifactImage`) resolves `artifact://<sha256>` URLs via Supabase signed URLs (7-day TTL); react-markdown v10's `urlTransform` is overridden to whitelist the `artifact://` protocol. Hidden when `extraction.lossy === true` or the extractor is in `THIN_SOURCE_TYPES` (media embeds whose body_md just restates metadata).

**Curator + Visitor context secondary load** merges `body_md`, `extraction`, `work`, `curation_block`, `curator_is_author` from rec_files onto each tasteItem after the recommendations fetch. Null-safe. Both `CuratorContext` and `VisitorContext` use the same pattern. Both also map `profile_id` onto each tasteItem so rec detail components can pass the rec owner's UUID to `ArtifactImage` (required for signed URL path construction).

`updateRec` syncs `rec_files.curation` (why, tags) and `rec_files.work` (title, category) after every edit. Logs `[UPDATE_REC_FILE]` on success, `[UPDATE_REC_FILE_ERROR]` on failure. Added April 13 2026.

### Chat Route (app/api/chat/route.js)

**Modes:** Onboarding (< 3 recs OR no bio) | Standard (3+ recs AND bio) | Visitor (another curator's /ask page).

Both onboarding and standard inject `getSubscribedRecs(profileId)` network context into the system prompt.

**Link handling:** Synchronous. Up to 3 URLs parsed concurrently (15s timeout) before Claude responds. Quality signals (FULL/PARTIAL/FAILED) injected as `=== PARSED LINK CONTENT ===` blocks. Parsed content persisted on `chat_messages.parsed_content` and re-injected within a 5-message window via `distillForReinjection` (~800 chars/block, capped at 2 blocks). **Re-injection path:** Checks `rec_refs` on recent messages -- if present, fetches `rec_files` rows and injects structured blocks via `buildRecFileContextBlock` (`lib/chat/link-parsing.js`). No fallback to `parsed_content` -- if `rec_refs` is empty, re-injection is skipped. The `parsed_content` fallback was removed April 13 2026.

**Taste-read re-injection cap:** fixed April 13 2026. `parsed.content` capped at 40K chars before injection into systemPrompt, matching the primary parse path.

**Chat-parsed URLs:** `ingestChatParsedBlocks` (`lib/chat/chat-parse-ingest.js`) writes a `rec_files` row (`extractor: chat-parse@v1`, `visibility: private`, `confirmed: false`) and populates `chat_messages.rec_refs` for each successfully parsed URL. Awaited with 2s timeout before response returns. These rows are ephemeral scratch records -- they exist for re-injection context, not as canonical archive entries.

**Chat-save promotion flow:** When a curator saves a `chat-parse@v1` URL, `addRec` synchronously re-fetches via `/api/recs/parse-link` for a fresh `webpage@registry` payload, then `/api/recs/promote-chat-parse` marks the scratch row confirmed, then `ingestUrlCapture` writes the canonical `rec_files` row. `recommendations.rec_file_id` always points to the registry row. Re-parse failure falls back to the chat-parse payload. **Re-parse logic lives in `addRec` only** — no other UI surface should re-parse.

**draftWhyFromConversation** (ChatView.jsx) extracts the curator's own words from recent chat history to prefill the "why" field. Skips URL-only messages (`/^https?:\/\/\S+$/`), messages shorter than 15 chars after URL removal, and meta-actions (save/skip buttons). Truncates at 200 chars on a word boundary.

**Rec capture:** AI emits `[REC]{...}[/REC]` JSON. `validateRecContext` strips metadata pollution, falls back to last substantive user message (skips pure affirmations).

**Action buttons:** Feature B (`save_image_rec:<sha256>`) and Feature C (`save_rec_from_chat:<url>`). Suppressed if `[REC]` block also emitted in same turn.

**REC_LINK sentinel:** Rec lines in network context carry `[REC_LINK: /<handle>/<slug>]`. Prompt instructs AI to render as markdown links. Canonical rec URL: `/{handle}/{slug}`.

### AI Skills System

15 skill files in `lib/prompts/skills/`. Build functions: `buildOnboardingPrompt` and `buildStandardPrompt` in `lib/prompts/`. Both append `SUBSCRIPTION_GROUNDING_RULE` (must stay in sync between the two files).

**rec-capture.md skill:** Save threshold evaluation is cumulative across the conversation. Once a descriptor is given in any message, threshold is met -- no further clarifying questions permitted. AI-005 (`docs/ai-behavior-issues.md`) tracks the multi-question drilling failure mode.

### Taste Profile Pipeline

Generated by `lib/taste-profile/generate.js` via `POST /api/generate-taste-profile`. Auto-regenerates after every rec save (3+ rec threshold, fire-and-forget from ChatView.jsx). Enriched from `rec_files` — prefers `work.title`, `work.authors`, `work.site_name`, `curation.why`, `curation.tags`, `curation.conviction` over legacy `recommendations` columns. `sources.generated_from` = `'rec_files+recommendations+subscriptions+confirmations'`. Stats section includes a "N taste signals confirmed or corrected" bullet. `taste_profiles.sources` breaks out `taste_read_confirmed_count` and `taste_read_corrected_count` from the total `confirmation_count`.

**Visitor AI personality** reads `taste_profiles.content` (not the deprecated `profiles.style_summary`). `lib/taste-profile/parse.js` exposes `extractPublicSections(content)` (strips `## Curators They Subscribe To` onward) and `extractVoiceAndStyle(content)` (the `## Voice & Style` body). Visitor path in `app/api/chat/route.js` injects public sections as taste context and Voice & Style as a voice directive; falls back to a neutral default when no profile exists. `profiles.style_summary` is deprecated as of 2026-04-15 — all readers/writers removed; column drop scheduled via `migrations/20260415_drop_style_summary_from_profiles.sql` after ~24h of clean prod logs.

### Taste Read v2 (shipped April 14, 2026 across deploys 2.0-2.4)

**What it is:** Per-URL taste reads that produce structured extraction + 2-3 atomic inferences. Curator confirms, refines, or ignores each inference. Confirmed/refined inferences feed the taste profile via `taste_confirmations`. Ignored inferences are logged only.

**Key files:**
- `lib/prompts/skills/taste-read.md` — the skill. Outputs JSON `{extraction, inferences: [{id, text}]}`.
- `app/api/taste-read/route.js` — GET (hydrate from DB) + POST (generate or cache hit). Model pinned to `claude-sonnet-4-20250514`, max_tokens 1500, temp 0.7, maxDuration 30.
- `app/api/taste-read/confirm/route.js` — POST (write) + DELETE (undo).
- `app/api/taste-read/refine/route.js` — POST (write) + DELETE (undo).
- `app/api/taste-read/ignore/route.js` — POST (write) + DELETE (undo).
- `app/api/taste-read/state/route.js` — PATCH for UI state sync (states, refined_texts, collapsed, dismissed, done).
- `components/taste-read/TasteReadCard.jsx` — card component. Module-level cache is render-speed only; server is authoritative.
- `components/feed/FeedBlockGroup.jsx` — renders `taste_read_card` block type.

**Database:**
- `taste_reads` — new table. Stores extraction, inferences (jsonb), per-inference states, refined_texts, collapsed, dismissed, done. Partial unique indexes on `(profile_id, source_url) WHERE rec_file_id IS NULL` and `(profile_id, rec_file_id) WHERE rec_file_id IS NOT NULL`. RLS enabled.
- `taste_read_ignores` — new table. Ignored inferences log, curator-only.
- `taste_confirmations` — existing. New source format: `taste_read:<url_or_rec_file_id>` and `taste_read:<key>|refined_from:<original>`. Legacy `chat:<msgId>` rows from pre-v2 left as-is (both formats supported).

**Flow:** Curator pastes URL in chat → taps "Taste read" button → chat route emits `taste_read_card` block with parsed content payload → TasteReadCard on mount checks in-memory cache → GET `/api/taste-read` → 404 triggers POST (Claude call + INSERT) → card renders extraction + inferences. State transitions PATCH fire-and-forget to `/api/taste-read/state` for UI state sync. Confirm/refine/ignore POST to their dedicated endpoints (which write to `taste_confirmations` / `taste_read_ignores` and trigger taste profile regen).

**Done state semantics:** When all inferences resolved, "Done" button appears. Clicking Done sets `done: true, collapsed: true`. Reload hydrates from DB in collapsed summary state. Tap-to-expand shows finalized view (Undo links active, no Confirm/Refine/Ignore buttons). Any Undo from done state flips `done: false` server-side — card becomes live again.

**Dismiss state:** Sticky via DB. Dismissed cards render null on mount. Only available when no inferences are resolved.

**Action buttons:**
- `save_rec_from_taste_read:<url>` — from TasteReadCard footer. ChatView handler routes to `handleSaveFromChat(url, { skipWhyDraft: true })` — QCS opens with blank why field (taste read context is not the curator's why).
- `save_rec_from_chat:<url>` — from pre-taste-read three-button row. Unchanged from Feature C.

**What's NOT wired yet:**
- QuickCaptureSheet integration (TasteReadCard rendering after URL/paste save). Deferred per Option Y (portal/modal at page level after QCS closes).
- Taste Timeline UI (/me/timeline) — SHIPPED April 14. See Taste Timeline section below.

**Log markers:** `[TASTE_READ_V2]` (main read), `[TASTE_READ_CONFIRM]` / `[TASTE_READ_REFINE]` / `[TASTE_READ_IGNORE]` (writes), `[TASTE_READ_CONFIRM_UNDO]` / `[TASTE_READ_REFINE_UNDO]` / `[TASTE_READ_IGNORE_UNDO]` (deletes), `[TASTE_READ_STATE_PATCH]` (UI state sync).

### Taste Timeline (shipped April 14, 2026)

Curator-only audit trail at `/me/timeline`. Shows every signal that shaped the taste profile in reverse chronological order, grouped by local date. Entry point: "How this was built →" link in Me tab below Stats section (`TasteFileView.jsx`).

**Key files:**
- `app/api/timeline/route.js` — GET, cursor-paginated 50/page. Merges taste_confirmations (confirmed + corrected), taste_read_ignores (fetched, filtered from UI), and recommendations. Parses taste_read source field format. Two-step Supabase queries throughout.
- `app/(curator)/me/timeline/page.js` — auth-guarded page. Note .js not .jsx (project convention).
- `components/me/TasteTimeline.jsx` — timeline UI. Uses T constants for theming. Groups by local date. Type labels: "Taste read · confirmed/corrected", "Your Recommendation" (rec_is_own: true), "Saved Recommendation" (rec_is_own: false, deferred).

**Event types:** confirmed (green #1D9E75), corrected (amber #BA7517, shows struck-through original + corrected), ignored (stored in DB, filtered from UI), rec_saved with rec_is_own: true (blue, "Your Recommendation"), rec_is_own: false (purple, "Saved Recommendation" — deferred until saved_recs wired).

**Log markers:** [TIMELINE], [TIMELINE_ERROR]

### Inviter Pipe & Auto-subscribe

`getInviterContext` in `lib/chat/inviter-context.js` — three independent `.maybeSingle()` lookups so one failure doesn't wipe the rest. Auto-subscribe route: `app/api/onboarding/auto-subscribe/route.js` — service-role, idempotent, race-safe (treats `23505` as success), non-blocking.

---

## What's Not Wired Yet

- `buildSubscriberPrompt`: skill file exists, no build function or route wiring
- Visitor prompt not extracted to skill system
- AI web search for link lookup
- Taste Read v2: QuickCaptureSheet integration deferred (Option Y, portal/modal at page level after QCS closes)
- Taste Timeline: ignored events stored in DB but not shown in UI — future consideration
- Taste Timeline: Saved Recommendation type (rec_is_own: false) — deferred until saved_recs table is wired into timeline API
- Taste-read re-injection overflow: lines 360-400 in chat route bypass the 40K cap (same class as YouTube bug) — not yet fixed

---

## Email Notification System

**Subscriber notifications (Phase 1):** Real-time email to active account-holder subscribers when a curator saves a public+approved rec. Fire-and-forget from `addRec` → `POST /api/notify/new-rec`, never blocks the save. Trigger gate reads the DB-returned row (not the client object). Recipients: `subscriptions` where `unsubscribed_at IS NULL` and `profiles.new_rec_email_enabled = true`; email looked up via `supabase.auth.admin.getUserById(auth_user_id)`. Unsubscribe is token-based (`generateEmailToken(... 'unsubscribe', { type: 'new_rec_email' })`) and flips `profiles.new_rec_email_enabled`. Logged as `notification_log` rows with `type='new_rec_realtime'`.

Pure email subscribers (`subscribers` table) and rich content (authors/thumbnails/excerpts) deferred.

Key files: `app/api/notify/new-rec/route.js`, `lib/email-templates.js` (`newRecEmail`), `app/api/email-action/route.js` (`new_rec_email` branch).

---

## Key Log Markers

Primary filters (grep on these when debugging end-to-end flows): `[TASTE_READ_V2]`, `[TIMELINE]`, `[rec-files]`, `[chat-parse-ingest]`, `[taste-profile]`, `[NOTIFY_NEW_REC]`, `[INVITER_CONTEXT]`, `[AUTO_SUBSCRIBE]`, `[UPDATE_REC_FILE]`.

Each area has a matching `_ERROR` / `_FAILED` / `_UNDO` variant — grep the code for the full set when you need it.

---

## Source Parsers (lib/agent/parsers/)

9 parsers: Spotify, Apple Music, YouTube, SoundCloud, Letterboxd, Goodreads, Google Maps, Twitter/X, Generic Webpage (Defuddle — universal fallback). Instagram and Bandcamp deferred.

---

## Key File Paths

Non-obvious load-bearing files. Everything else is findable by Glob.

app/api/chat/route.js                      -- mode detection, link handling, rec extraction
lib/prompts/onboarding.js, standard.js     -- system prompt builders (both carry SUBSCRIPTION_GROUNDING_RULE)
lib/prompts/loader.js                      -- skill loader with cache
lib/chat/inviter-context.js                -- getInviterContext
lib/chat/network-context.js                -- getSubscribedRecs + REC_LINK sentinel
lib/chat/link-parsing.js                   -- distillForReinjection
lib/chat/chat-parse-ingest.js              -- chat URL → rec_files ingest, rec_refs writer
context/CuratorContext.jsx                 -- addRec dual-write, chat-save promotion, secondary rec_files load
components/chat/ChatView.jsx               -- chat UI, rec save, taste profile regen trigger
components/recs/RecDetail.jsx              -- CuratorRecDetail / VisitorRecDetail / NetworkRecDetail
components/recs/ArtifactImage.jsx          -- resolves artifact:// URLs to signed URLs (7-day TTL)
lib/rec-files/build.js                     -- buildRecFileRow, single source of truth for rec_files shape
lib/rec-files/ingest.js                    -- ingestUrlCapture, dual-write entry point, never throws
lib/taste-profile/generate.js              -- taste profile generation
lib/email-templates.js                     -- newSubscriberEmail, weeklyDigestEmail, agentCompletionEmail, newRecEmail
lib/email-tokens.js                        -- generateEmailToken, validateEmailToken, markTokenUsed
app/api/email-action/route.js              -- token-based dispatch (unsubscribe, save_rec, update_settings)
components/taste-read/TasteReadCard.jsx    -- hydrate, render, confirm/refine/ignore/undo, done/dismiss
components/me/TasteTimeline.jsx            -- timeline UI (grouped by local date)
scripts/backfill-rec-files.mjs             -- backfill: --curator <handle> | --all --live

---

## Schema Reference

Full schema with column types: `docs/schema.md`
Rec files migration history and architecture decisions: `docs/rec-files-migration.md`

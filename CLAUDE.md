# CLAUDE.md — Curators.AI Engineering Guide
## Last updated: April 13, 2026

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

**Dual-write is unconditional.** Every URL/paste/upload save writes to both tables. Gate: `if (item.parsedPayload)` in `addRec` (CuratorContext.jsx ~line 310). Failures logged, never thrown. All 30 production rows have `rec_file_id` populated as of 2026-04-11.

**Capture flow:** `parse-link / paste / upload` route → `parsedPayload` envelope → client → `addRec` → `recommendations` insert → `ingestUrlCapture` → `rec_files` insert → `recommendations.rec_file_id` update.

**buildRecFileRow** (`lib/rec-files/build.js`) is the single source of truth for the `rec_files` row shape.

**Feature B (chat image → rec):** Camera button in ChatView → canvas resize to 1600px / JPEG 0.85 → `/api/chat` route uploads to artifacts bucket, runs vision inference, returns `image_rec_candidate` + `save_image_rec:<sha>` action button → curator taps → QuickCaptureSheet opens in upload mode prefilled with artifact ref + inferred title/category/why → saves via JSON path of `/api/recs/upload`. Route config: `maxDuration = 60` on both `/api/chat` and `/api/recs/upload` to accommodate the two-Claude-call pipeline. Client-side resize required to stay under Vercel's 4.5MB serverless body limit. Upload body_md contains only `![Uploaded image](artifact://<sha>)` -- title and why render above the Archived Source section, not duplicated inside it.

**RecDetail section order:** Your Take / Why → Links → Archived Source (body_md) → Tags. Applies to all three variants (Curator/Visitor/Network).

**Archived Source (RecDetail.jsx):** `ArchivedSource` component renders `body_md` as ReactMarkdown in a collapsible section below Links. Collapsed by default. Includes client-side .md download via Blob. Body renders via `react-markdown` with a custom `img` renderer (`ArtifactImage`) that resolves `artifact://<sha256>` URLs to Supabase signed URLs (7-day TTL). `urlTransform` override whitelists the `artifact://` protocol (react-markdown v10's `defaultUrlTransform` strips non-standard protocols by default). Archived Source is hidden when (a) `extraction.lossy === true` (backfilled recs with synthesized body_md) or (b) the extractor name matches `THIN_SOURCE_TYPES` (spotify, apple-music, youtube, soundcloud, letterboxd, goodreads, google-maps, twitter -- media embeds whose body_md is just restated metadata). Shown for webpage@registry, chat-parse@v1, paste@v1, upload@*, and any other substantive capture.

**Curator + Visitor context secondary load** merges `body_md`, `extraction`, `work`, `curation_block`, `curator_is_author` from rec_files onto each tasteItem after the recommendations fetch. Null-safe. Both `CuratorContext` and `VisitorContext` use the same pattern. Both also map `profile_id` onto each tasteItem so rec detail components can pass the rec owner's UUID to `ArtifactImage` (required for signed URL path construction).

`updateRec` syncs `rec_files.curation` (why, tags) and `rec_files.work` (title, category) after every edit. Logs `[UPDATE_REC_FILE]` on success, `[UPDATE_REC_FILE_ERROR]` on failure. Added April 13 2026.

### Chat Route (app/api/chat/route.js)

**Modes:** Onboarding (< 3 recs OR no bio) | Standard (3+ recs AND bio) | Visitor (another curator's /ask page).

Both onboarding and standard inject `getSubscribedRecs(profileId)` network context into the system prompt.

**Link handling:** Synchronous. Up to 3 URLs parsed concurrently (15s timeout) before Claude responds. Quality signals (FULL/PARTIAL/FAILED) injected as `=== PARSED LINK CONTENT ===` blocks. Parsed content persisted on `chat_messages.parsed_content` and re-injected within a 5-message window via `distillForReinjection` (~800 chars/block, capped at 2 blocks). **Re-injection path:** Checks `rec_refs` on recent messages -- if present, fetches `rec_files` rows and injects structured blocks via `buildRecFileContextBlock` (`lib/chat/link-parsing.js`). No fallback to `parsed_content` -- if `rec_refs` is empty, re-injection is skipped. The `parsed_content` fallback was removed April 13 2026.

**Taste-read re-injection cap:** fixed April 13 2026. `parsed.content` capped at 40K chars before injection into systemPrompt, matching the primary parse path.

**Chat-parsed URLs:** `ingestChatParsedBlocks` (`lib/chat/chat-parse-ingest.js`) writes a `rec_files` row (`extractor: chat-parse@v1`, `visibility: private`, `confirmed: false`) and populates `chat_messages.rec_refs` for each successfully parsed URL. Awaited with 2s timeout before response returns. These rows are ephemeral scratch records -- they exist for re-injection context, not as canonical archive entries.

**Chat-save promotion flow:** When a curator saves a URL from chat, `addRec` (CuratorContext.jsx) runs three steps sequentially: (1) If `parsedPayload.extractor === 'chat-parse@v1'`, synchronously re-fetches the full article via `POST /api/recs/parse-link` to get a fresh `webpage@registry` payload with complete body_md. Original canonical_url is snapshotted as `chatParseUrl` before substitution. (2) `POST /api/recs/promote-chat-parse` marks the chat-parse@v1 scratch row `confirmed=true` (bookkeeping only, keyed on `chatParseUrl`). (3) `ingestUrlCapture` creates the canonical `rec_files` row from the fresh registry payload. `recommendations.rec_file_id` always points to the webpage@registry row. Re-parse failure falls back to chat-parse payload gracefully. Re-parse logic lives in `addRec` only -- no UI surface should re-parse independently.

**draftWhyFromConversation** (ChatView.jsx) extracts the curator's own words from recent chat history to prefill the "why" field. Skips URL-only messages (`/^https?:\/\/\S+$/`), messages shorter than 15 chars after URL removal, and meta-actions (save/skip buttons). Truncates at 200 chars on a word boundary.

**Rec capture:** AI emits `[REC]{...}[/REC]` JSON. `validateRecContext` strips metadata pollution, falls back to last substantive user message (skips pure affirmations).

**Action buttons:** Feature B (`save_image_rec:<sha256>`) and Feature C (`save_rec_from_chat:<url>`). Suppressed if `[REC]` block also emitted in same turn.

**REC_LINK sentinel:** Rec lines in network context carry `[REC_LINK: /<handle>/<slug>]`. Prompt instructs AI to render as markdown links. Canonical rec URL: `/{handle}/{slug}`.

### AI Skills System

15 skill files in `lib/prompts/skills/`. Build functions: `buildOnboardingPrompt` and `buildStandardPrompt` in `lib/prompts/`. Both append `SUBSCRIPTION_GROUNDING_RULE` (must stay in sync between the two files).

**rec-capture.md skill:** Save threshold evaluation is cumulative across the conversation. Once a descriptor is given in any message, threshold is met -- no further clarifying questions permitted. AI-005 (`docs/ai-behavior-issues.md`) tracks the multi-question drilling failure mode.

### Taste Profile Pipeline

Generated by `lib/taste-profile/generate.js` via `POST /api/generate-taste-profile`. Auto-regenerates after every rec save (3+ rec threshold, fire-and-forget from ChatView.jsx). As of 2026-04-11, enriched from `rec_files` — prefers `work.title`, `work.authors`, `work.site_name`, `curation.why`, `curation.tags`, `curation.conviction` over legacy `recommendations` columns. `sources.generated_from` = `'rec_files+recommendations+subscriptions+confirmations'`.

### Inviter Pipe & Auto-subscribe

`getInviterContext` in `lib/chat/inviter-context.js` — three independent `.maybeSingle()` lookups so one failure doesn't wipe the rest. Auto-subscribe route: `app/api/onboarding/auto-subscribe/route.js` — service-role, idempotent, race-safe (treats `23505` as success), non-blocking.

---

## What's Not Wired Yet

- `buildSubscriberPrompt`: skill file exists, no build function or route wiring
- Visitor prompt not extracted to skill system
- AI web search for link lookup

---

## Email Notification System

**Subscriber notifications (Phase 1, shipped April 13 2026):** Real-time email to all active account-holder subscribers when a curator saves a public+approved rec. Fire-and-forget from `addRec` in `CuratorContext.jsx` → `POST /api/notify/new-rec`. Never blocks the rec save.

- **Trigger:** `data.visibility === 'public' && data.status === 'approved'` check against the DB-returned row (not the client object)
- **Recipients:** `subscriptions` table, `unsubscribed_at IS NULL`, excludes the curator themselves, `profiles.new_rec_email_enabled = true`
- **Email lookup:** `supabase.auth.admin.getUserById(subscriber.auth_user_id)` — uses `auth_user_id`, not `id`
- **Unsubscribe:** Token-based via `generateEmailToken(subscriberId, 'unsubscribe', { type: 'new_rec_email' })`. Dispatched in `email-action/route.js` on `tokenData.payload.type === 'new_rec_email'`. Sets `profiles.new_rec_email_enabled = false`.
- **Idempotency:** No dedup check — trigger fires once per INSERT, duplicate sends not possible in normal flow
- **Log:** `notification_log` rows with `type='new_rec_realtime'`, `status='sent'`
- **Pure email subscribers** (`subscribers` table): deferred until public launch
- **Rich content** (authors, thumbnails, body_md excerpts): deferred to Phase 3

Key files:
- `app/api/notify/new-rec/route.js` — main send route
- `lib/email-templates.js` — `newRecEmail` template (added)
- `app/api/email-action/route.js` — unsubscribe handler (`new_rec_email` branch in GET + POST)

---

## Key Log Markers

`[TASTE_READ_PARSE]`, `[TASTE_READ_TIMING]`, `[TASTE_READ_SLOW]`, `[FEEDBACK_CAPTURED]`, `[PARSED_CONTENT_SAVED]`, `[OPENING_API_ERROR]`, `[OPENING_FALLBACK]`, `[INVITER_CONTEXT]`, `[INVITER_CONTEXT_ERROR]`, `[NETWORK_CONTEXT]`, `[NETWORK_CONTEXT_ERROR]`, `[AUTO_SUBSCRIBE]`, `[AUTO_SUBSCRIBE_CLIENT_FAIL]`, `[rec-files] Inserted`, `[rec-files] Insert failed:`, `[rec-files] Unexpected dual-write error:`, `[CONTEXT_LOAD] rec_files secondary load failed:`, `[taste-profile] enriched N of M recs from rec_files`, `[chat-parse-ingest] inserted rec_files row:`, `[chat-parse-ingest] rec_refs written:`, `[chat-route] re-injection via rec_refs:`, `[UPDATE_REC_FILE]`, `[UPDATE_REC_FILE_ERROR]`, `[NOTIFY_NEW_REC]`, `[NOTIFY_NEW_REC_TRIGGER]`

---

## Source Parsers (lib/agent/parsers/)

9 parsers: Spotify, Apple Music, YouTube, SoundCloud, Letterboxd, Goodreads, Google Maps, Twitter/X, Generic Webpage (Defuddle — universal fallback). Instagram and Bandcamp deferred.

---

## Key File Paths
app/api/chat/route.js                      -- chat route, mode detection, link handling, rec extraction
lib/prompts/skills/*.md                    -- 15 AI skill files
lib/prompts/onboarding.js, standard.js     -- system prompt builders (both carry SUBSCRIPTION_GROUNDING_RULE)
lib/prompts/loader.js                      -- skill loader with cache
lib/chat/inviter-context.js                -- getInviterContext
lib/chat/network-context.js                -- getSubscribedRecs + REC_LINK sentinel
lib/chat/link-parsing.js                   -- distillForReinjection
app/api/onboarding/auto-subscribe/route.js -- service-role auto-subscribe
lib/taste-profile/generate.js              -- taste profile generation (rec_files-enriched as of 2026-04-11)
lib/agent/parsers/*.js + registry.js       -- 9 source parsers
components/chat/ChatView.jsx               -- chat UI, rec save, taste profile regen trigger
context/CuratorContext.jsx                 -- curator state, addRec dual-write, secondary rec_files load
components/recs/RecDetail.jsx              -- CuratorRecDetail / VisitorRecDetail / NetworkRecDetail
components/recs/ArtifactImage.jsx          -- resolves artifact:// URLs to signed URLs on demand (7-day TTL)
lib/rec-files/build.js                     -- buildRecFileRow (single source of truth for rec_files shape)
lib/rec-files/ingest.js                    -- ingestUrlCapture (dual-write entry point, never throws)
lib/chat/chat-parse-ingest.js              -- chat URL → rec_files ingest, rec_refs writer
lib/rec-files/artifact.js                  -- artifact upload helper
lib/features.js                            -- feature flag helpers (no active callers as of 2026-04-11)
app/api/recs/parse-link/route.js           -- URL capture + artifact upload
app/api/recs/paste/route.js                -- paste capture, AI-inferred metadata
app/api/recs/upload/route.js               -- image upload, extraction_mode 'uploaded'
scripts/backfill-rec-files.mjs             -- backfill: --curator <handle> | --all --live
app/api/generate-taste-profile/route.js    -- taste profile API endpoint
app/(curator)/me/                          -- Me section (TasteFileView + Public Profile)
app/[handle]/                              -- visitor profile + /ask page
components/layout/BottomTabs.jsx           -- mobile nav
components/layout/Sidebar.jsx              -- desktop nav
app/api/notify/new-rec/route.js            -- real-time subscriber notification on rec save
app/api/notify/new-subscriber/route.js     -- notification to curator on new subscription
app/api/cron/weekly-digest/route.js        -- weekly digest cron
lib/email-templates.js                     -- email templates (newSubscriberEmail, weeklyDigestEmail, agentCompletionEmail, newRecEmail)
lib/email-tokens.js                        -- generateEmailToken, validateEmailToken, markTokenUsed
app/api/email-action/route.js              -- token-based email action dispatch (unsubscribe, save_rec, update_settings)

---

## Schema Reference

Full schema with column types: `docs/schema.md`
Rec files migration history and architecture decisions: `docs/rec-files-migration.md`

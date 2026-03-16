# Curators.AI — Project Context

## What This Is
Mobile-first web app for tastemakers to capture, structure, and share recommendations via AI chat (Claude API). Live at https://curators.ai

## Tech Stack
- Next.js App Router (React), Supabase (PostgreSQL), Claude API, Vercel
- No TypeScript — plain JavaScript only
- No local dev server — all changes deploy directly via git push to Vercel (~60s)
- All styling is inline (no Tailwind, no CSS modules). Only exception: `<style>` tags in components for responsive CSS classes (media queries)
- Resend v6.9.3 for transactional email (new subscriber alerts, weekly digest)

## Critical Rules (Read First)

### Never Use Silent catch {}
ALWAYS log errors. Silent catches hide bugs for days.
```js
// WRONG
try { ... } catch {}

// CORRECT
try { ... } catch (err) { console.error("context:", err) }
```

### Always Check Schema Before Writing Queries
Before writing any Supabase query, verify the column exists in the schema below. Never assume. The subscriptions table has no `created_at` column — use `subscribed_at` instead.

### Always Reload Schema Cache After Adding Columns
After adding new columns to any Supabase table, ALWAYS run `NOTIFY pgrst, 'reload schema';` in the SQL Editor. Without this, PostgREST silently drops unknown columns on insert — no error thrown, data just disappears.

### Always Add RLS Policies for New Write Operations
Any time a new UPDATE/INSERT/DELETE is added to a table, check that an RLS policy covers it. Supabase silently rejects writes without policies — no error thrown, no rows affected.

### Never Use Supabase Join Aliases
`select("curator:curator_id(id, name)")` returns 400 errors. Always use two-step queries:
```js
// Step 1: fetch IDs
const { data } = await supabase.from("subscriptions").select("curator_id").eq(...)
// Step 2: fetch profiles
const { data: profiles } = await supabase.from("profiles").select("id, name, handle").in("id", ids)
```

### Diagnose From Code, Not Screenshots
Before fixing any layout or behavior bug, cat the relevant file first. Never diagnose from screenshots alone.

### Ask Claude Code to Output Full File Contents
When Claude Code reads a file, explicitly ask "output the full contents as text" — it will summarize otherwise.

### Don't Trust AI for Critical UI Text
For opening messages, greetings, and onboarding copy — hardcode client-side where possible. Don't rely on the AI to follow prompt instructions precisely for user-facing strings.

---

## Directory Structure
```
app/
  (curator)/          # Protected curator routes (requires auth)
    myai/             # AI chat workspace
    recommendations/  # Rec list + detail views
    settings/         # Account settings, invite history
    subs/             # Subscriptions management
    profile/          # Redirects to /[handle]
    invite/           # Invite page
  [handle]/           # Public visitor routes (always public)
    page.js           # → VisitorProfile
    ask/              # → Visitor AI chat
    edit/             # → EditProfile (owner only)
    [slug]/           # → Rec detail page
  api/
    chat/             # Claude API integration + interaction persistence
    auth/             # Signup, callback
    invite/           # Invite code CRUD
    link-metadata/    # URL metadata fetcher
    generate-style-summary/  # AI curator personality
    feedback/         # User feedback
    notify/new-subscriber/   # Email notification on new subscriber
    email-action/     # Signed token handler (unsubscribe, save rec)
    cron/weekly-digest/      # Weekly rec digest cron (Thursdays 2pm UTC)
  email/
    unsubscribed/     # Confirmation page after email unsubscribe
    saved/            # Confirmation page after saving rec from email
  login/, signup/, onboarding/, forgot-password/, reset-password/

components/
  chat/               # ChatView, CaptureCard, ProfileCaptureCard
  feed/               # FeedRenderer, FeedBlockGroup, FeedTextBlock, FeedMediaEmbed, FeedActionButtons, FeedTasteRead, FeedUserBubble, FeedLegacyBubble
  layout/             # CuratorShell, BottomTabs, Sidebar, InviteModal
  visitor/            # VisitorProfile (public profile page)
  screens/            # EditProfile
  recs/               # RecCard, RecDetail, NetworkView, SavedView
  settings/           # SettingsView
  subs/               # SubsView
  fans/               # FansView
  taste/              # TasteManager
  shared/             # CategoryPill, LinkDisplay, Toast
  profile/            # ProfileView

context/
  CuratorContext.jsx  # Curator data, saveProfile, useCurator() hook
  VisitorContext.jsx  # Visitor data for /[handle] routes, refresh()

lib/
  constants.js        # Theme tokens, fonts, category config, feature flags
  supabase.js         # Supabase browser client
  supabase-server.js  # Server-side Supabase client
  resend.js           # Email (Resend) client
  email-tokens.js     # Signed token generate/validate/consume for email actions
  email-templates.js  # HTML email templates (new subscriber, weekly digest)
  agent/
    registry.js       # Source parser registry — detectSource(), getParser()
    parsers/          # One file per source platform
      spotify.js, apple-music.js, youtube.js, google-maps.js,
      letterboxd.js, goodreads.js, soundcloud.js, twitter.js, webpage.js
```

## Key Files

### API Routes
- `app/api/chat/route.js` — Claude API integration, 3 system prompt modes (onboarding, standard, visitor), network recs injection, opening message generation, agent integration (getAgentContext, getAgentResultsForDelivery, processUrlsForAgent), content blocks construction (classifyMediaType, hasEmbeddablePlayer, fetchLinkMetadataForBlocks, buildActionButtons, buildTasteReadBlock)
- `app/api/chat/interaction/route.js` — Persists ActionButton interactions to chat_messages.interactions JSONB. Uses admin client (service role) because chat_messages has no RLS UPDATE policy
- `app/api/link-metadata/route.js` — Fetches title/source from pasted URLs
- `app/api/invite/route.js` — Invite code CRUD (generate, fetch, history, update note)
- `app/api/generate-style-summary/route.js` — AI-generated curator style/personality JSON
- `app/api/notify/new-subscriber/route.js` — Sends new subscriber email via Resend (checks new_subscriber_email_enabled)
- `app/api/email-action/route.js` — Handles signed token URLs from emails (unsubscribe, save rec). Supports GET (browser click) + POST (RFC 8058 one-click)
- `app/api/cron/weekly-digest/route.js` — Vercel cron (Thursdays 2pm UTC). Sends digest of new recs from subscribed curators. Requires CRON_SECRET auth header
- `app/api/agent/process/route.js` — Runs parser + Claude extraction for an agent job. Called by frontend after job creation
- `app/api/agent/check/route.js` — Returns completed unpresented jobs + processing jobs for current user (polling endpoint)
- `app/api/agent/status/route.js` — Returns status of a single agent job (used by polling interval)

### Auth Flow Files
- `app/signup/page.js` — Validates invite code, creates auth user, stores invite_context in localStorage, sets used_at on invite code
- `app/onboarding/page.js` — Creates profile, sets used_by on invite code using invite_id from localStorage
- `app/api/auth/callback/route.js` — Handles both `code` (OAuth) and `token_hash` + `type` (password reset) flows
- `app/reset-password/page.js` — Listens for PASSWORD_RECOVERY event via onAuthStateChange before allowing updateUser()

### Layouts & Routing
- `app/[handle]/layout.js` — Routing logic: logged-in → CuratorProvider + CuratorShell + VisitorProvider; anonymous → VisitorProvider only
- `app/(curator)/layout.js` — Curator-only routes wrapper
- `middleware.js` — Auth protection; visitor routes (/[handle]/*) always public, curator routes require session

### Components
- `components/visitor/VisitorProfile.jsx` — Public profile page. Stats row clickable (toggles recs/subscriptions/subscribers). Bookmarks pulled from CuratorContext directly (NOT useCurator())
- `components/recs/RecCard.jsx` — Shared rec row with category emoji, title, context, date, optional curator handle, optional bookmark
- `components/screens/EditProfile.jsx` — Uses useContext(CuratorContext) directly + useContext(VisitorContext) for refresh
- `components/chat/ChatView.jsx` — Chat UI for curator and visitor. Curator chat uses feed-based rendering (FeedBlockGroup for blocks, FeedLegacyBubble for old messages, FeedUserBubble for user messages). Visitor chat still uses old bubble style. First-time curator opening makes API call with generateOpening:true. Visitor opening uses content-type tags + style summary. Image/screenshot upload (camera icon + paste, base64 to Claude vision API, NOT stored in DB). Agent banner system with polling, deliveredJobIds ref, hasPendingBanner ref, isWaitingForResponse ref. send() accepts optional overrideMsg param for ActionButton auto-send
- `components/layout/BottomTabs.jsx` / `Sidebar.jsx` — Feedback tab shown only for handle === "shamal" (hardcoded)

### Context
- `context/CuratorContext.jsx` — Exposes savedRecIds (Set, never null), saveRec, unsaveRec. isFirstTime = dbLoaded && tasteItems.length === 0 && (!bio || bio starts with "[note"). saveMsgToDb returns inserted row id. Message loading includes id, blocks, interactions fields
- `context/VisitorContext.jsx` — Does NOT expose savedRecIds/saveRec/unsaveRec. Exposes refresh()

---

## Database Schema

### profiles
```
id UUID PK
name TEXT (max 30)
handle TEXT (max 20, unique)
bio TEXT
location TEXT
auth_user_id UUID (references auth.users)
onboarding_complete BOOLEAN
invited_by UUID → profiles(id)
style_summary JSONB
social_links JSONB DEFAULT '{}'
show_recs BOOLEAN
show_subscriptions BOOLEAN
show_subscribers BOOLEAN
ai_enabled BOOLEAN
accept_requests BOOLEAN
crypto_enabled BOOLEAN
wallet TEXT
weekly_digest_enabled BOOLEAN DEFAULT true
new_subscriber_email_enabled BOOLEAN DEFAULT true
last_seen_at TIMESTAMPTZ
created_at TIMESTAMPTZ
```

### recommendations
```
id UUID PK
profile_id UUID FK → profiles(id)
title TEXT
category TEXT  -- watch|listen|read|visit|get|wear|play|other
context TEXT
tags TEXT[]    -- always includes a content-type tag (album, restaurant, book, etc.)
links JSONB    -- [{url, title/label, type}] — check both link.label and link.title
slug TEXT
visibility TEXT (public/private)
status TEXT (approved/archived)
revision INTEGER
earnable_mode TEXT (default: 'none')
created_at TIMESTAMPTZ (immutable)
```

### subscriptions
```
id UUID PK
subscriber_id UUID → profiles
curator_id UUID → profiles
subscribed_at TIMESTAMPTZ   ← USE THIS, not created_at (does not exist)
unsubscribed_at TIMESTAMPTZ (nullable — soft delete)
digest_frequency TEXT DEFAULT 'weekly'
last_notified_at TIMESTAMPTZ
```
⚠️ NO created_at column. Never use .order("created_at") on this table.

### invite_codes
```
id UUID PK
code TEXT (unique) -- format: CURATORS-XXXXXX
created_by UUID → profiles
used_by UUID → profiles  -- set in onboarding (not signup)
inviter_note TEXT
used_at TIMESTAMPTZ      -- set in signup
created_at TIMESTAMPTZ
```
Invite flow: signup sets used_at → onboarding sets used_by (profile doesn't exist at signup time)

### subscribers (legacy email-only)
```
id UUID PK
curator_id UUID → profiles
email TEXT
subscribed_at TIMESTAMPTZ
tier TEXT
digest_frequency TEXT DEFAULT 'weekly'
last_notified_at TIMESTAMPTZ
unsubscribed_at TIMESTAMPTZ
```

### notification_log
```
id UUID PK
type TEXT (new_subscriber | new_rec_digest)
recipient_id UUID → profiles (nullable)
recipient_email TEXT
curator_id UUID → profiles
rec_ids UUID[]
sent_at TIMESTAMPTZ DEFAULT now()
```
RLS: service role only (no client access)

### email_tokens
```
id UUID PK
token TEXT UNIQUE
profile_id UUID → profiles
action TEXT (unsubscribe | save_rec | update_settings)
payload JSONB DEFAULT '{}'
expires_at TIMESTAMPTZ
used_at TIMESTAMPTZ (null until used)
created_at TIMESTAMPTZ DEFAULT now()
```
RLS: service role only (no client access)

### agent_jobs
```
id UUID PK
profile_id UUID FK → profiles(id)
source_type TEXT (spotify, apple_music, youtube, google_maps, letterboxd, goodreads, soundcloud, twitter, webpage)
source_url TEXT
status TEXT (pending, processing, completed, failed)
raw_data JSONB (parser output: { items[], metadata, fetched_at } — item count via raw_data.items.length)
extracted_recs JSONB (Claude extraction: candidate_recs, items_analyzed, article_summary)
taste_analysis JSONB (Claude taste analysis: { taste_thesis, patterns[], genres[], primary_moods[], contexts[], content_breakdown })
error_message TEXT
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
presented_at TIMESTAMPTZ (null until banner clicked and results delivered)
created_at TIMESTAMPTZ
```

### chat_messages
```
id UUID PK
profile_id UUID FK → profiles(id)
role TEXT (user | assistant)
text TEXT
captured_rec JSONB
blocks JSONB (array of content blocks — null for legacy messages)
interactions JSONB DEFAULT '[]' (ActionButton tap records: [{block_index, action, interacted_at}])
created_at TIMESTAMPTZ
```
RLS: Owners can SELECT and INSERT. No UPDATE policy — use service role for updates (e.g. /api/chat/interaction).
⚠️ When blocks is non-null, frontend renders via feed components. When null, renders legacy bubble style.

### Other tables
- saved_recs: id, profile_id, rec_id, created_at
- revisions: id, recommendation_id, revision_number, context, tags, links, created_at

### RLS Policy Checklist
Before adding any new write operation, verify RLS policy exists:
- profiles: Anyone can read, owner can update
- recommendations: Public can read approved+public, owners can CRUD
- chat_messages: Owners can SELECT/INSERT. No UPDATE policy — use /api/chat/interaction (service role) for updates
- subscriptions: auth.uid() IS NOT NULL for SELECT; owners can INSERT/UPDATE
- invite_codes: Anyone can read (SELECT true); owners can INSERT; UPDATE policy exists for setting used_by/used_at
- saved_recs: Owners only
- notification_log: Service role only (no client policies)
- email_tokens: Service role only (no client policies)

---

## Architecture

### Context Model (Critical)
- `useCurator()` returns `visitor || curator` — **always prefers VisitorContext when both are present**
- On /[handle] routes, logged-in users get **both** providers
- **CRITICAL**: VisitorProfile pulls `savedRecIds`/`saveRec`/`unsaveRec` directly from `useContext(CuratorContext)`, NOT from `useCurator()` — VisitorContext doesn't expose these
- EditProfile uses `useContext(CuratorContext)` directly, plus `useContext(VisitorContext)` for refresh

### DB Field Mapping (snake_case → camelCase)
Mapping happens in CuratorContext (4 places) and VisitorContext (1 place). Keep in sync when adding new profile fields:
- show_subscriptions → showSubscriptions
- show_subscribers → showSubscribers
- show_recs → showRecs
- social_links → socialLinks
- ai_enabled → aiEnabled
- accept_requests → acceptRequests
- crypto_enabled → cryptoEnabled
- style_summary → styleSummary
- invited_by → invitedBy

### Three AI System Prompt Modes
1. **Onboarding** — isFirstTime (0 recs + no bio). Uses inviter name + note from getInviterContext(). Opening generated via generateOpening:true API call.
2. **Standard** — Established curator. Rec capture, timeline queries, network recs.
3. **Visitor** — Read-only, channels curator personality via style_summary.

### First-Time Curator Opening Message
- Client calls `/api/chat` with `generateOpening: true`
- Server fetches inviter context via `getInviterContext(profileId)` — queries invite_codes WHERE used_by = profileId
- Falls back to warm hardcoded message on error
- isFirstTime = dbLoaded && tasteItems.length === 0 && (!bio || bio.trim() === '' || bio.startsWith('[note'))

### Password Reset Flow
1. User requests reset → Supabase sends email with token_hash link
2. Link → `/api/auth/callback?token_hash=X&type=recovery&next=/reset-password`
3. Callback calls `supabase.auth.verifyOtp({ token_hash, type })`
4. Redirects to `/reset-password`
5. Page listens for `PASSWORD_RECOVERY` event via `onAuthStateChange` before enabling form

---

## Categories & Tags

### 8 Categories (lib/constants.js CAT object)
| Category | Emoji | Color |
|----------|-------|-------|
| watch | 📺 | #8E80B5 |
| listen | 🎧 | #4B92CC |
| read | 📖 | #CC6658 |
| visit | 📍 | #5E9E82 |
| get | 📦 | #C27850 |
| wear | 🛍️ | #CC7090 |
| play | ⚡ | #D4B340 |
| other | ◆ | #B08860 |

### Content-Type Tags (always include one per rec)
- listen → album, song, podcast, playlist, mix, ep, audiobook
- read → book, article, substack, essay, newsletter, blog post, paper
- watch → film, series, documentary, short film, anime, standup special
- visit → restaurant, bar, cafe, hotel, park, museum, city, neighborhood
- get → app, tool, gadget, gear, product, software
- wear → clothing, shoes, accessories, fashion, beauty
- play → game, sport, activity, hobby, videogame, boardgame

### Feature Flags (lib/constants.js)
- `socialLinks: false` — hides social links in VisitorProfile and EditProfile
- `cryptoTips: false` — hides crypto/wallet fields

---

## Design System

### Theme Tokens (lib/constants.js)
- **T** — Base theme: bg (#131210), ink (#E8E2D6), ink2 (#A09888), ink3 (#6B6258), acc (#D4956B), bdr (#302B25)
- **W** — Workspace/curator chat: cooler blue-shifted palette
- **V** — Visitor AI chat: warm palette
- **F** — 'Manrope', sans-serif (body)
- **S** — 'Newsreader', serif (headings/brand)
- **MN** — 'JetBrains Mono', monospace

### Styling Rules
- All inline styles — no Tailwind, no CSS modules
- `<style>` tags only for responsive media queries
- Dark theme (#131210 base) with warm gold accent (#D4956B)

---

## Invite System
- Format: `CURATORS-XXXXXX`, charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Max 5 unused codes per curator
- Inviter writes a note explaining why they're inviting this person
- Flow: signup validates code + sets used_at → onboarding creates profile + sets used_by
- getInviterContext() fetches note via: `invite_codes WHERE used_by = profileId`

## Style Summary
- Stored as JSONB in profiles.style_summary
- Generated via /api/generate-style-summary at milestones [3, 6, 10, 15, 20 recs]
- styleSummary.voice used in visitor opening message keyword matching

## Vocabulary (Never Break)
- "subscribe" not "follow"
- "curator" not "user/creator"
- "taste" not "preferences"
- "recommendations/recs" not "content/posts"

---

## Agent Pipeline (Magic AI)

Curators drop links → parser extracts items → Claude analyzes taste → results delivered via banner click.

### Parsers (lib/agent/parsers/)
All registered in `lib/agent/registry.js`. `implementedParsers`: spotify, apple-music, youtube, google-maps, letterboxd, goodreads, soundcloud, twitter, webpage.

| Parser | Strategy | Limitations |
|--------|----------|-------------|
| Spotify | Embed page scraping | Works for playlists, albums, tracks |
| Apple Music | serialized-server-data | Works for playlists, albums |
| YouTube | ytInitialData from HTML | Playlists, channels, videos |
| SoundCloud | `window.__sc_hydration` + oEmbed | ~5 tracks from playlists (hydration limit) |
| Letterboxd | Clean HTML scraping | Profiles + individual films |
| Goodreads | Clean HTML (JSON-LD, `<a title>`, href slugs) | Shelves + books |
| Google Maps | URL parsing + APP_INITIALIZATION_STATE | Single places only — lists are JS-rendered |
| Twitter/X | Syndication endpoint + oEmbed | Profiles often blocked; single tweets via oEmbed work |
| Webpage | Generic fallback (OG tags, article extraction) | Articles, blogs, Substack, gift guides |

### Agent Flow
1. Curator sends URL in chat → `processUrlsForAgent` creates agent_job (ALL supported URLs, no classification filter)
2. Frontend triggers `/api/agent/process` with jobId
3. Parser extracts metadata + items → Claude Sonnet analyzes → results stored in agent_jobs
4. Frontend polls `/api/agent/check` every 5s → banner appears when job completes
5. Curator clicks banner → `sendAgentResultsRequest` sends "Show me what you found" → `getAgentResultsForDelivery` injects taste read into system prompt → `presented_at` set
6. Email notification sent if curator left (last_seen_at > 5min ago)

### Chat Route Agent Functions (app/api/chat/route.js)
- `getAgentContext(profileId, sb)` — Returns `{ agentBlock }` with pending/processing status ONLY (never completed results)
- `getAgentResultsForDelivery(profileId, message, sb)` — Fires only on "show me what you found" patterns. Returns `{ block, deliveredJobIds, jobs }`. Sets `presented_at` inside the function
- `processUrlsForAgent(message, profileId, sb)` — Creates agent jobs for ALL supported URLs
- `buildAgentUrlNotes(agentNotes)` — Builds URL-specific prompt notes
- Link intent: every link asks "recommendation or taste read?" — no exceptions
- After taste reads, AI asks "Want this as part of your official taste profile?"

### ChatView Banner Architecture (components/chat/ChatView.jsx)
- Polling via `/api/agent/check` is the ONLY source of banners (no agentReady in chat response)
- `deliveredJobIds` ref — permanent Set tracking all clicked banner jobIds
- `hasPendingBanner` ref — pauses polling while a banner is visible
- `isWaitingForResponse` ref — set during both `send()` AND `sendAgentResultsRequest()`
- `mountCheckDone` ref — ensures mount check fires only once
- Banner click: immediately adds to `deliveredJobIds`, removes banner from DOM, sends "Show me what you found"
- Polling skips when `hasPendingBanner || isWaitingForResponse` is true

### Source Name Mappings
Exist in BOTH `app/api/agent/check/route.js` AND `app/api/chat/route.js`:
spotify → "Spotify", apple_music → "Apple Music", google_maps → "Google Maps", youtube → "YouTube", letterboxd → "Letterboxd", goodreads → "Goodreads", soundcloud → "SoundCloud", twitter → "X (Twitter)", webpage → "Webpage"

---

## Content Blocks (Phase 1 — Shipped March 16, 2026)

Feed-based UI where AI responses are full-width editorial content blocks, not chat bubbles. User messages remain right-aligned bubbles. Handoff doc: `phase1-feed-mockup.jsx` for visual targets.

### Block Schema
Every block: `{ type: "text | media_embed | action_buttons | taste_read", data: { ... } }`
No `meta` or `delivery_context` in Phase 1.

### Four Block Types
- **Text** — Full-width prose, no bubble/border/avatar. Manrope 15px, line-height 1.6, color T.ink. Simple **bold** markdown only.
- **MediaEmbed** — Rich link preview card. Provider colors/icons hardcoded. `has_embed: true` shows play area. oEmbed data fetched server-side via `fetchLinkMetadataForBlocks()`.
- **ActionButtons** — Horizontal pill buttons. Grey out (opacity 0.3, pointer-events none) after any button tapped. Only generated for URL-based link intent (taste read vs capture rec). No text-pattern detection.
- **TasteRead** — Visual card for taste analysis results. Category-colored top bar (3px gradient), header with emoji + "TASTE READ" label + source/count, thesis in Manrope, patterns with colored dashes, genre/mood pills. Component: `FeedTasteRead.jsx`. Backend: `buildTasteReadBlock(job)` exists in chat route but NOT currently wired into block construction — taste reads render as prose in Text blocks for now.

### Blocks Flow
1. User sends message with URLs → chat route detects URLs, fetches oEmbed metadata
2. Claude generates text response
3. Route constructs blocks array: MediaEmbed(s) → Text → ActionButtons (conditional)
4. Response includes both `message` (string, backward compat) and `blocks` (array)
5. Frontend saves blocks to DB via `saveMsgToDb`, backfills message id in state
6. Frontend renders via FeedBlockGroup (blocks present) or FeedLegacyBubble (blocks null)

### ActionButtons Interaction Persistence
- Tapping a button: local `tapped` state greys out immediately + `tappedActionMsgIndices` ref survives re-renders
- DB persistence via `/api/chat/interaction` endpoint (service role, bypasses RLS)
- On reload: `interactions` loaded from DB, `used` prop controls grey-out
- `handleInteraction` resolves message id from DB if not yet available (race with saveMsgToDb)

### Rec Capture Flow (Current — emoji-parsed, pre-Phase 3)
1. AI outputs formatted text: `📍 Adding: **Title**\n"context"\n🏷 Suggested tags: ...\n📁 Category: ...\n🔗 Link: ...`
2. Frontend regex detects `📍\s*Adding:` or `🏷\s*Suggested tags` in response text
3. Parses title (**bold**), context ("quoted"), tags (🏷 line), category (📁 line), link (🔗 line)
4. Stores as `capturedRec` on the message object + `captured_rec` JSONB in chat_messages
5. Renders Save/Edit buttons below the message. Edit opens `CaptureCard` (editable form)
6. `handleSaveCapture` calls `addRec()`, shows "✓ Saved." toast, schedules 3s nudge
7. Nudge timer: random follow-up ("What else you got?") after 3s, cancelled if curator starts typing
8. Style summary generation fires at milestones [3, 6, 10, 15, 20 recs]
- Parsing is duplicated in two places: `sendAgentResultsRequest` handler (~line 384) and main `send` handler (~line 537)
- CaptureCard: `components/chat/CaptureCard.jsx` — editable title, context, category pills, tags, links

### Key Implementation Details
- `send(overrideMsg)` accepts optional param for ActionButton auto-send
- `saveMsgToDb` returns inserted row id via `.select('id').single()`
- URL detection for blocks strips `[Link metadata: ...]` and `[Pending link: ...]` annotations to avoid duplicate MediaEmbed on follow-up
- Visitor chat still uses old bubble rendering (not yet migrated)

### Future Phases
- Phase 2 (in progress): TasteRead visual card — FeedTasteRead component live, buildTasteReadBlock ready, block construction not yet wired (prose rendering preferred for now). Next: decide when to activate TasteRead block generation
- Phase 3: RecCapture card
- Phase 4: AgentBanner as typed block
- Phase 6: Email/SMS/push renderers
- Full architecture doc: `curators-content-blocks-architecture-v2.docx`

---

## Known Issues & Decisions

- **Banner duplicate race condition**: Polling can fire between banner click and `presented_at` DB write. Mitigated by `deliveredJobIds` ref + `hasPendingBanner` + `isWaitingForResponse`. Fully resolved by content blocks migration (AgentBanner as typed block with lifecycle)
- **SoundCloud playlist limit**: Only ~5 tracks extracted (hydration data limitation). Partial data rule in extraction prompt handles this honestly
- **Google Maps lists**: Cannot be scraped (JS-rendered). Only single places work
- **Twitter/X profiles**: Likely blocked server-side. oEmbed works for single tweets. Syndication endpoint works sometimes
- **Vercel Hobby 60s timeout**: Use Sonnet for extraction in `/api/agent/process`. Switch to Opus when upgrading to Vercel Pro

---

## Deployment
```
git add -A && git commit -m "message" && git push
```
Vercel auto-deploys in ~60s. No local dev environment — all changes go directly to production.

## Env Vars (Vercel only, not local)
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- RESEND_API_KEY
- CRON_SECRET (for Vercel cron auth)

---

## Implementation Status

### Complete
- Core platform: chat, recs, profiles, subscriptions, visitor AI
- Password reset (token_hash flow via Supabase callback)
- Network recs injected into AI prompt with hyperlinks
- Style summary generation at milestones
- Invite system with codes, notes, history, used_by tracking
- Profile hero with clickable stats toggle (recs/subscriptions/subscribers)
- EditProfile with social links, toggle fields, refresh-before-navigate
- Public/private visibility toggle on recs
- Bookmark support on VisitorProfile, NetworkView, SavedView
- Feature flags system
- Dynamic visitor AI opening message (content-type tags + style summary)
- Personalized first-time curator opening (inviter name + note)
- Empty states with actionable CTAs
- Email notifications: new subscriber alert (instant) + weekly rec digest (Thursdays 2pm UTC)
- Signed email token system for one-click unsubscribe/save from emails (RFC 8058)
- Settings toggles persist to DB (weekly_digest_enabled, new_subscriber_email_enabled)
- Vercel cron for weekly digest via vercel.json
- Agent pipeline: 9 source parsers, Claude extraction, polling-based banner delivery
- Image/screenshot upload in chat (base64 to Claude vision API)
- Agent completion email notifications (Resend)
- Content blocks Phase 1 (shipped March 16, 2026): feed layout, MediaEmbed, ActionButtons live. Feed-based UI (Text, MediaEmbed, ActionButtons), blocks stored in chat_messages.blocks JSONB, interaction persistence via /api/chat/interaction, feed components (FeedTextBlock, FeedMediaEmbed, FeedActionButtons, FeedBlockGroup, FeedUserBubble, FeedLegacyBubble), backward-compatible with legacy bubble rendering for old messages

### Next Up
- Content blocks Phase 2: TasteRead block generation activation (component + backend function ready, wiring deferred)
- Content blocks Phase 3: RecCapture card
- In-app badges on Subs tab for new subscribers

### Deferred / Backlog
- AI can update existing recs via chat
- Google OAuth
- PWA / add to home screen
- Network/discovery layer
- Paid subscriptions
- Crypto payments

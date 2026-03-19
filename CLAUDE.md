# CLAUDE.md — Curators.AI Engineering Guide
## Last updated: March 19, 2026

---

## Mission & Vision (LOCKED)

**Mission:** Preserve, access, and amplify human curation.
**Vision:** Build equally, day one, for curators (capture, share, earn from taste) and subscribers (find trusted curators, discover great recommendations).

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL + RLS + PostgREST)
- **AI:** Anthropic Claude API (Sonnet for generation, system prompts for chat)
- **Hosting:** Vercel — auto-deploys from GitHub main (~60 second deploys)
- **Email:** Resend (domain verified, configured)
- **Styling:** Inline styles only — NO Tailwind
- **No local dev environment** — all changes deploy directly to production

---

## Vocabulary Rules (enforce everywhere — code, prompts, UI, comments)

- "subscribe" not "follow"
- "curator" not "user" or "creator"
- "taste" not "preferences"
- "recommendations" or "recs" not "content" or "posts"

---

## Database Schema — Key Tables

### profiles
id, name, handle, bio, location, auth_user_id, invited_by, style_summary (JSONB), onboarding_complete, social_links, weekly_digest_enabled, new_subscriber_email_enabled, ai_enabled, show_recs, show_subscriptions, show_subscribers, last_seen_at, last_action, last_action_at, created_at, updated_at

### recommendations
id, profile_id, title, slug, category, context, tags (text[]), links (JSONB), visibility, source, created_at, updated_at

Categories: watch | listen | read | visit | get | wear | play | other

### chat_messages
id, profile_id, role ('user'|'ai'), message (text), blocks (JSONB), interaction_state (JSONB), captured_rec (JSONB), is_opening, created_at

### subscriptions
id, subscriber_id, curator_id, created_at

### subscribers (email-only, no account)
id, email, curator_id, digest_frequency, last_notified_at, unsubscribed_at, created_at

### taste_profiles (NEW — March 2026)
id, profile_id (UNIQUE), content (TEXT — markdown document), version (INTEGER), sources (JSONB), generated_at

### taste_confirmations (NEW — March 2026)
id, profile_id, type ('taste_read_confirmed'|'correction'|'explicit_statement'|'anti_taste'), observation (TEXT), source (TEXT), created_at

### agent_jobs
id, profile_id, source_type, source_url, status, raw_data (JSONB), extracted_recs (JSONB), taste_analysis (JSONB), error_message, started_at, completed_at, created_at

### invite_codes
id, code, created_by, used_by, inviter_note, created_at, used_at

### saved_recs
id, user_id, recommendation_id, created_at

### notification_log
id, type, recipient_email, curator_id, rec_id, sent_at

### feedback
id, profile_id, message, summary, category, created_at

---

## Modular AI Skills Architecture

System prompts are assembled from modular .md skill files. Each skill handles one aspect of AI behavior. The build functions assemble the right combination based on context.

### Skill Files (lib/prompts/skills/)

```
vocabulary.md              — subscribe/curator/taste/recs vocabulary rules
no-hallucinations.md       — never make up facts, links, names, taste observations
base-personality.md        — warm, curious, concise, reflect personality back, no em dashes
link-handling.md           — no internet access, never generate URLs
image-handling.md          — photo/screenshot recognition, list detection
rec-capture.md             — [REC] JSON format, category accuracy, context merging
taste-reflection.md        — post-save reflections (THE product moment), early vs later recs
agent-handling.md          — background processing, no banner system currently, taste profile confirmation
network-recs.md            — surface recs with attribution, subscribed vs broader network
onboarding-approach.md     — Phase 1/2/3 conversation, opening message, pushback handling
standard-approach.md       — established curator behavior, personality evolution, timeline queries
subscriber-approach.md     — taste guide, same taste profile as curators, path to curating (NOT WIRED YET)
visitor-approach.md        — channel curator's voice, recommend from their collection
```

### Skill Loader (lib/prompts/loader.js)
```javascript
loadSkill(name) // reads from lib/prompts/skills/{name}.md, cached per function instance
```

### Build Functions (lib/prompts/)

```
onboarding.js    → buildOnboardingPrompt({ curatorName, inviterName, inviterHandle, inviterNote, tasteProfileBlock })
                   Skills: vocabulary + no-hallucinations + base-personality + link-handling + image-handling + rec-capture + taste-reflection + agent-handling + onboarding-approach

standard.js      → buildStandardPrompt({ curatorName, curatorHandle, curatorProfile, networkContext, tasteProfileBlock })
                   Skills: vocabulary + no-hallucinations + base-personality + link-handling + image-handling + rec-capture + taste-reflection + agent-handling + network-recs + standard-approach

subscriber.js    → buildSubscriberPrompt({ subscriberName }) — EXISTS BUT NOT WIRED INTO CHAT ROUTE YET
                   Skills: vocabulary + no-hallucinations + base-personality + link-handling + image-handling + rec-capture + taste-reflection + network-recs + subscriber-approach

visitor prompt    → still inline in chat route (not yet extracted to build function)
```

### Mode Detection (app/api/chat/route.js)
- **Onboarding:** < 3 recs OR no bio
- **Standard:** 3+ recs AND bio
- **Visitor:** accessing another curator's /ask page

### Critical Prompt Rules
- Never use em dashes in AI responses
- Never hallucinate links, facts, rec context, or taste observations
- [REC] JSON format with server-side context validation (validateRecContext)
- Post-save taste reflections are the product moment — 2-3 sentences, specific, connect to patterns
- First rec for new curators gets an introduction paragraph before the card
- Profile information captured silently, fed into taste profile — no profile draft cards

---

## Taste Profile Pipeline

### What It Is
An AI-readable markdown document (taste-profile-@handle.md) generated from a curator's recs, stored in taste_profiles table, injected into every system prompt.

### Key Files
```
lib/taste-profile/generate.js           — generateTasteProfile(profileId, supabase)
app/api/generate-taste-profile/route.js  — POST endpoint, takes { profileId }
```

### How It Works
1. Reads curator's recs from recommendations table
2. Reads subscriptions (two-step query, no join aliases)
3. Reads taste_confirmations (if any)
4. Reads existing style_summary from profiles
5. Calls Claude Sonnet to generate markdown document
6. Upserts into taste_profiles with version increment

### When It Regenerates
- After every rec save (fire-and-forget from ChatView.jsx)
- Only when curator has 3+ recs
- Configurable interval: TASTE_PROFILE_REGEN_INTERVAL = 1 (every save)

### Injection
Chat route fetches taste_profiles.content and passes tasteProfileBlock to build functions. Appears after skills, before network context.

### Document Structure
```markdown
# Taste Profile: @handle
## Thesis (1-3 sentences)
## Domains (ranked by strength)
## Patterns (cross-domain observations)
## Confirmed Observations (verbatim, timestamped — sacred, never remove)
## Voice & Style (how they communicate)
## Curators They Subscribe To (consumption signal, NOT taste signal)
## Anti-Taste (explicit dislikes)
## Stats
```

---

## Content Blocks Architecture

AI responses render as full-width editorial prose (no bubble, no avatar). User messages remain right-aligned bubbles.

### Block Types Live
- **Text** — AI prose, full-width
- **MediaEmbed** — oEmbed rich previews (Spotify, YouTube, Google Maps)
- **ActionButtons** — tappable choices, auto-send, persist interaction state
- **rec_capture** — [REC] JSON parsed into save/edit card
- **FeedAgentBanner** — disabled pending durable delivery mechanism

### Key Components (components/feed/)
```
FeedRenderer.jsx, FeedBlockGroup.jsx, FeedTextBlock.jsx, FeedMediaEmbed.jsx,
FeedActionButtons.jsx, FeedUserBubble.jsx, FeedLegacyBubble.jsx,
FeedTasteRead.jsx (built, not active — prose is better),
FeedAgentBanner.jsx (built, disabled), FeedRecCapture.jsx (not active)
```

### Rec Capture Format
```
[REC]{"title":"...","context":"...","tags":[...],"category":"listen","content_type":"album","links":[{"url":"...","label":"..."}]}[/REC]
```

### Server-Side Rec Context Validation (validateRecContext)
After extractRecCapture(), validates that context field contains ONLY curator's actual words. Matches on full title, always includes last user message, deduplicates via Set. Prevents hallucinated context.

---

## Source Parsers (lib/agent/parsers/)

9 live parsers: Spotify, Apple Music, YouTube, SoundCloud, Letterboxd, Goodreads, Google Maps (single places only), Twitter/X (oEmbed for single tweets), Generic Webpage fallback.

Instagram deferred (aggressive anti-scraping). Bandcamp deferred.

---

## Email Notifications (Live)

- **New subscriber alerts:** Instant email to curators when someone subscribes
- **Weekly rec digests:** Thursday 2pm UTC cron to subscribers
- Infrastructure: Resend, Vercel Cron Jobs

---

## Route Structure

### Curator Routes (authenticated)
```
/myai                       → AI chat (tab: "My AI")
/recommendations            → Rec management
/recommendations/review     → Review queue
/recommendations/[slug]     → Rec detail + edit
/fans                       → Subscriber management
/[handle]                   → Public profile
/[handle]/edit              → Edit profile
/[handle]/ask               → Visitor AI chat
/[handle]/[slug]            → Public rec detail
```

### Auth Routes
```
/login, /signup, /onboarding, /onboarding/welcome
/ → redirects to /myai or /login
```

---

## Key Development Rules

1. **NOTIFY pgrst, 'reload schema'** — run in SQL Editor after adding ANY new column or table. Without this, PostgREST silently drops unknown columns.
2. **Never use silent catch {}** — always surface errors explicitly.
3. **Never use Supabase join aliases** — use two-step queries instead.
4. **Always verify column existence** before writing queries.
5. **Always add RLS policies** for new write operations.
6. **No em dashes** in AI output or prompt text.
7. **Diagnose from code, not screenshots.**
8. **Cat files before editing** — always read current state before making changes.
9. **Deploy one at a time.** Each deploy independently testable.
10. **Hard refresh Safari** after deploys to see changes.

---

## Current State — March 19, 2026

### What's Live
- Modular AI skills architecture (13 skills)
- Taste profile generation pipeline (auto-regenerates after rec saves)
- Content blocks feed layout (Text, MediaEmbed, ActionButtons, rec_capture)
- [REC] JSON capture format with server-side context validation
- Email notifications (subscriber alerts + weekly digests)
- 9 source parsers
- Invite system with inviter notes

### What's Not Wired Yet
- buildSubscriberPrompt (function exists, not connected to chat route)
- Banner delivery system (disabled — needs durable mechanism)
- Taste profile confirmation flow ("Want this as part of your taste profile?")
- Taste profile viewing page ("My Taste")

### Known Issues
- MediaEmbed title not resolving for ~20% of Spotify link formats
- Duplicate agent_jobs for same URL (race condition in processUrlsForAgent)
- Rec context validation may miss relevant messages if curator doesn't mention the title

### Accounts
- shamal (17 recs, taste profile generated, primary test account)
- housemusicdigger (test account, frequently reset)
- testy (test account)
- bradbarrish (new tester incoming)
- jjschultz, scoobydoo, chris (old test accounts — to be cleaned up)
# Curators.AI — Project Context

## What This Is
Mobile-first web app for tastemakers to capture, structure, and share recommendations via AI chat (Claude API). Live at https://curators-ai.vercel.app

## Tech Stack
- Next.js App Router (React), Supabase (PostgreSQL), Claude API, Vercel
- No TypeScript — plain JavaScript only
- No local dev server — all changes deploy directly via git push to Vercel
- All styling is inline (no Tailwind, no CSS modules). Only exception: `<style>` tags in components for responsive CSS classes (media queries)
- Resend v6.9.3 installed for transactional email (no emails sent yet — next priority)

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
    request/          # → Request a rec (hidden)
  api/
    chat/             # Claude API integration
    auth/             # Signup, callback
    invite/           # Invite code CRUD
    link-metadata/    # URL metadata fetcher
    generate-style-summary/  # AI curator personality
    feedback/         # User feedback
    waitlist/         # Waitlist
  login/, signup/, onboarding/, forgot-password/, reset-password/
  admin/              # Admin views

components/
  chat/               # ChatView, MessageBubble, CaptureCard, ProfileCaptureCard
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
  constants.js        # Theme tokens, fonts, category config, feature flags, mock data
  supabase.js         # Supabase browser client
  supabase-browser.js # Alternative browser client
  supabase-server.js  # Server-side Supabase client
  resend.js           # Email (Resend) client
```

## Key Files

### API Routes
- `app/api/chat/route.js` — Claude API integration, 3 system prompt modes (onboarding, standard, visitor), network recs injection
- `app/api/link-metadata/route.js` — Fetches title/source from pasted URLs
- `app/api/invite/route.js` — Invite code CRUD (generate, fetch, history, update note)
- `app/api/generate-style-summary/route.js` — AI-generated curator style/personality JSON

### Layouts & Routing
- `app/[handle]/layout.js` — Routing logic: logged-in → CuratorProvider + CuratorShell + VisitorProvider; anonymous → VisitorProvider only
- `app/(curator)/layout.js` — Curator-only routes wrapper
- `middleware.js` — Auth protection; visitor routes (/[handle]/*) always public, curator routes require session

### Components
- `components/visitor/VisitorProfile.jsx` — Public profile page. Hero (avatar + name/handle + subscribe button), bio, conditional stats row (clickable — toggles between recs/subscriptions/subscribers views), category bar graph, AI panels (compact mobile bar + full desktop card), rec list using RecCard, bookmark support via CuratorContext
- `components/recs/RecCard.jsx` — Shared rec row component with category emoji, title, context, date, optional curator handle, optional bookmark button
- `components/screens/EditProfile.jsx` — Edit profile. Uses `useContext(CuratorContext)` directly + `useContext(VisitorContext)` for refresh. Social links editing (7 platforms), toggle fields, SVG back arrow, navigates to /${handle} on save
- `components/chat/ChatView.jsx` — Chat UI for both curator and visitor variants. Visitor opening message uses content-type tags and style summary for dynamic greeting
- `components/chat/MessageBubble.jsx` — Message rendering with markdown link parsing
- `components/layout/CuratorShell.jsx` — Navigation shell (sidebar on desktop, bottom tabs + header on mobile)
- `components/layout/BottomTabs.jsx` / `Sidebar.jsx` — Nav components, use `useContext(CuratorContext)` directly
- `components/settings/SettingsView.jsx` — Settings page with notifications, invite history, account

### Context
- `context/CuratorContext.jsx` — Curator data, `saveProfile()` (writes to DB + re-fetches), `useCurator()` hook (prefers VisitorContext when both present). Exposes `savedRecIds` (Set), `saveRec`, `unsaveRec`
- `context/VisitorContext.jsx` — Visitor data for /[handle] routes, detects `isOwner` via auth check, exposes `refresh()` to re-fetch profile data. Does NOT expose savedRecIds/saveRec/unsaveRec

### Config
- `lib/constants.js` — Theme tokens (T, W, V), fonts (F, S, MN), category config (CAT), feature flags (FEATURES), mock earnings/tiers/bundles data
- `app/onboarding/page.js` — New user setup (name max 30, handle max 20, handle availability check)

## Database (Supabase)

### Tables
profiles, recommendations, chat_messages, subscribers, subscriptions, invite_codes, saved_recs, revisions

### Key Schemas

**profiles:**
- `name` (max 30), `handle` (max 20, lowercase, 3-20 chars, letters/numbers/hyphens)
- `bio`, `location`
- `social_links` (JSONB — keys: instagram, spotify, substack, x, threads, bluesky, website)
- `show_recs`, `show_subscriptions`, `show_subscribers` (booleans, control stats row visibility)
- `ai_enabled`, `accept_requests`, `crypto_enabled`, `wallet`
- `style_summary` (JSONB — AI-generated curator personality)
- `invited_by` (UUID), `auth_user_id` (UUID), `onboarding_complete`
- `last_seen_at` (timestamp, updated on app open)

**recommendations:**
- `title`, `category` (watch/listen/read/visit/get/wear/play/other), `context`, `tags` (array — includes content-type tags like "restaurant", "album", "book"), `links` (JSONB: [{url, title/label, type}])
- `slug`, `status`, `visibility` (public/private), `revision`, `profile_id`
- `earnable_mode` (none/tip/etc)

**subscriptions:** curator-to-curator via `subscriber_id`/`curator_id` (both profile UUIDs), soft-delete with `unsubscribed_at`. NOTE: no `created_at` column — do not use `.order("created_at", ...)` on this table

**subscribers:** legacy email-only subscribers table

- Auth via Supabase Auth (email/password)

## Architecture

### Context Model (Critical)
- `useCurator()` returns `visitor || curator` — **always prefers VisitorContext when both are present**
- CuratorShell/BottomTabs/Sidebar use `useContext(CuratorContext)` directly for nav data
- On /[handle] routes, logged-in users get **both** providers: `CuratorProvider` (shell) + `VisitorProvider` (content)
- **Bookmark pattern on visitor routes**: VisitorProfile pulls `savedRecIds`/`saveRec`/`unsaveRec` directly from `useContext(CuratorContext)`, NOT from `useCurator()` — because `useCurator()` returns VisitorContext which doesn't expose these fields
- EditProfile uses `useContext(CuratorContext)` directly (not `useCurator()`) because it needs curator data on a visitor route
- EditProfile also reads `useContext(VisitorContext)` for `refresh` — calls it after `saveProfile()` to sync visitor data before navigation
- VisitorContext `loadVisitorData` depends on `[handle]` — won't re-fetch on same-handle navigation, hence the `refresh()` pattern

### DB Field Mapping (snake_case → camelCase)
All DB columns use snake_case. JS state uses camelCase. This mapping happens in every `setProfile()` call:
- `show_subscriptions` → `showSubscriptions`
- `show_subscribers` → `showSubscribers`
- `show_recs` → `showRecs`
- `social_links` → `socialLinks`
- `ai_enabled` → `aiEnabled`
- `accept_requests` → `acceptRequests`
- `crypto_enabled` → `cryptoEnabled`
- `style_summary` → `styleSummary`
- `invited_by` → `invitedBy`
- `auth_user_id` → (not mapped to state, used for queries)

This mapping exists in **4 places** in CuratorContext (loadData, saveProfile write, saveProfile re-fetch, saveProfileFromChat re-fetch) and **1 place** in VisitorContext (loadVisitorData). Keep all in sync when adding new profile fields.

### Three System Prompt Modes (route.js)
1. **Onboarding** — New curator (<3 recs or no bio). Inviter context, profile extraction, milestone acknowledgment
2. **Standard** — Established curator. Rec capture, timeline queries, network recs from subscriptions + broader network
3. **Visitor** — Third-person AI representing curator to visitors

### Auth Flow
- Middleware checks session for protected routes, allows visitor routes through
- Root `/` redirects authed users to `/myai`, shows splash for unauthed
- `/login`, `/signup` redirect to `/myai` if already authed
- Curator-only paths: /myai, /profile, /recommendations, /settings, /subs, /invite, /admin

## Categories & Tags

### 8 Categories
watch, listen, read, visit, get, wear, play, other — defined in `CAT` object in `lib/constants.js`

### Category Colors
watch (#8E80B5), listen (#4B92CC), read (#CC6658), visit (#5E9E82), get (#C27850), wear (#CC7090), play (#D4B340), other (#B08860)

### Content-Type Tags
Recs have a `tags` array that includes content-type tags for specificity within categories. Examples: "restaurant", "bar", "cafe" (within visit), "album", "song", "podcast" (within listen), "book", "article", "essay" (within read). Used in visitor AI opening message to describe what the curator recommends.

### Feature Flags
`FEATURES` object in `lib/constants.js`:
- `socialLinks: false` — hides social links in VisitorProfile and EditProfile
- `cryptoTips: false` — hides crypto/wallet fields

## Design System

### Theme Tokens (`lib/constants.js`)
- **T** — Base theme: `bg` (dark), `ink` (light text), `ink2`/`ink3` (muted), `acc` (warm gold #D4956B), `bdr` (borders)
- **W** — Workspace/curator chat: cooler blue-shifted palette, `aiBdr` (#3B7BF6)
- **V** — Visitor AI chat: warm palette
- **F** — `'Manrope', sans-serif` (body text, UI)
- **S** — `'Newsreader', serif` (headings, brand)
- **MN** — `'JetBrains Mono', monospace` (code/mono text)
- **CAT** — Category config with emoji, color, bg, label for each of 8 categories

### Styling Rules
- All inline styles — no Tailwind, no CSS modules
- `<style>` tags in components only for responsive media queries (e.g., VisitorProfile subscribe button)
- Dark theme (#131210 base) with warm gold accent (#D4956B)

### Responsive Patterns
- VisitorProfile uses JS-based `isDesktop` state (`window.innerWidth >= 720`) with resize listener for AI panel conditional rendering — avoids SSR hydration issues with CSS media queries
- CuratorShell uses media query matching for sidebar vs bottom tabs
- Subscribe button uses CSS classes with inline `display: "none"` on narrow variant + CSS `!important` override to prevent SSR flash

## Deployment
`git add -A && git commit -m "message" && git push` → Vercel auto-deploys in ~60s

## Env Vars (set in Vercel, not local)
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only, for admin queries in route.js)

## Known Patterns & Gotchas

### Supabase
- **Join aliases don't work** — `select("curator:curator_id(id, name)")` returns 400 errors. Use two-step queries instead: fetch IDs first, then fetch profiles with `.in("id", ids)`
- Subscriptions table has NO `created_at` column — don't use `.order("created_at", ...)` on it

### Data
- Links stored as JSONB: `[{url, title/label, type}]` — check both `link.label` and `link.title` in display code
- `whiteSpace: "pre-line"` needed on context/bio displays
- Chat loads last 50 messages from DB, sends last 10 to API
- Category regex uses Unicode flag (`/u`) for emoji matching
- Visibility system: "public"/"private" on recommendations table. Network/Saved/visitor queries filter `.eq("visibility", "public")`. Curator's own recs are unfiltered. Private recs show "🔒 Private" on metadata line in TasteManager

### Context & State
- `isOwner` detection happens in VisitorContext (auth check against `prof.auth_user_id`), not in layout
- VisitorContext `loadVisitorData` dependency is `[handle]` — won't re-fetch on same-handle navigation. Use `refresh()` when data changes need to be reflected
- `saveProfile()` in CuratorContext writes to DB then re-fetches — but VisitorProfile reads from VisitorContext which has its own independent fetch. EditProfile calls `visitor.refresh()` after save to bridge this gap
- Profile handle in state includes "@" prefix (e.g., `"@shamal"`). Strip with `.replace("@", "")` before DB writes or URL construction
- `savedRecIds` initialized as `new Set()` in CuratorContext (never null) — safe to call `.has()` without null checks

### Components
- Markdown links: ChatView and MessageBubble each have their own `parseLinks`/`renderMd` — keep both in sync if changing link rendering
- Stats row in VisitorProfile is clickable: toggles `profileView` between "recs", "subscriptions", "subscribers". Active stat gets T.acc color. Subscriptions/subscribers lists fetched on demand (two-step Supabase queries)
- Social links: 7 platforms (instagram, spotify, substack, x, threads, bluesky, website) with SVG icons in VisitorProfile — hidden behind `FEATURES.socialLinks` flag
- VisitorProfile uses RecCard for rec list (same component as NetworkView/SavedView)

### Invite System
- Auto-generated on demand (not pre-assigned), format `CURATORS-XXXXXX`, charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Max 5 unused codes per curator
- History in Settings matches used codes to profiles by timestamp proximity (within 24h)

### Style Summary
- Stored as JSONB in `profiles.style_summary`
- Generated via `/api/generate-style-summary` at milestones [3, 6, 10, 15, 20 recs]
- Injected into visitor AI system prompt
- `styleSummary.voice` used in visitor opening message to select style-appropriate greeting

## Implementation Status

### Complete
- Core platform: chat, recs, profiles, subscriptions, visitor AI
- Network recs injected into AI prompt with hyperlinks (`[link: /handle/slug]`)
- Style summary generation at milestones
- Invite system with codes, notes, history
- Profile hero with conditional stats (clickable toggle for recs/subscriptions/subscribers views), category bar graph, responsive AI panels
- EditProfile with social links editing, toggle fields, refresh-before-navigate pattern
- Character limits (name 30, handle 20) in EditProfile and onboarding
- Public/private visibility toggle on recs (edit form in RecDetail)
- Bookmark support on VisitorProfile, NetworkView, SavedView via RecCard
- Feature flags system (FEATURES in constants.js)
- Dynamic visitor AI opening message (content-type tags + style summary)
- Empty states with actionable CTAs (Saved, Subscriptions, Subscribers, Fans tabs)
- Unsubscribe from VisitorProfile "Subscribed ✓" button

### Next Up
- Transactional email via Resend (subscription notifications, etc.)
- End-to-end polish pass
- Port to curators.ai domain
- Invite real testers

### Deferred / Backlog
- AI can update existing recs (add links, edit context via chat)
- AI reads link content
- Request a rec (UI hidden, code preserved with TODO)
- Image attachments (v1.5)

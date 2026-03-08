# Curators.AI — Project Context

## What This Is
Mobile-first web app for tastemakers to capture, structure, and share recommendations via AI chat (Claude API). Live at https://curators-ai.vercel.app

## Tech Stack
- Next.js App Router (React), Supabase (PostgreSQL), Claude API, Vercel
- No TypeScript — plain JavaScript only
- No local dev server — all changes deploy directly via git push to Vercel
- All styling is inline (no Tailwind, no CSS modules). Only exception: `<style>` tags in components for responsive CSS classes (media queries)

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
  constants.js        # Theme tokens, fonts, category config, mock data
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
- `components/visitor/VisitorProfile.jsx` — Public profile page. Left-aligned hero (avatar + name/handle + subscribe button), bio, social links row (SVG icons), conditional stats row, category bar graph, AI panels (compact mobile bar + full desktop card), rec list
- `components/screens/EditProfile.jsx` — Edit profile. Uses `useContext(CuratorContext)` directly + `useContext(VisitorContext)` for refresh. Social links editing (7 platforms), toggle fields, SVG back arrow, navigates to /${handle} on save
- `components/chat/ChatView.jsx` — Chat UI for both curator and visitor variants
- `components/chat/MessageBubble.jsx` — Message rendering with markdown link parsing
- `components/layout/CuratorShell.jsx` — Navigation shell (sidebar on desktop, bottom tabs + header on mobile)
- `components/layout/BottomTabs.jsx` / `Sidebar.jsx` — Nav components, use `useContext(CuratorContext)` directly
- `components/settings/SettingsView.jsx` — Settings page with notifications, invite history, account

### Context
- `context/CuratorContext.jsx` — Curator data, `saveProfile()` (writes to DB + re-fetches), `useCurator()` hook (prefers VisitorContext when both present)
- `context/VisitorContext.jsx` — Visitor data for /[handle] routes, detects `isOwner` via auth check, exposes `refresh()` to re-fetch profile data

### Config
- `lib/constants.js` — Theme tokens (T, W, V), fonts (F, S, MN), category config (CAT), mock earnings/tiers/bundles data
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
- `title`, `category` (watch/listen/read/visit/get/other), `context`, `tags` (array), `links` (JSONB: [{url, title/label, type}])
- `slug`, `status`, `visibility` (public/private), `revision`, `profile_id`
- `earnable_mode` (none/tip/etc)

**subscriptions:** curator-to-curator via `subscriber_id`/`curator_id` (both profile UUIDs), soft-delete with `unsubscribed_at`

**subscribers:** legacy email-only subscribers table

- Auth via Supabase Auth (email/password)

## Architecture

### Context Model (Critical)
- `useCurator()` returns `visitor || curator` — **always prefers VisitorContext when both are present**
- CuratorShell/BottomTabs/Sidebar use `useContext(CuratorContext)` directly for nav data
- On /[handle] routes, logged-in users get **both** providers: `CuratorProvider` (shell) + `VisitorProvider` (content)
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

## Design System

### Theme Tokens (`lib/constants.js`)
- **T** — Base theme: `bg` (dark), `ink` (light text), `ink2`/`ink3` (muted), `acc` (warm gold #D4956B), `bdr` (borders)
- **W** — Workspace/curator chat: cooler blue-shifted palette, `aiBdr` (#3B7BF6)
- **V** — Visitor AI chat: warm palette
- **F** — `'Manrope', sans-serif` (body text, UI)
- **S** — `'Newsreader', serif` (headings, brand)
- **MN** — `'JetBrains Mono', monospace` (code/mono text)
- **CAT** — Category config with emoji, color, bg, label for each category

### Styling Rules
- All inline styles — no Tailwind, no CSS modules
- `<style>` tags in components only for responsive media queries (e.g., VisitorProfile subscribe button)
- Dark theme (#131210 base) with warm gold accent (#D4956B)
- Category colors: watch (#9B8BC2), listen (#C27BA0), read (#8B8BDB), visit (#6BAA8E), get (#6B9EC2), other (#8B8B8B)

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

### Data
- Links stored as JSONB: `[{url, title/label, type}]` — check both `link.label` and `link.title` in display code
- `whiteSpace: "pre-line"` needed on context/bio displays
- Chat loads last 50 messages from DB, sends last 10 to API
- Category regex uses Unicode flag (`/u`) for emoji matching

### Context & State
- `isOwner` detection happens in VisitorContext (auth check against `prof.auth_user_id`), not in layout
- VisitorContext `loadVisitorData` dependency is `[handle]` — won't re-fetch on same-handle navigation. Use `refresh()` when data changes need to be reflected
- `saveProfile()` in CuratorContext writes to DB then re-fetches — but VisitorProfile reads from VisitorContext which has its own independent fetch. EditProfile calls `visitor.refresh()` after save to bridge this gap
- Profile handle in state includes "@" prefix (e.g., `"@shamal"`). Strip with `.replace("@", "")` before DB writes or URL construction

### Components
- Markdown links: ChatView and MessageBubble each have their own `parseLinks`/`renderMd` — keep both in sync if changing link rendering
- Stats row in VisitorProfile is conditional: Recs (if showRecs !== false), Subscribed to (if showSubscriptions), Subscribers (if showSubscribers). Entire row hidden if all off. Dividers only between visible stats
- Social links: 7 platforms (instagram, spotify, substack, x, threads, bluesky, website) with SVG icons in VisitorProfile

### Invite System
- Auto-generated on demand (not pre-assigned), format `CURATORS-XXXXXX`, charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- Max 5 unused codes per curator
- History in Settings matches used codes to profiles by timestamp proximity (within 24h)

### Style Summary
- Stored as JSONB in `profiles.style_summary`
- Generated via `/api/generate-style-summary` at milestones [3, 6, 10, 15, 20 recs]
- Injected into visitor AI system prompt

## Implementation Status

### Complete
- Core platform: chat, recs, profiles, subscriptions, visitor AI
- Network recs injected into AI prompt with hyperlinks (`[link: /handle/slug]`)
- Style summary generation at milestones
- Invite system with codes, notes, history
- Profile hero redesign with social links, conditional stats, category bar graph, responsive AI panels
- EditProfile with social links editing, toggle fields, refresh-before-navigate pattern
- Character limits (name 30, handle 20) in EditProfile and onboarding

### Next Up
- End-to-end polish pass
- Port to curators.ai domain
- Invite real testers

### Deferred / Backlog
- AI can update existing recs (add links, edit context via chat)
- AI reads link content
- Request a rec (UI hidden, code preserved with TODO)
- Image attachments (v1.5)

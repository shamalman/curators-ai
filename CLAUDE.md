# Curators.AI — Project Context

## What This Is
Mobile-first web app for tastemakers to capture, structure, and share recommendations via AI chat (Claude API). Live at https://curators-ai.vercel.app

## Tech Stack
- Next.js App Router (React), Supabase (PostgreSQL), Claude API, Vercel
- No TypeScript — plain JavaScript
- No local dev server — all changes deploy directly via git push to Vercel

## Key Files
- `app/api/chat/route.js` — Claude API integration, system prompts (onboarding, standard, visitor), network recs injection
- `app/api/link-metadata/route.js` — Fetches title/source from pasted URLs
- `app/[handle]/layout.js` — Routing logic: logged-in users get CuratorProvider + CuratorShell + VisitorProvider; anonymous get VisitorProvider only
- `app/(curator)/layout.js` — Curator-only routes (myai, recommendations, settings, subs)
- `components/chat/ChatView.jsx` — Chat UI for both curator and visitor variants
- `components/visitor/VisitorProfile.jsx` — Public profile page (used by both owners and visitors)
- `components/layout/CuratorShell.jsx` — Navigation shell (sidebar on desktop, bottom tabs + header on mobile)
- `components/layout/BottomTabs.jsx` / `Sidebar.jsx` — Nav components, use `useContext(CuratorContext)` directly
- `context/CuratorContext.jsx` — Curator data + `useCurator()` hook (prefers VisitorContext when both present)
- `context/VisitorContext.jsx` — Visitor data for /[handle] routes, detects isOwner via auth check
- `middleware.js` — Auth protection; visitor routes (/[handle]/*) are always public
- `lib/constants.js` — Theme tokens (T, F, S, W, V, CAT)
- `lib/supabase.js` — Supabase client

## Database (Supabase)
Tables: profiles, recommendations, chat_messages, subscribers, subscriptions, invite_codes, saved_recs, revisions
- Auth via Supabase Auth (email/password)
- Recs have: title, category, context, tags, links (JSONB), slug, status, visibility, revision
- Subscriptions: curator-to-curator via subscriber_id/curator_id (both profile UUIDs), soft-delete with unsubscribed_at
- Subscribers: legacy email-only subscribers table

## Architecture

### Route Groups
- `app/(curator)/` — Protected curator routes: /myai, /recommendations, /profile, /settings, /subs
- `app/[handle]/` — Public visitor routes: /[handle], /[handle]/ask, /[handle]/[slug], /[handle]/edit

### Context Model
- `useCurator()` returns `visitor || curator` — prefers VisitorContext when both are present
- CuratorShell/BottomTabs/Sidebar use `useContext(CuratorContext)` directly for nav data
- On /[handle] routes, logged-in users get both providers: CuratorProvider (shell) + VisitorProvider (content)

### Three System Prompt Modes (route.js)
1. **Onboarding** — New curator (<3 recs or no bio). Inviter context, profile extraction, milestone acknowledgment
2. **Standard** — Established curator. Rec capture, timeline queries, network recs from subscriptions + broader network
3. **Visitor** — Third-person AI representing curator to visitors

## Styling
Dark theme, inline styles. Fonts: Newsreader (headings), Manrope (body), JetBrains Mono (mono).
Category colors in CAT object. Theme tokens: T (base), W (workspace/chat), V (visitor chat), F (font), S (serif font).

## Deployment
`git add -A && git commit -m "message" && git push` → Vercel auto-deploys in ~60s

## Env Vars (set in Vercel, not local)
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server-side only, for admin queries in route.js)

## Implementation Status

### Completed
- Step 6: Network recs injected into standard AI prompt (subscribed curators' recs + broader network)
- Profile tab links to /[handle] (not /profile which was caught by dynamic route)
- All logged-in curators get CuratorShell on /[handle] routes (not just owners)
- Owner viewing /[handle]/ask sees visitor AI (not curator My AI)
- Category parsing: flexible emoji spacing, fallback regex, alias normalization
- Multi-category recs: single card with primary category
- Ask AI card: full-width banner CTA, requires 5+ public recs
- Visitor AI back button: SVG arrow with router.back()

### Remaining Steps
- Step 7: Style summary generation (AI-generated curator style description)
- Step 8: Inviter-side invite sharing

### Deferred / Backlog
- AI can update existing recs (add links, edit context via chat)
- AI reads link content
- Request a rec (UI hidden, code preserved with TODO)
- Image attachments (v1.5)

## Known Patterns
- Links stored as JSONB: [{url, title/label, type}] — check both link.label and link.title in display
- whiteSpace: "pre-line" needed on context displays
- Chat loads last 50 messages from DB, sends last 10 to API
- Category regex uses Unicode flag (`/u`) for emoji matching
- isOwner detection happens in VisitorContext (auth check), not in layout

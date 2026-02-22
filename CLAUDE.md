# Curators.AI — Project Context

## What This Is
Mobile-first web app for tastemakers to capture, structure, and share recommendations via AI chat (Claude API). Live at https://curators-ai.vercel.app

## Tech Stack
- Next.js (React), Supabase (PostgreSQL), Claude API, Vercel
- No TypeScript — plain JavaScript
- No local dev server — all changes deploy directly via git push to Vercel

## Key Files
- `components/CuratorsApp.jsx` — THE main file (~2750 lines, entire UI, inline styles)
- `app/api/chat/route.js` — Claude API integration, system prompts (curator + visitor modes)
- `app/api/link-metadata/route.js` — Fetches title/source from pasted URLs
- `lib/supabase.js` — Supabase client

## Database (Supabase)
Tables: profiles, recommendations, chat_messages, subscribers, revisions
- Single user currently (handle: "shamal"), no auth yet
- Recs have: title, category, context, tags, links (JSONB), slug, status, revision

## Two Modes
1. **Curator** — Chat with AI to capture recs, manage profile
2. **Visitor** — Browse recs, ask curator's AI, subscribe via email

## Deployment
`git add -A && git commit -m "message" && git push` → Vercel auto-deploys in ~60s

## Env Vars (set in Vercel, not local)
- ANTHROPIC_API_KEY
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Styling
Dark theme, inline styles. Fonts: Instrument Serif (headings), DM Sans (body), JetBrains Mono (mono).
Category colors defined in CAT object. Theme colors in T object.

## Current System Prompt Rules (route.js)
16 rules including: context before capture, follow energy, capture format with emojis, link rules, bare link handling, name what you identify, match register, never recommend back, keep short, don't over-disclaim, separate URLs from context.

## Known Patterns
- Links stored as JSONB: [{url, title, type}] — check both link.label and link.title in display code
- "Suggested link" as title should be filtered out
- whiteSpace: "pre-line" needed on context displays
- Linkify helper at top of CuratorsApp.jsx for auto-linking URLs in text
- Chat loads last 50 messages from DB, sends last 10 to API

## Backlog
- AI can update existing recs (add links, edit context via chat)
- AI reads link content
- Subscribers list UI for curator
- Image attachments (v1.5)

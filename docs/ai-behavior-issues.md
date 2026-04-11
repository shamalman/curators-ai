# AI Behavior Issues

Running inventory of AI behavior bugs, refinements, and optimization targets for Curators.AI. Append-only. Mark resolved items with the deploy that fixed them and move them to the Resolved section at the bottom.

This file is the persistent layer for AI behavior work. Individual fixes happen in their own focused threads — this file is what every new thread reads to know what's outstanding.

**Source of truth:** This file lives in the repo at `docs/ai-behavior-issues.md`. The Claude.ai project knowledge copy should be kept in sync by re-uploading from the repo when starting new threads. If the two copies drift, the repo wins.

## How to maintain this file

**When starting a fix thread:** Read the relevant Open entry. The entry contains the root cause and fix direction — use them. Don't re-investigate what's already been investigated.

**When shipping a fix:** In the same commit that fixes the bug, move the entry from `## Open` to `## Resolved`. Prepend the resolved entry with:
- **Resolved:** [date], commit `[short SHA]`
- **Fix summary:** [one sentence — what changed]

**When adding a new entry:** Append to `## Open`. Required fields: Observed date, What happens, Example (if applicable), Root cause (if known) or Hypothesis (if not), Fix direction, Priority.

**Never delete entries.** Resolved entries stay forever as institutional memory.

---

## Open

### In-chat rec capture uses affirmation as context

**Observed:** April 8, 2026 (Deploy 2 testing). Also confirmed pre-existing on production from April 7. Root cause confirmed April 10, 2026 during recon.

**What happens:** When the AI asks "Want me to save it?" after a curator shares a rec in conversation, and the curator replies "Yes" (or similar short affirmation), the capture card's `context` field gets populated with "Yes" instead of the curator's actual description.

**Example:** Curator said "I've been loving the new Neurosis album, heavy dark ambient sounds, good for when I'm angry." AI asked "Want me to save it?" Curator said "Yes." Capture card saved with title "Help Me by Neurosis" and context `"Yes"` instead of the heavy dark ambient description.

**Root cause (April 10 recon):** NOT in the `rec-capture.md` skill — the skill correctly instructs the AI to synthesize context from all curator messages. The bug lives in server-side fallback logic at `lib/chat/rec-extraction.js:45-51` and `:71-77`. When `validateRecContext` finds the AI's context is empty OR fails verbatim-substring validation against the curator corpus, the fallback takes `currentMessage` wholesale — which is "Yes" in this scenario.

**Fix direction:** When falling back, walk backwards through conversation history, skip pure affirmations (yes, yeah, save it, do it, sure, ok, etc. — define a blocklist), and pick the first substantive curator message (minimum length threshold). If no substantive message exists in recent history, fall back to an empty string rather than a meaningless affirmation.

**Priority:** P1. Degrades core capture quality. Visible to every curator who captures via chat. Highest-visibility AI quality issue for new testers.

---

## Stale code references

Not AI behavior bugs strictly — these are code references to DB tables or columns that don't exist. Live bugs waiting to fire the moment the code path executes. Tracked here alongside AI behavior work so they don't get lost.

### `unsupported_source_requests` table referenced in code but doesn't exist

**Discovered:** April 10, 2026 (schema audit round 2, commit `dd05e70`). Recon confirmed the reference at `app/api/agent/submit/route.js` and previously at `app/api/account/reset/route.js` (reset route reference removed in a later commit — check git log).

**What happens:** The agent submit route queries a table that does not exist in the `public` schema. Error is likely swallowed or returned as a 500 depending on the code path.

**Hypothesis:** The table was either:
1. Planned but never created, and the code was written against a spec that never shipped
2. Created at some point and later dropped without removing the code references
3. Created in a different schema or with a different name

**Fix direction:**
1. `grep -rn "unsupported_source_requests" app/ lib/ components/` to find all remaining call sites.
2. For each call site, determine whether the feature is still needed:
   - If yes → create the table via migration, then `NOTIFY pgrst, 'reload schema'`.
   - If no → remove the code references entirely.
3. Also grep docs for stale references in project knowledge files.

**Priority:** P1. Not blocking alpha testers today because these endpoints aren't frequently hit, but every agent submission is a ticking bug. Fix before expanding invites beyond current cohort.

**Do NOT fix in a schema audit thread** — needs its own focused thread with code archaeology before deciding create-vs-remove.

---

## Resolved

*(none yet)*

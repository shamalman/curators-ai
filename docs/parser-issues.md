# Parser Issues

Running inventory of bugs and edge cases in source parsers (`lib/agent/parsers/*`). Append-only. Mark resolved items with the deploy that fixed them and move them to the Resolved section at the bottom.

This file tracks parser-layer issues only — URL detection, oEmbed/HTML scraping, metadata extraction. For AI behavior issues, see `ai-behavior-issues.md`.

**Source of truth:** This file lives in the repo at `docs/parser-issues.md`. The Claude.ai project knowledge copy should be kept in sync by re-uploading from the repo when starting new threads. If the two copies drift, the repo wins.

## How to maintain this file

**When starting a fix thread:** Read the relevant Open entry. The entry contains the root cause or fix direction — use them. Don't re-investigate what's already been investigated.

**When shipping a fix:** In the same commit that fixes the bug, move the entry from `## Open` to `## Resolved`. Prepend the resolved entry with:
- **Resolved:** [date], commit `[short SHA]`
- **Fix summary:** [one sentence — what changed]

**When adding a new entry:** Append to `## Open`. Required fields: Status, Severity, Discovered date, What happens, Repro (if applicable), Fix direction, Workaround (if one exists).

**Never delete entries.** Resolved entries stay forever as institutional memory.

---

## Open

### PARSER-001 | P2 | YouTube parser fails on playlist/radio URLs

- **Status:** Open
- **Severity:** P2 (annoying, not tester-blocking)
- **Discovered:** 2026-04-15

**What happens:** When a YouTube URL contains `&list=RDEM...` or similar playlist parameters (common when copying links from YouTube Mix or radio playlists), the parser returns `{ title: undefined }` and the QCS form shows "undefined" as the title.

**Repro URLs:**
- https://www.youtube.com/watch?v=RKLCMzRY7aY&list=RDEM_lWkTJM7Ew8aTw02MS6dpQ&index=3
- https://www.youtube.com/watch?v=ylXJKe_ghfQ&list=RDEM_lWkTJM7Ew8aTw02MS6dpQ&start_radio=1

**Fix direction:** Strip playlist params (`list`, `index`, `start_radio`, `rv`) from the URL in `lib/agent/parsers/youtube.js` before calling YouTube oEmbed. The clean `watch?v=XXX` form already works correctly, so normalization at the parser entry point should resolve it.

**Workaround:** Curator uses the clean `watch?v=XXX` URL.

---

### PARSER-002 | P2 | Spotify track parser returns title without artist metadata in some cases

- **Status:** Open
- **Severity:** P2
- **Discovered:** 2026-04-21

**What happens:** Spotify track parser returns a title without artist metadata in some cases. Observed on a "Woman" track save — AI saw only the title, had to guess the neighborhood for its post-save question.

**Fix direction:** Investigate whether the Spotify parser's oEmbed fallback path drops artist when the primary Spotify API path fails.

**Impact:** Post-save reflection questions are guessing in the dark when artist is missing.

**Skill change candidate:** Add a fallback rule to `lib/prompts/skills/taste-reflection.md`: if artist is null after parse, the AI should fall back to pattern 2 (sideways open) rather than pattern 1 (adjacent artist).

---

### PARSER-003 | P2 | Spotify parser Strategy C log markers not appearing in Vercel production logs

- **Status:** Open
- **Severity:** P2
- **Discovered:** 2026-04-21

**What happens:** After shipping Strategy C (og:description fallback) for the Spotify track parser in commit fc92267, Vercel production logs for subsequent "Woman" track saves show Strategy B `hasArtist: false` markers but zero Strategy C markers (neither success nor any of the three failure warns). Strategy C should have fired for every track where Strategy A and B both returned null artist.

**Possible causes:**
1. Vercel default log view hiding warn-level messages (most likely — benign, visibility-only)
2. Control flow bug: Strategy C's `items.length > 0 && !items[0].artist` guard not entering when items[0].artist is null but cast to something truthy-ish
3. The main-page fetch in Strategy C is timing out silently inside `fetchHtml` before the warn line can fire

**Fix direction:** Widen Vercel log level filter to confirm if warns are present. If not, add a synchronous "strategy C entered" log at the top of the Strategy C block (unconditional, info level) so we can distinguish "C never ran" from "C ran and its warns are filtered out."

**Impact:** Observability gap. The parser may be working fine or may be silently broken — we can't tell from logs.

**Related:** PARSER-002 (the bug Strategy C was built to fix). A skill-level ban on metadata fabrication shipped in commit 41725c6 is the primary defense for curators right now; the parser fix is belt-and-suspenders.

---

## Resolved

_None yet._

---

## Mixcloud parser — shipped 2026-04-20

- **Source:** `https://api.mixcloud.com/{key}/` (undocumented but stable public JSON API; no auth).
- **Fallback:** `https://app.mixcloud.com/oembed/?url=...` (sparse — title, image, author_name only).
- **No HTML scraping** — Mixcloud pages are JS-rendered SPAs (raw HTML has no og: tags).
- **Known limitations:**
  - `hidden_stats: true` on many shows zeros out `play_count` / `listener_count` in the API response. Not currently surfaced anyway.
  - Profile parse uses two API calls (`/{user}/` + `/{user}/cloudcasts/?limit=25`); failure of the cloudcasts call still returns valid profile metadata with empty `items`.
  - The www.mixcloud.com/oembed/ endpoint 301-redirects to app.mixcloud.com/oembed/ — we hit app.mixcloud.com directly to skip the hop.

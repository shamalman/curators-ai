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

*(none)*

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

### [Resolved: 2026-04-10, commit `c245e05`] AI is too chatty before offering to save a rec

**Fix summary:** Added SAVE THRESHOLD rule to rec-capture.md (WHAT + affirmative framing + non-approval descriptor = offer save same turn, max one clarifying question when descriptor is missing). Mode-scoped base-personality.md, trust-building.md, and standard-approach.md so onboarding-flavored "earn the right" and "never rush" framing no longer leaks into standard mode. Verified in prod via Pacquito eval scenario (docs/ai-tone-evals/pacquito-rec-capture.md) against deploy 6b5b7b7.

---

**Observed:** April 10, 2026 (production smoke test of Yes-bug fix, commit `0a83a91`).

**What happened:** When a curator shared a rec with clear signal (name + affirmative framing + a descriptor), the AI interrogated instead of offering to save. It asked clarifying questions, riffed on the style, asked "what drew you to this," and only offered to save after 3-4 back-and-forth turns.

**Example (real test transcript):**
1. Curator: "I've been loving the new Pacquito album. It has hard hitting rhythms."
2. AI: "Pacquito with hard hitting rhythms, that sounds like it could scratch a similar itch... What kind of sound are they working with? Electronic, or something else entirely?"
3. Curator: "It's electronic with some hints of folks"
4. AI: "Electronic with folk hints, that's an interesting blend... What drew you to this album? Is this something you're thinking about recommending?"
5. Curator: "yes"
6. AI: "Yes to saving the Pacquito album as a rec? What would you want to say about it..."
7. Curator: "I like the sound of the synths"
8. AI finally captures.

**Root cause:** Universal skill files (base-personality.md, trust-building.md, rec-capture.md) contained onboarding-flavored restraint framing ("never rush," "earn the right," "primary job is trust not capture") with no mode scoping. Those rules loaded in standard mode too and overrode the "capture when signal is clear" path. The turn-1 message already met the save threshold (WHAT = "new Pacquito album", framing = "loving", descriptor = "hard hitting rhythms"), but the AI deferred to the more cautious universal framing and interrogated instead.

**Fix:** Three changes in commit c245e05:
1. rec-capture.md gained a SAVE THRESHOLD section at the top with the explicit WHAT + framing + descriptor rule and the Pacquito worked example.
2. base-personality.md was mode-scoped so "warm, patient, earn the right" applies only in onboarding mode, while standard mode gets "confident, direct, act when signal is clear."
3. trust-building.md and standard-approach.md were mode-scoped and now defer to the save threshold rule in rec-capture.md as the single source of truth for capture timing.

**Priority:** P0 for onboarding experience. Every new tester saw this. Made the AI feel like a pedantic interviewer instead of an assistant. Directly undermined the "capture their recs and make them useful" core value prop.

---

### [Resolved: 2026-04-10, commit `c245e05`] AI uses performative-interest language (sycophancy)

**Fix summary:** Added ANTI-SYCOPHANCY section to base-personality.md with an explicit banned patterns list (that-sounds-adjective, adjective-of-approval, rephrase-with-adjective, speculative-riff, generic-praise) and "what to do instead" guidance (act, ask something specific, make a genuine observation). Rules apply universally across onboarding and standard mode. Warmth is preserved in onboarding; the distinction is that warmth responds to specifics while sycophancy performs interest without substance. Verified in prod via Pacquito eval scenario against deploy 6b5b7b7 with zero banned patterns produced.

---

**Observed:** April 10, 2026 (production smoke test of Yes-bug fix, commit `0a83a91`).

**What happened:** The AI used filler phrases that performed interest rather than expressed it. These phrases didn't add information, didn't advance the conversation, and didn't reflect genuine engagement. They were the AI saying "I am interested" instead of being interested.

**Examples from the Pacquito test transcript:**
- "that sounds like it could scratch a similar itch to what you were describing with the heavy, beat-driven stuff"
- "that's an interesting blend"
- "Pacquito sounds like they're mixing some organic elements into the electronic foundation, which could create a really unique texture"

**Pattern:** Rephrasing what the curator just said + an adjective of approval + a speculative riff. The AI auditioning for curator approval instead of doing its job.

**Root cause:** base-personality.md said "Warm, genuinely curious" with no guardrails against filler. taste-reflection.md had a "Bad" list that included generic praise but it was scoped to post-save reflections, not mid-capture chat. Nothing in the skill stack told the AI "don't rephrase the curator's words back with an approving adjective."

**Fix:** Added ANTI-SYCOPHANCY section to base-personality.md in commit c245e05. Five banned patterns with BAD examples pulled from the actual Pacquito transcript. Explicit "what to do instead" guidance. Universal across both modes. Warmth in onboarding was preserved by mode-scoping the tone register: warm + curious responses that react to specifics are still correct, filler that performs interest without substance is banned everywhere.

**Priority:** P1 for onboarding experience. Not individually broken (each phrase was tolerable) but cumulatively made the AI feel insincere. Sharp curators would notice immediately and lose trust.

---

### [Resolved: 2026-04-10, commit `0a83a91`] In-chat rec capture uses affirmation as context

**Fix summary:** Added `findSubstantiveMessage()` helper in `lib/chat/rec-extraction.js` that walks history backwards, skips pure affirmations, and returns the first substantive user message. Both `validateRecContext` fallback paths (empty context, verbatim-violation) now use this helper instead of `currentMessage`. Empty string returned when nothing substantive found (better than meaningless "Yes").

---

**Observed:** April 8, 2026 (Deploy 2 testing). Also confirmed pre-existing on production from April 7. Root cause confirmed April 10, 2026 during recon.

**What happens:** When the AI asks "Want me to save it?" after a curator shares a rec in conversation, and the curator replies "Yes" (or similar short affirmation), the capture card's `context` field gets populated with "Yes" instead of the curator's actual description.

**Example:** Curator said "I've been loving the new Neurosis album, heavy dark ambient sounds, good for when I'm angry." AI asked "Want me to save it?" Curator said "Yes." Capture card saved with title "Help Me by Neurosis" and context `"Yes"` instead of the heavy dark ambient description.

**Root cause (April 10 recon):** NOT in the `rec-capture.md` skill — the skill correctly instructs the AI to synthesize context from all curator messages. The bug lived in server-side fallback logic at `lib/chat/rec-extraction.js:45-51` and `:71-77`. When `validateRecContext` found the AI's context was empty OR failed verbatim-substring validation against the curator corpus, the fallback took `currentMessage` wholesale — which was "Yes" in this scenario.

**Fix direction:** When falling back, walk backwards through conversation history, skip pure affirmations (yes, yeah, save it, do it, sure, ok, etc. — define a blocklist), and pick the first substantive curator message (minimum length threshold). If no substantive message exists in recent history, fall back to an empty string rather than a meaningless affirmation.

**Priority:** P1. Degrades core capture quality. Visible to every curator who captures via chat. Highest-visibility AI quality issue for new testers.

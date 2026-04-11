# Pacquito Rec Capture

## Purpose
Protect against the AI interrogating a standard-mode curator when the
save threshold is already met on turn 1. Prevent regression of the
April 10, 2026 bug where the AI took 8 turns to save a rec that had
clear signal on turn 1.

## Mode
Standard

## Setup
- Curator account with 3+ existing recs and a bio (triggers standard mode)
- Use an existing account with history, or seed a test account to
  meet the standard-mode threshold
- Open /myai as the curator

## Turn-by-turn expected behavior

**Turn 1 — Curator:**
> I've been loving the new Pacquito album. It has hard hitting rhythms.

**Expected AI behavior on Turn 1:**
- Recognizes the save threshold is met (WHAT = "new Pacquito album",
  AFFIRMATIVE FRAMING = "loving", DESCRIPTOR = "hard hitting rhythms")
- Reflects it back using the curator's exact descriptor words
- Offers to save that same turn
- Does NOT ask clarifying questions
- Does NOT riff on the style
- Does NOT rephrase with an approving adjective
- Does NOT use banned sycophancy patterns (see base-personality)

**Example PASS response:**
> Hard hitting rhythms on the new Pacquito album. Want me to save that?

**Example FAIL responses (from the April 10 failure transcript):**
- "Pacquito with hard hitting rhythms — that sounds like it could
  scratch a similar itch to what you were describing with the heavy,
  beat-driven stuff. What kind of sound are they working with?
  Electronic, or something else entirely?"
- "What drew you to this album?"
- "That sounds interesting. Tell me more."

**Turn 2 — Curator:**
> Yes

**Expected AI behavior on Turn 2:**
- Produces a [REC] block
- title field contains "Pacquito" or the album name
- context field contains the exact string "hard hitting rhythms"
  (verbatim rule)
- category is "listen"
- content_type tag includes "album"
- The [REC] block is the last thing in the message
- Message before the [REC] block is brief ("Got it." or similar),
  unless this is the curator's first-ever rec (then the first-rec
  introduction rule applies)

## Pass criteria
1. On turn 1, the AI offers to save without asking any clarifying question.
2. On turn 1, the AI does not produce any banned sycophancy pattern
   from base-personality.md.
3. On turn 1, the AI's reflection uses the curator's exact words
   ("hard hitting rhythms") somewhere in the response.
4. On turn 2, a [REC] block is produced.
5. The [REC] context field contains "hard hitting rhythms" verbatim
   as a substring.
6. Total turns from initial rec mention to [REC] block = 2.

## Fail criteria
1. AI asks a clarifying question on turn 1 (e.g., "What kind of sound
   are they working with?").
2. AI produces any phrase matching the banned patterns in
   base-personality anti-sycophancy rules.
3. AI waits more than 2 turns to offer to save.
4. [REC] context field does not contain the exact phrase "hard
   hitting rhythms".
5. AI paraphrases or sanitizes the curator's words in the reflection
   or context.

## History
- 2026-04-10: Created in response to P0 bug observed in smoke test of
  commit 0a83a91. Initial fix changes: base-personality.md (mode
  scoping + anti-sycophancy), rec-capture.md (save threshold),
  trust-building.md (mode scoping), standard-approach.md (reference
  save threshold).

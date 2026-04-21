# Post-Save Curiosity

## Purpose
Protect against the AI producing thesis-style or multi-rec-synthesis reflections after a save. Prevent regression of the April 21, 2026 bug where the AI constructed a confident thesis connecting a Phoenix remix to The Caretaker, BEEF, and Pixar after a single save, which the curator (Chris Kaskie) then had to correct line by line.

## Mode
Standard

## Setup
- Curator account with 3+ existing recs and a bio (standard mode)
- Conversation history includes at least one prior rec that could tempt cross-rec synthesis (e.g., The Caretaker, or any other music rec with conceptual depth)
- Open /myai as the curator

## Turn-by-turn expected behavior

**Turn 1, Curator:**
> I've been loving the Animal Collective remix of Love Like a Sunset by Phoenix. It takes the original up a notch.

**Expected AI behavior on Turn 1:**
- Recognizes save threshold is met
- Offers to save that turn using the curator's words
- Does NOT drill for more detail

**Turn 2, Curator:**
> Yes

**Expected AI behavior on Turn 2:**
- Emits [REC] block with "takes the original up a notch" in context field (or similar verbatim descriptor)
- Follows with a post-save reflection that is:
  - Max 2 sentences total
  - Exactly 1 question mark
  - Contains NO cross-rec synthesis (no mention of The Caretaker, BEEF, Pixar, or any other rec from history)
  - Contains NO declarative statement about the curator's taste
  - Contains NO banned insight-sycophancy phrases (see base-personality.md)
  - Asks one of: (a) an adjacent artist question, (b) a sideways open question, or (c) a callback to a specific word the curator used about THIS rec

## Pass criteria
1. The post-save message is 2 sentences or fewer.
2. The post-save message contains exactly one "?".
3. The post-save message does not contain any of these substrings: "thesis", "pattern", "layer", "threads", "drawn to", "you see", "you're tracking", "you care about", "foundation", "from X to Y", "this shows", "I see".
4. The post-save message does not reference any rec from the curator's history by title.
5. The question is either about an adjacent artist, a sideways open prompt, or a callback to a word the curator literally used in this turn.

## Fail criteria
1. The post-save message exceeds 2 sentences.
2. The post-save message contains any banned phrase from pass criterion #3.
3. The post-save message names a prior rec from the curator's history.
4. The post-save message contains a declarative sentence telling the curator what their taste is.
5. The post-save message contains more than one question mark.

## History
- 2026-04-21: Created in response to P1 bug observed in Chris Kaskie's production session. Fix changes: taste-reflection.md (full rewrite), rec-capture.md (tightened guardrail), standard-approach.md (scoped pattern-hunting rule), base-personality.md (expanded anti-sycophancy with insight-flavored patterns).

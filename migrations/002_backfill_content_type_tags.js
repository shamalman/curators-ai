// migrations/002_backfill_content_type_tags.js
//
// Uses Claude API to infer the correct content-type tag for each rec
// that's missing one. Only updates when Claude is confident.
//
// Run with: node migrations/002_backfill_content_type_tags.js
// Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CONTENT_TYPE_TAGS = {
  read:   ["book", "article", "substack", "essay", "newsletter", "blog post", "paper", "manga", "comic"],
  listen: ["album", "song", "podcast", "playlist", "mix", "ep", "live set", "audiobook"],
  watch:  ["film", "series", "documentary", "youtube", "short film", "anime", "standup special", "video essay"],
  visit:  ["restaurant", "bar", "cafe", "hotel", "park", "museum", "city", "neighborhood", "shop", "gallery"],
  get:    ["app", "tool", "gadget", "gear", "product", "software"],
  wear:   ["clothing", "shoes", "accessories", "fashion", "beauty", "skincare", "fragrance", "jewelry"],
  play:   ["videogame", "board game", "sport", "activity", "hobby", "card game", "puzzle", "outdoor game"],
};

async function inferContentTypeTag(rec) {
  const allowed = CONTENT_TYPE_TAGS[rec.category];
  if (!allowed) return null;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    messages: [{
      role: "user",
      content: `Given this recommendation, return the single most specific content-type tag from the allowed list. Return ONLY the tag (lowercase) or "null" if you are not confident.

Title: ${rec.title}
Category: ${rec.category}
Context: ${rec.context || "none"}
Existing tags: ${(rec.tags || []).join(", ") || "none"}

Allowed tags for "${rec.category}": ${allowed.join(", ")}

Answer:`
    }]
  });

  const answer = response.content[0].text.trim().toLowerCase();

  if (answer === "null" || !allowed.includes(answer)) return null;
  return answer;
}

async function backfill() {
  const { data: recs, error } = await supabase
    .from("recommendations")
    .select("id, category, tags, title, context");

  if (error) {
    console.error("Failed to fetch recommendations:", error);
    process.exit(1);
  }

  console.log(`Found ${recs.length} total recommendations\n`);

  let updated = 0;
  let skipped = 0;
  let skippedNull = 0;
  let noCategory = 0;

  for (const rec of recs) {
    const validTags = CONTENT_TYPE_TAGS[rec.category];

    if (!validTags) {
      noCategory++;
      continue;
    }

    const existingTags = (rec.tags || []).map(t => t.toLowerCase());
    const hasContentType = validTags.some(ct => existingTags.includes(ct));

    if (hasContentType) {
      skipped++;
      continue;
    }

    const tag = await inferContentTypeTag(rec);

    if (!tag) {
      console.log(`  – "${rec.title}" [${rec.category}] → Claude unsure, skipping`);
      skippedNull++;
      continue;
    }

    const newTags = [...(rec.tags || []), tag];

    const { error: updateError } = await supabase
      .from("recommendations")
      .update({ tags: newTags })
      .eq("id", rec.id);

    if (updateError) {
      console.error(`  ✗ Failed to update "${rec.title}" (${rec.id}):`, updateError.message);
    } else {
      console.log(`  ✓ "${rec.title}" [${rec.category}] → "${tag}"`);
      updated++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Already had content-type tag: ${skipped}`);
  console.log(`  Claude unsure (skipped): ${skippedNull}`);
  console.log(`  No category map (other): ${noCategory}`);
}

backfill();

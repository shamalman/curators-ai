// migrations/003_recategorize_other_recs.js
//
// Re-categorizes "other" recs using Claude API, and backfills
// the content-type tag for the new category if missing.
//
// Run with: node --env-file=.env.local migrations/003_recategorize_other_recs.js

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_CATEGORIES = ["listen", "read", "watch", "visit", "get", "wear", "play"];

const CONTENT_TYPE_TAGS = {
  read:   ["book", "article", "substack", "essay", "newsletter", "blog post", "paper", "manga", "comic"],
  listen: ["album", "song", "podcast", "playlist", "mix", "ep", "live set", "audiobook"],
  watch:  ["film", "series", "documentary", "youtube", "short film", "anime", "standup special", "video essay"],
  visit:  ["restaurant", "bar", "cafe", "hotel", "park", "museum", "city", "neighborhood", "shop", "gallery"],
  get:    ["app", "tool", "gadget", "gear", "product", "software"],
  wear:   ["clothing", "shoes", "accessories", "fashion", "beauty", "skincare", "fragrance", "jewelry"],
  play:   ["videogame", "board game", "sport", "activity", "hobby", "card game", "puzzle", "outdoor game"],
};

async function inferCategory(rec) {
  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    messages: [{
      role: "user",
      content: `Given this recommendation, assign the single best category from this list: ${VALID_CATEGORIES.join(", ")}, other

Return ONLY the category word (lowercase). Return "other" if none of the specific categories clearly fit.

Title: ${rec.title}
Context: ${rec.context || "none"}
Existing tags: ${(rec.tags || []).join(", ") || "none"}

Answer:`
    }]
  });

  const answer = response.content[0].text.trim().toLowerCase();
  if (answer === "other" || ![...VALID_CATEGORIES, "other"].includes(answer)) return null;
  return answer;
}

async function inferContentTypeTag(rec, category) {
  const allowed = CONTENT_TYPE_TAGS[category];
  if (!allowed) return null;

  const existingTags = (rec.tags || []).map(t => t.toLowerCase());
  if (allowed.some(ct => existingTags.includes(ct))) return null; // already has one

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 20,
    messages: [{
      role: "user",
      content: `Given this recommendation, return the single most specific content-type tag from the allowed list. Return ONLY the tag (lowercase) or "null" if you are not confident.

Title: ${rec.title}
Category: ${category}
Context: ${rec.context || "none"}
Existing tags: ${(rec.tags || []).join(", ") || "none"}

Allowed tags for "${category}": ${allowed.join(", ")}

Answer:`
    }]
  });

  const answer = response.content[0].text.trim().toLowerCase();
  if (answer === "null" || !allowed.includes(answer)) return null;
  return answer;
}

async function recategorize() {
  const { data: recs, error } = await supabase
    .from("recommendations")
    .select("id, category, tags, title, context")
    .eq("category", "other");

  if (error) {
    console.error("Failed to fetch recommendations:", error);
    process.exit(1);
  }

  console.log(`Found ${recs.length} recs with category "other"\n`);

  let recategorized = 0;
  let kept = 0;

  for (const rec of recs) {
    const newCategory = await inferCategory(rec);

    if (!newCategory) {
      console.log(`  – "${rec.title}" → stays "other" (Claude not confident)`);
      kept++;
      continue;
    }

    // Check if we need a content-type tag too
    const contentTag = await inferContentTypeTag(rec, newCategory);
    const newTags = contentTag ? [...(rec.tags || []), contentTag] : rec.tags;

    const update = { category: newCategory };
    if (contentTag) update.tags = newTags;

    const { error: updateError } = await supabase
      .from("recommendations")
      .update(update)
      .eq("id", rec.id);

    if (updateError) {
      console.error(`  ✗ Failed to update "${rec.title}" (${rec.id}):`, updateError.message);
    } else {
      const tagNote = contentTag ? ` + added tag "${contentTag}"` : "";
      console.log(`  ✓ "${rec.title}" → other → ${newCategory}${tagNote}`);
      recategorized++;
    }
  }

  console.log(`\nDone.`);
  console.log(`  Recategorized: ${recategorized}`);
  console.log(`  Kept as "other": ${kept}`);
}

recategorize();

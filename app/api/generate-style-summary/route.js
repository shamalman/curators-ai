import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: { "anthropic-no-log": "true" },
});

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  try {
    const { profileId } = await request.json();
    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Fetch curator's approved recs
    const { data: recs } = await sb
      .from("recommendations")
      .select("title, category, context, tags")
      .eq("profile_id", profileId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!recs || recs.length < 3) {
      return NextResponse.json({ error: "Not enough recs" }, { status: 400 });
    }

    // Fetch last 20 chat messages
    const { data: chatMsgs } = await sb
      .from("chat_messages")
      .select("role, text")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(20);

    const chatExcerpts = (chatMsgs || [])
      .reverse()
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    const recsJson = JSON.stringify(recs.map(r => ({
      title: r.title,
      category: r.category,
      context: r.context || "",
      tags: r.tags || [],
    })));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `Analyze this curator's recommendations and chat history. Generate a style summary that captures their voice, personality, and curatorial style. This will power their visitor AI to sound like them.

Recommendations: ${recsJson}
Chat excerpts: ${chatExcerpts}

Respond with JSON only, no markdown, no backticks:
{
  "voice": "2-3 word style descriptor",
  "voice_description": "1-2 sentences describing how they communicate",
  "energy": "conviction level and tone",
  "signature_patterns": ["3-5 recurring patterns in their recs"],
  "categories": ["their primary categories"],
  "location": "their city/region if known",
  "aesthetic_threads": ["1-3 cross-category taste patterns"]
}`
      }],
    });

    const text = response.content[0]?.text || "";
    let styleSummary;
    try {
      styleSummary = JSON.parse(text);
    } catch {
      console.error("Failed to parse style summary JSON:", text);
      return NextResponse.json({ error: "Invalid response format" }, { status: 500 });
    }

    // Save to profiles.style_summary
    const { error: updateError } = await sb
      .from("profiles")
      .update({ style_summary: styleSummary })
      .eq("id", profileId);

    if (updateError) {
      console.error("Failed to save style summary:", updateError);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ success: true, styleSummary });
  } catch (error) {
    console.error("Style summary generation error:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}

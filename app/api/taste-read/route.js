import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadSkill } from "../../../lib/prompts/loader.js";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

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

async function getAuthUser(cookieStore) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function stripFences(text) {
  return String(text || "")
    .replace(/^\s*```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { parsed_content, source_url, rec_file_id } = await request.json();
    if (!parsed_content || typeof parsed_content !== "string") {
      return NextResponse.json({ error: "parsed_content is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error("[TASTE_READ_V2] profile lookup failed:", profileErr?.message);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const profileId = profile.id;

    // Load taste profile (markdown content) and last 15 own recs in parallel.
    const [{ data: tasteProfileRow }, { data: recentRecs }] = await Promise.all([
      admin
        .from("taste_profiles")
        .select("content")
        .eq("profile_id", profileId)
        .maybeSingle(),
      admin
        .from("recommendations")
        .select("title, category, context")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    const tasteProfileContent = tasteProfileRow?.content || null;
    const recsBlock = (recentRecs || [])
      .map(r => `- ${r.title} (${r.category || "other"}): ${r.context || ""}`)
      .join("\n");

    const skill = loadSkill("taste-read");

    const systemPrompt =
      skill +
      "\n\nCURATOR TASTE PROFILE:\n" +
      (tasteProfileContent || "No taste profile yet. This is an early share.") +
      "\n\nRECENT RECOMMENDATIONS (for context, do not infer from these unless the current content genuinely connects to them):\n" +
      (recsBlock || "(none)") +
      "\n\nPARSED CONTENT:\n" +
      parsed_content;

    const t0 = Date.now();
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        { role: "user", content: "Produce the taste read JSON for the parsed content above." },
      ],
    });
    const elapsedMs = Date.now() - t0;

    const raw = message.content[0]?.text || "";
    let parsed;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch (parseErr) {
      console.error("[TASTE_READ_V2] JSON parse failed:", parseErr.message, "raw:", raw.slice(0, 400));
      return NextResponse.json({ error: "Failed to parse taste read response" }, { status: 500 });
    }

    const extraction = typeof parsed.extraction === "string" ? parsed.extraction : "";
    const inferences = Array.isArray(parsed.inferences)
      ? parsed.inferences
          .filter(i => i && typeof i.text === "string" && i.text.trim())
          .map((i, idx) => ({ id: String(i.id ?? idx + 1), text: i.text.trim() }))
      : [];

    if (!extraction || inferences.length === 0) {
      console.error("[TASTE_READ_V2] empty or malformed payload:", JSON.stringify(parsed).slice(0, 400));
      return NextResponse.json({ error: "Malformed taste read response" }, { status: 500 });
    }

    console.log(`[TASTE_READ_V2] profileId=${profileId} source_url=${source_url || "-"} rec_file_id=${rec_file_id || "-"} inferences=${inferences.length} elapsed_ms=${elapsedMs}`);

    return NextResponse.json({ extraction, inferences });
  } catch (err) {
    console.error("[TASTE_READ_V2] error:", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

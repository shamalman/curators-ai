import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateTasteProfile } from "../../../../lib/taste-profile/generate.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function buildSourceKey(rec_file_id, source_url) {
  if (rec_file_id) return `taste_read:${rec_file_id}`;
  if (source_url) return `taste_read:${source_url}`;
  return "taste_read:unknown";
}

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inference_text, source_url, rec_file_id } = body || {};
    // DEPLOY 3 CLEANUP: v1 bridge accepts legacy { url } shape (and falls back
    // to source_url as the lookup key). Remove this alias along with the v1
    // bridge branch below when the chat route migrates to taste_read_card
    // content blocks.
    const legacyUrl = body?.url || source_url;

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error("[TASTE_READ_CONFIRM] profile lookup failed:", profileErr?.message);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const profileId = profile.id;

    let observation = typeof inference_text === "string" ? inference_text.trim() : "";
    let sourceKey = buildSourceKey(rec_file_id, source_url);

    // DEPLOY 3 CLEANUP: Remove this v1 bridge when chat route migrates to
    // taste_read_card content blocks. Entire branch (url-only body) should
    // be deleted along with the meta.taste_read_observation write path in
    // app/api/chat/route.js.
    if (!observation && legacyUrl) {
      const { data: msgRow, error: msgErr } = await admin
        .from("chat_messages")
        .select("id, meta")
        .eq("profile_id", profileId)
        .eq("role", "assistant")
        .eq("meta->>taste_read_url", legacyUrl)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (msgErr) {
        console.error("[TASTE_READ_CONFIRM] v1 bridge lookup failed:", msgErr.message);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
      }
      const legacyObservation = msgRow?.meta?.taste_read_observation;
      if (!legacyObservation) {
        return NextResponse.json({ error: "No taste read observation found for this URL" }, { status: 400 });
      }
      observation = String(legacyObservation).trim();
      sourceKey = `taste_read:${legacyUrl}`;
      console.log(`[TASTE_READ_V1_BRIDGE] profileId=${profileId} url=${legacyUrl} msgId=${msgRow.id}`);
    }

    if (!observation) {
      return NextResponse.json({ error: "inference_text is required" }, { status: 400 });
    }

    const { error: insertErr } = await admin
      .from("taste_confirmations")
      .insert({
        profile_id: profileId,
        type: "taste_read_confirmed",
        observation,
        source: sourceKey,
      });

    if (insertErr) {
      console.error("[TASTE_READ_CONFIRM] insert failed:", insertErr.message);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    // Fire-and-forget: regenerate the Taste File via direct import.
    (async () => {
      try {
        await generateTasteProfile(profileId, admin);
        console.log("[TASTE_READ_CONFIRM] taste profile regenerated for", profileId);
      } catch (err) {
        console.error("[TASTE_READ_CONFIRM] taste profile regen failed:", err?.message || err);
      }
    })();

    console.log(`[TASTE_READ_CONFIRM] profileId=${profileId} source=${sourceKey} observationLength=${observation.length}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TASTE_READ_CONFIRM]", err?.message || err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

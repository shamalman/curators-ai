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

    const observation = typeof inference_text === "string" ? inference_text.trim() : "";
    const sourceKey = buildSourceKey(rec_file_id, source_url);

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

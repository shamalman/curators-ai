import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inference_text, source_url, rec_file_id } = await request.json();
    const text = typeof inference_text === "string" ? inference_text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "inference_text is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error("[TASTE_READ_IGNORE] profile lookup failed:", profileErr?.message);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const profileId = profile.id;

    const { error: insertErr } = await admin
      .from("taste_read_ignores")
      .insert({
        profile_id: profileId,
        inference_text: text,
        source_rec_file_id: rec_file_id || null,
        source_url: source_url || null,
      });

    if (insertErr) {
      console.error("[TASTE_READ_IGNORE] insert failed:", insertErr.message);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    console.log(`[TASTE_READ_IGNORE] profileId=${profileId} rec_file_id=${rec_file_id || "-"} source_url=${source_url || "-"} textLength=${text.length}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TASTE_READ_IGNORE]", err?.message || err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

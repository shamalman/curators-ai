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

export async function DELETE(request) {
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
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    const profileId = profile.id;

    let q = admin
      .from("taste_read_ignores")
      .select("id")
      .eq("profile_id", profileId)
      .eq("inference_text", text);
    q = rec_file_id ? q.eq("source_rec_file_id", rec_file_id) : q.is("source_rec_file_id", null);
    q = source_url ? q.eq("source_url", source_url) : q.is("source_url", null);

    const { data: row, error: selErr } = await q
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selErr) {
      console.error("[TASTE_READ_IGNORE_UNDO] select failed:", selErr.message);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const { error: delErr } = await admin
      .from("taste_read_ignores")
      .delete()
      .eq("id", row.id);
    if (delErr) {
      console.error("[TASTE_READ_IGNORE_UNDO] delete failed:", delErr.message);
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    console.log(`[TASTE_READ_IGNORE_UNDO] profileId=${profileId} rec_file_id=${rec_file_id || "-"} source_url=${source_url || "-"}`);
    return NextResponse.json({ ok: true, deleted: 1 });
  } catch (err) {
    console.error("[TASTE_READ_IGNORE_UNDO]", err?.message || err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

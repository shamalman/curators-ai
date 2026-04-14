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

function matchTasteRead(query, profileId, source_url, rec_file_id) {
  query = query.eq("profile_id", profileId);
  if (rec_file_id) return query.eq("rec_file_id", rec_file_id);
  return query.eq("source_url", source_url).is("rec_file_id", null);
}

export async function PATCH(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      source_url = null,
      rec_file_id = null,
      states,
      refined_texts,
      collapsed,
      dismissed,
      done,
    } = body || {};

    if (!source_url && !rec_file_id) {
      return NextResponse.json({ error: "source_url or rec_file_id is required" }, { status: 400 });
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

    // Load current row (needed for JSONB merges).
    let selQuery = admin
      .from("taste_reads")
      .select("id, states, refined_texts");
    selQuery = matchTasteRead(selQuery, profileId, source_url, rec_file_id);
    const { data: current, error: selErr } = await selQuery.maybeSingle();

    if (selErr) {
      console.error("[TASTE_READ_STATE_PATCH] select failed:", selErr.message);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const patch = { updated_at: new Date().toISOString() };

    if (states && typeof states === "object") {
      patch.states = { ...(current.states || {}), ...states };
    }
    if (refined_texts && typeof refined_texts === "object") {
      patch.refined_texts = { ...(current.refined_texts || {}), ...refined_texts };
    }
    if (typeof collapsed === "boolean") patch.collapsed = collapsed;
    if (typeof dismissed === "boolean") patch.dismissed = dismissed;
    if (typeof done === "boolean") patch.done = done;

    const { error: updErr } = await admin
      .from("taste_reads")
      .update(patch)
      .eq("id", current.id);

    if (updErr) {
      console.error("[TASTE_READ_STATE_PATCH] update failed:", updErr.message);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    console.log(`[TASTE_READ_STATE_PATCH] profileId=${profileId} source_url=${source_url || "-"} rec_file_id=${rec_file_id || "-"} keys=${Object.keys(patch).filter(k => k !== "updated_at").join(",")}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TASTE_READ_STATE_PATCH] error:", err?.message || err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

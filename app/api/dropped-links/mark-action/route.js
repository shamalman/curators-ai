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

    const { url, action } = await request.json();
    if (!url || !action) {
      return NextResponse.json({ error: "url and action are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error('[DROPPED_LINKS_ACTION] profile lookup failed:', profileErr?.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    const nowIso = new Date().toISOString();

    // Upsert pattern (fixes race with chat route's fire-and-forget insert):
    // 1) Try to update the most recent unacted row for this profile+url.
    // 2) If nothing matched, insert a new row with action_taken set immediately.
    const { data: existing, error: lookupErr } = await admin
      .from("dropped_links")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("url", url)
      .is("action_taken", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupErr) {
      console.error('[DROPPED_LINKS_ACTION] lookup failed:', lookupErr.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    if (existing) {
      const { error: updateErr } = await admin
        .from("dropped_links")
        .update({ action_taken: action, acted_at: nowIso })
        .eq("id", existing.id);
      if (updateErr) {
        console.error('[DROPPED_LINKS_ACTION] update failed:', updateErr.message);
        return NextResponse.json({ ok: false }, { status: 200 });
      }
      return NextResponse.json({ ok: true, matched: true });
    }

    // No unacted row exists yet — chat-route insert hasn't landed (or never will).
    // Insert a new row carrying the action so it's never lost.
    const { error: insertErr } = await admin
      .from("dropped_links")
      .insert({
        profile_id: profile.id,
        url,
        action_taken: action,
        acted_at: nowIso,
      });

    if (insertErr) {
      console.error('[DROPPED_LINKS_ACTION] insert failed:', insertErr.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true, matched: false, inserted: true });
  } catch (err) {
    console.error('[DROPPED_LINKS_ACTION]', err?.message || err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

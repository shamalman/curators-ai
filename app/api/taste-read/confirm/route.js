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

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error('[TASTE_READ_CONFIRM] profile lookup failed:', profileErr?.message);
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const profileId = profile.id;

    // Find the most recent assistant message whose meta.taste_read_url matches.
    const { data: msgRow, error: msgErr } = await admin
      .from("chat_messages")
      .select("id, meta")
      .eq("profile_id", profileId)
      .eq("role", "assistant")
      .eq("meta->>taste_read_url", url)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (msgErr) {
      console.error('[TASTE_READ_CONFIRM] message lookup failed:', msgErr.message);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    const observation = msgRow?.meta?.taste_read_observation;
    if (!msgRow || !observation) {
      return NextResponse.json({ error: "No taste read observation found for this URL" }, { status: 400 });
    }

    const { error: insertErr } = await admin
      .from("taste_confirmations")
      .insert({
        profile_id: profileId,
        type: "taste_read_confirmed",
        observation,
        source: `chat:${msgRow.id}`,
      });

    if (insertErr) {
      console.error('[TASTE_READ_CONFIRM] insert failed:', insertErr.message);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    // Fire-and-forget: bump the corresponding dropped_links row to taste_read_confirmed
    (async () => {
      try {
        // Match on profile+url only — the row may have action_taken=null (race)
        // or any prior action; we promote the most recent one to confirmed.
        const { data: dropRow, error: dropErr } = await admin
          .from("dropped_links")
          .select("id")
          .eq("profile_id", profileId)
          .eq("url", url)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (dropErr) {
          console.error('[TASTE_READ_CONFIRM] dropped_links lookup failed:', dropErr.message);
          return;
        }
        if (!dropRow) return;

        const { error: updErr } = await admin
          .from("dropped_links")
          .update({ action_taken: "taste_read_confirmed", acted_at: new Date().toISOString() })
          .eq("id", dropRow.id);
        if (updErr) {
          console.error('[TASTE_READ_CONFIRM] dropped_links update failed:', updErr.message);
        }
      } catch (e) {
        console.error('[TASTE_READ_CONFIRM] dropped_links side-effect:', e?.message || e);
      }
    })();

    // Fire-and-forget: regenerate the Taste File
    (async () => {
      try {
        const origin = request.nextUrl?.origin || new URL(request.url).origin;
        await fetch(`${origin}/api/generate-taste-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        });
      } catch (e) {
        console.error('[TASTE_READ_CONFIRM] taste-profile regen trigger failed:', e?.message || e);
      }
    })();

    console.log(`[TASTE_READ_CONFIRM] profileId=${profileId} url=${url} observationLength=${observation.length}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[TASTE_READ_CONFIRM]', err?.message || err);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}

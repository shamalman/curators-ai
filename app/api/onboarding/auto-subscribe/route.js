import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req) {
  try {
    const { profileId, inviterId } = await req.json();

    if (!profileId || !inviterId || !UUID_RE.test(profileId) || !UUID_RE.test(inviterId)) {
      console.error(`[AUTO_SUBSCRIBE] result=bad_request profileId=${profileId} inviterId=${inviterId}`);
      return NextResponse.json({ ok: false, error: "invalid_ids" }, { status: 400 });
    }

    if (profileId === inviterId) {
      console.error(`[AUTO_SUBSCRIBE] result=self_subscribe profileId=${profileId}`);
      return NextResponse.json({ ok: false, error: "self_subscribe" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Defense: confirm profileId.invited_by actually equals inviterId
    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("invited_by")
      .eq("id", profileId)
      .maybeSingle();

    if (profileErr) {
      console.error(`[AUTO_SUBSCRIBE] result=profile_lookup_error profileId=${profileId} error=${profileErr.message}`);
      return NextResponse.json({ ok: false, error: "profile_lookup" }, { status: 500 });
    }
    if (!profile) {
      console.error(`[AUTO_SUBSCRIBE] result=profile_not_found profileId=${profileId}`);
      return NextResponse.json({ ok: false, error: "profile_not_found" }, { status: 404 });
    }
    if (profile.invited_by !== inviterId) {
      console.error(`[AUTO_SUBSCRIBE] result=mismatch profileId=${profileId} claimed=${inviterId} actual=${profile.invited_by}`);
      return NextResponse.json({ ok: false, error: "inviter_mismatch" }, { status: 403 });
    }

    // Check for existing row (handles resubscribe case — clear unsubscribed_at)
    const { data: existing, error: existingErr } = await sb
      .from("subscriptions")
      .select("id, unsubscribed_at")
      .eq("subscriber_id", profileId)
      .eq("curator_id", inviterId)
      .maybeSingle();

    if (existingErr) {
      console.error(`[AUTO_SUBSCRIBE] result=existing_lookup_error profileId=${profileId} error=${existingErr.message}`);
      return NextResponse.json({ ok: false, error: "existing_lookup" }, { status: 500 });
    }

    if (existing) {
      if (existing.unsubscribed_at) {
        const { error: reactivateErr } = await sb
          .from("subscriptions")
          .update({ unsubscribed_at: null, subscribed_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (reactivateErr) {
          console.error(`[AUTO_SUBSCRIBE] result=reactivate_error profileId=${profileId} inviterId=${inviterId} error=${reactivateErr.message}`);
          return NextResponse.json({ ok: false, error: "reactivate" }, { status: 500 });
        }
        console.log(`[AUTO_SUBSCRIBE] result=reactivated profileId=${profileId} inviterId=${inviterId}`);
        return NextResponse.json({ ok: true, result: "reactivated" });
      }
      console.log(`[AUTO_SUBSCRIBE] result=exists profileId=${profileId} inviterId=${inviterId}`);
      return NextResponse.json({ ok: true, result: "exists" });
    }

    const { error: insertErr } = await sb
      .from("subscriptions")
      .insert({
        subscriber_id: profileId,
        curator_id: inviterId,
        subscribed_at: new Date().toISOString(),
        digest_frequency: "weekly",
      });

    if (insertErr) {
      // Unique violation race — treat as success
      if (insertErr.code === "23505") {
        console.log(`[AUTO_SUBSCRIBE] result=exists_race profileId=${profileId} inviterId=${inviterId}`);
        return NextResponse.json({ ok: true, result: "exists_race" });
      }
      console.error(`[AUTO_SUBSCRIBE] result=insert_error profileId=${profileId} inviterId=${inviterId} code=${insertErr.code} error=${insertErr.message}`);
      return NextResponse.json({ ok: false, error: "insert" }, { status: 500 });
    }

    console.log(`[AUTO_SUBSCRIBE] result=created profileId=${profileId} inviterId=${inviterId}`);
    return NextResponse.json({ ok: true, result: "created" });
  } catch (err) {
    console.error(`[AUTO_SUBSCRIBE] result=unexpected error=${err.message}`);
    return NextResponse.json({ ok: false, error: "unexpected" }, { status: 500 });
  }
}

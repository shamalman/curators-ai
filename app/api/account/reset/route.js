import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { profileId } = await request.json();
    if (!profileId) {
      return Response.json({ error: "profileId is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Validate profileId belongs to authenticated user
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("id", profileId)
      .single();

    if (profileErr || !profile || profile.auth_user_id !== user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // TODO (product decision, April 10, 2026): The reset route currently leaves
    // these tables untouched for the resetting curator:
    //   - taste_profiles (their Taste File persists across reset)
    //   - taste_confirmations (confirmed taste observations persist)
    //   - rec_files, rec_blocks (.rec migration artifacts persist)
    //   - subscriptions, subscribers (network connections persist)
    //   - link_parse_log (parse history persists)
    //
    // Is this intentional preservation ("re-onboard with context intact") or
    // stale code from before these tables existed? Decide and either:
    //   (a) document the preservation rationale here, or
    //   (b) add the missing deletes to the cascade.
    //
    // Flagged during schema audit round 2 recon. See ai-behavior-issues.md.

    // Delete in order to respect foreign key constraints

    // 1. Agent jobs
    const { error: agentErr } = await admin
      .from("agent_jobs")
      .delete()
      .eq("profile_id", profileId);
    if (agentErr) console.error("Reset: failed to delete agent_jobs:", agentErr);

    // 2. Chat messages
    const { error: chatErr } = await admin
      .from("chat_messages")
      .delete()
      .eq("profile_id", profileId);
    if (chatErr) console.error("Reset: failed to delete chat_messages:", chatErr);

    // 3. Notification log (recipient or curator)
    const { error: notifErr1 } = await admin
      .from("notification_log")
      .delete()
      .eq("recipient_id", profileId);
    if (notifErr1) console.error("Reset: failed to delete notification_log (recipient):", notifErr1);
    const { error: notifErr2 } = await admin
      .from("notification_log")
      .delete()
      .eq("curator_id", profileId);
    if (notifErr2) console.error("Reset: failed to delete notification_log (curator):", notifErr2);

    // 4. Email tokens
    const { error: tokenErr } = await admin
      .from("email_tokens")
      .delete()
      .eq("profile_id", profileId);
    if (tokenErr) console.error("Reset: failed to delete email_tokens:", tokenErr);

    // 5. Feedback
    const { error: feedbackErr } = await admin
      .from("feedback")
      .delete()
      .eq("profile_id", profileId);
    if (feedbackErr) console.error("Reset: failed to delete feedback:", feedbackErr);

    // 6. Revisions + saved recs for this profile's recommendations
    const { data: recs } = await admin
      .from("recommendations")
      .select("id")
      .eq("profile_id", profileId);
    if (recs && recs.length > 0) {
      const recIds = recs.map(r => r.id);
      const { error: revErr } = await admin
        .from("revisions")
        .delete()
        .in("recommendation_id", recIds);
      if (revErr) console.error("Reset: failed to delete revisions:", revErr);

      const { error: savedErr } = await admin
        .from("saved_recs")
        .delete()
        .in("recommendation_id", recIds);
      if (savedErr) console.error("Reset: failed to delete saved_recs for recs:", savedErr);
    }

    // 7. Recommendations
    const { error: recErr } = await admin
      .from("recommendations")
      .delete()
      .eq("profile_id", profileId);
    if (recErr) console.error("Reset: failed to delete recommendations:", recErr);

    // 8. User's own saved recs
    const { error: userSavedErr } = await admin
      .from("saved_recs")
      .delete()
      .eq("user_id", profileId);
    if (userSavedErr) console.error("Reset: failed to delete user saved_recs:", userSavedErr);

    // 9. Reset profile fields to blank state + re-enter onboarding
    const { error: profileResetErr } = await admin
      .from("profiles")
      .update({
        bio: null,
        location: null,
        onboarding_complete: false,
        last_seen_at: null,
        last_action: null,
        last_action_at: null,
      })
      .eq("id", profileId);
    if (profileResetErr) console.error("Reset: failed to reset profile:", profileResetErr);

    return Response.json({ status: "reset_complete" });
  } catch (error) {
    console.error("Account reset error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

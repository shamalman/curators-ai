import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ── Look up inviter info for onboarding mode ──
export async function getInviterContext(profileId) {
  try {
    const sb = getSupabaseAdmin();

    // Get the curator's invited_by
    const { data: profile } = await sb
      .from("profiles")
      .select("invited_by")
      .eq("id", profileId)
      .single();

    if (!profile?.invited_by) return { inviterName: null, inviterHandle: null, inviterNote: null };

    // Get inviter's profile
    const { data: inviter } = await sb
      .from("profiles")
      .select("name, handle")
      .eq("id", profile.invited_by)
      .single();

    // Get the inviter_note from the invite code that was used for this curator
    const { data: inviteCode } = await sb
      .from("invite_codes")
      .select("inviter_note")
      .eq("used_by", profileId)
      .single();

    return {
      inviterName: inviter?.name || null,
      inviterHandle: inviter?.handle || null,
      inviterNote: inviteCode?.inviter_note || null,
    };
  } catch (err) {
    console.error("Failed to look up inviter context:", err);
    return { inviterName: null, inviterHandle: null, inviterNote: null };
  }
}

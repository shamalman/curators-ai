import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rand = "";
  for (let i = 0; i < 6; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `CURATORS-${rand}`;
}

const MAX_UNUSED = 5;

// GET: Fetch or generate an invite code, or return history
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const isHistory = searchParams.get("history") === "1";

    if (isHistory) {
      // Fetch all codes created by this curator
      const { data: allCodes } = await sb
        .from("invite_codes")
        .select("id, code, used_at, inviter_note")
        .eq("created_by", profileId)
        .order("created_at", { ascending: false })
        .limit(20);

      // Fetch all profiles invited by this curator
      const { data: invitedProfiles } = await sb
        .from("profiles")
        .select("name, handle, created_at")
        .eq("invited_by", profileId)
        .order("created_at", { ascending: false });

      // Match used codes to profiles by timestamp proximity
      const usedCodes = (allCodes || []).filter(c => c.used_at);
      const profilePool = [...(invitedProfiles || [])];

      const history = (allCodes || []).map(inv => {
        const entry = { ...inv, profile_name: null, profile_handle: null };
        if (inv.used_at && profilePool.length > 0) {
          // Find closest profile by created_at to used_at
          let bestIdx = 0;
          let bestDiff = Infinity;
          const usedTime = new Date(inv.used_at).getTime();
          profilePool.forEach((p, idx) => {
            const diff = Math.abs(new Date(p.created_at).getTime() - usedTime);
            if (diff < bestDiff) { bestDiff = diff; bestIdx = idx; }
          });
          if (bestDiff < 86400000) { // within 24 hours
            const p = profilePool.splice(bestIdx, 1)[0];
            entry.profile_name = p.name;
            entry.profile_handle = p.handle;
          }
        }
        return entry;
      });

      return NextResponse.json({ history });
    }

    // Get all unused codes by this curator
    const { data: unusedCodes } = await sb
      .from("invite_codes")
      .select("id, code, inviter_note")
      .eq("created_by", profileId)
      .is("used_at", null)
      .order("created_at", { ascending: false });

    const unused = unusedCodes || [];

    if (unused.length > 0) {
      return NextResponse.json({ code: unused[0], unusedCount: unused.length });
    }

    // No unused codes — auto-generate one
    const newCode = generateCode();
    const { data: created, error: insertErr } = await sb
      .from("invite_codes")
      .insert({ code: newCode, created_by: profileId })
      .select("id, code, inviter_note")
      .single();

    if (insertErr) {
      console.error("Failed to create invite code:", insertErr);
      return NextResponse.json({ error: "Failed to generate code" }, { status: 500 });
    }

    return NextResponse.json({ code: created, unusedCount: 1 });
  } catch (error) {
    console.error("Invite fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}

// POST: Update inviter_note or generate a new code
export async function POST(request) {
  try {
    const { codeId, inviterNote, profileId, action } = await request.json();

    const sb = getSupabaseAdmin();

    if (action === "generate") {
      if (!profileId) {
        return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
      }

      const { data: unusedCodes } = await sb
        .from("invite_codes")
        .select("id")
        .eq("created_by", profileId)
        .is("used_at", null);

      if ((unusedCodes || []).length >= MAX_UNUSED) {
        return NextResponse.json({ error: "limit_reached", max: MAX_UNUSED }, { status: 429 });
      }

      const newCode = generateCode();
      const { data: created, error: insertErr } = await sb
        .from("invite_codes")
        .insert({ code: newCode, created_by: profileId })
        .select("id, code, inviter_note")
        .single();

      if (insertErr) {
        console.error("Failed to create invite code:", insertErr);
        return NextResponse.json({ error: "Failed to generate code" }, { status: 500 });
      }

      return NextResponse.json({ code: created });
    }

    // Update inviter_note
    if (!codeId) {
      return NextResponse.json({ error: "Missing codeId" }, { status: 400 });
    }

    const { error } = await sb
      .from("invite_codes")
      .update({ inviter_note: inviterNote || null })
      .eq("id", codeId);

    if (error) {
      console.error("Failed to update inviter_note:", error);
      return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Invite update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

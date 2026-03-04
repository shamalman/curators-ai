import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET: Fetch an unused invite code for this curator
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profileId");
    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Look for an unused code created by this curator
    const { data: code } = await sb
      .from("invite_codes")
      .select("id, code, inviter_note")
      .eq("created_by", profileId)
      .is("used_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!code) {
      return NextResponse.json({ code: null });
    }

    return NextResponse.json({ code });
  } catch (error) {
    console.error("Invite fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch invite" }, { status: 500 });
  }
}

// POST: Update inviter_note on an invite code
export async function POST(request) {
  try {
    const { codeId, inviterNote } = await request.json();
    if (!codeId) {
      return NextResponse.json({ error: "Missing codeId" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

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

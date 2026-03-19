import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateTasteProfile } from "../../../lib/taste-profile/generate.js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  try {
    const { profileId } = await request.json();
    if (!profileId) {
      return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Verify profile exists
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('id', profileId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const result = await generateTasteProfile(profileId, sb);
    return NextResponse.json({ success: true, version: result.version });
  } catch (err) {
    console.error('Taste profile generation failed:', err);
    return NextResponse.json({ error: err.message || 'Generation failed' }, { status: 500 });
  }
}
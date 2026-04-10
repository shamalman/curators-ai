// app/api/recs/sign-artifact/route.js
//
// Bug 3 fix: On-demand signed URL regeneration for artifacts.
// Called when a persisted image save button is tapped after a DB reload
// (the original signed URL has expired or was never stored).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

export async function POST(request) {
  try {
    const { profileId, artifactPath } = await request.json();

    if (!profileId || !artifactPath) {
      return NextResponse.json({ error: "profileId and artifactPath are required" }, { status: 400 });
    }

    // Validate that the artifact path belongs to this curator (path starts with profileId)
    if (!artifactPath.startsWith(profileId + "/")) {
      return NextResponse.json({ error: "artifact does not belong to this curator" }, { status: 403 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .storage
      .from("artifacts")
      .createSignedUrl(artifactPath, 3600);

    if (error) {
      console.error(`[SIGN_ARTIFACT_ERROR] path=${artifactPath} profileId=${profileId} error=${error.message}`);
      return NextResponse.json({ error: "failed to generate signed URL" }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (err) {
    console.error(`[SIGN_ARTIFACT_ERROR] error=${err?.message || err}`);
    return NextResponse.json({ error: "sign artifact failed" }, { status: 500 });
  }
}

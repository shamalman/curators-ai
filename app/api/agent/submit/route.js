import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { detectSource } from "../../../../lib/agent/registry.js";

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

    const { url, profileId } = await request.json();
    if (!url || !profileId) {
      return Response.json({ error: "url and profileId are required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Validate profileId belongs to authenticated user
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("id", profileId)
      .single();

    if (profileErr || !profile) {
      console.error("Profile lookup error:", profileErr);
      return Response.json({ error: "Profile not found" }, { status: 404 });
    }

    if (profile.auth_user_id !== user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Detect source
    const detection = detectSource(url);

    // Unsupported source — log it and return
    if (!detection.supported) {
      const { error: insertErr } = await admin
        .from("unsupported_source_requests")
        .insert({
          profile_id: profileId,
          source_url: url,
          source_type: "unknown",
        });

      if (insertErr) {
        console.error("Failed to log unsupported source:", insertErr);
      }

      return Response.json({ supported: false });
    }

    // Single item — return classification only (chat handles it)
    if (detection.classification === "single_item") {
      return Response.json({
        supported: true,
        classification: "single_item",
        sourceType: detection.sourceType,
        parserName: detection.parserName,
      });
    }

    // Supported but not yet implemented (stubs)
    if (!detection.implemented) {
      return Response.json({
        supported: true,
        comingSoon: true,
        sourceType: detection.sourceType,
        parserName: detection.parserName,
      });
    }

    // Profile source — create agent job
    const { data: job, error: jobErr } = await admin
      .from("agent_jobs")
      .insert({
        profile_id: profileId,
        source_type: detection.sourceType,
        source_url: url,
        status: "pending",
      })
      .select("id")
      .single();

    if (jobErr) {
      console.error("Failed to create agent job:", jobErr);
      return Response.json({ error: "Failed to create job" }, { status: 500 });
    }

    // Kick off processing (fire-and-forget, don't await)
    const processUrl = new URL("/api/agent/process", request.url);
    fetch(processUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: job.id }),
    }).catch((err) => {
      console.error("Failed to trigger process route:", err);
    });

    return Response.json({
      supported: true,
      jobId: job.id,
      status: "processing",
      sourceType: detection.sourceType,
    });
  } catch (error) {
    console.error("Agent submit error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

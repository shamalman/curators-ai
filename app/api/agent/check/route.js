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

function sourceName(sourceType) {
  if (sourceType === "spotify") return "Spotify";
  if (sourceType === "apple_music") return "Apple Music";
  if (sourceType === "google_maps") return "Google Maps";
  if (sourceType === "youtube") return "YouTube";
  if (sourceType === "letterboxd") return "Letterboxd";
  if (sourceType === "goodreads") return "Goodreads";
  if (sourceType === "soundcloud") return "SoundCloud";
  if (sourceType === "webpage") return "Webpage";
  return sourceType;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return Response.json({ jobs: [] });
    }

    const admin = getSupabaseAdmin();

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile) {
      return Response.json({ jobs: [] });
    }

    // Find completed but unpresented agent jobs
    const { data: jobs, error } = await admin
      .from("agent_jobs")
      .select("id, source_type")
      .eq("profile_id", profile.id)
      .eq("status", "completed")
      .is("presented_at", null)
      .order("completed_at", { ascending: false });

    if (error || !jobs) {
      return Response.json({ jobs: [] });
    }

    // Also check for processing jobs
    const { data: processingJobs } = await admin
      .from("agent_jobs")
      .select("id, source_type")
      .eq("profile_id", profile.id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false });

    return Response.json({
      jobs: jobs.map(j => ({
        jobId: j.id,
        sourceType: j.source_type,
        sourceName: sourceName(j.source_type),
      })),
      processing: (processingJobs || []).map(j => ({
        jobId: j.id,
        sourceType: j.source_type,
        sourceName: sourceName(j.source_type),
      })),
    });
  } catch (error) {
    console.error("Agent check error:", error);
    return Response.json({ jobs: [], processing: [] });
  }
}

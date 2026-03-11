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

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return Response.json({ error: "jobId is required" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // Fetch the job
    const { data: job, error: jobErr } = await admin
      .from("agent_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      console.error("Job lookup error:", jobErr);
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    // Verify job belongs to authenticated user's profile
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    if (!profile || job.profile_id !== profile.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    return Response.json(job);
  } catch (error) {
    console.error("Agent status error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

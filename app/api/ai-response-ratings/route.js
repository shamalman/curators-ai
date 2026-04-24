import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function getCallerProfile(admin, authUserId) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, ai_profile")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !data) return null;
  return data;
}

// POST — create or update a rating. Snapshots ai_profile at first-rating time;
// subsequent flips update rating only (ai_profile stays frozen).
// Body: { message_id: uuid, rating: 'up' | 'down' }
export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message_id, rating } = await request.json();
    if (!message_id || !["up", "down"].includes(rating)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const profile = await getCallerProfile(admin, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data: existing, error: selErr } = await admin
      .from("ai_response_ratings")
      .select("id, ai_profile")
      .eq("message_id", message_id)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (selErr) {
      console.error("[AI_RATING_WRITE_ERROR]", selErr.message);
      return NextResponse.json({ error: "Write failed" }, { status: 500 });
    }

    if (existing) {
      const { error: updErr } = await admin
        .from("ai_response_ratings")
        .update({ rating })
        .eq("id", existing.id);
      if (updErr) {
        console.error("[AI_RATING_WRITE_ERROR]", updErr.message);
        return NextResponse.json({ error: "Write failed" }, { status: 500 });
      }
    } else {
      const { error: insErr } = await admin
        .from("ai_response_ratings")
        .insert({
          message_id,
          profile_id: profile.id,
          rating,
          ai_profile: profile.ai_profile || "stable",
        });
      if (insErr) {
        console.error("[AI_RATING_WRITE_ERROR]", insErr.message);
        return NextResponse.json({ error: "Write failed" }, { status: 500 });
      }
    }

    const snapshotAiProfile = existing?.ai_profile || profile.ai_profile || "stable";
    console.log(`[AI_RATING] profileId=${profile.id} messageId=${message_id} rating=${rating} aiProfile=${snapshotAiProfile} op=${existing ? "update" : "insert"}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[AI_RATING_ERROR]", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — clear a rating
// Body: { message_id: uuid }
export async function DELETE(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message_id } = await request.json();
    if (!message_id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const profile = await getCallerProfile(admin, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("ai_response_ratings")
      .delete()
      .eq("message_id", message_id)
      .eq("profile_id", profile.id);

    if (error) {
      console.error("[AI_RATING_DELETE_ERROR]", error.message);
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    console.log(`[AI_RATING_CLEARED] profileId=${profile.id} messageId=${message_id}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[AI_RATING_ERROR]", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// GET — fetch caller's existing ratings for a set of message IDs
// Query: ?message_ids=uuid1,uuid2,uuid3
export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("message_ids") || "";
    const ids = idsParam.split(",").filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ ratings: {} });
    }

    const admin = getSupabaseAdmin();
    const profile = await getCallerProfile(admin, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("ai_response_ratings")
      .select("message_id, rating")
      .eq("profile_id", profile.id)
      .in("message_id", ids);

    if (error) {
      console.error("[AI_RATING_READ_ERROR]", error.message);
      return NextResponse.json({ error: "Read failed" }, { status: 500 });
    }

    const ratings = {};
    for (const row of data || []) {
      ratings[row.message_id] = row.rating;
    }
    return NextResponse.json({ ratings });
  } catch (err) {
    console.error("[AI_RATING_ERROR]", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

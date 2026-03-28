import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  try {
    const { authToken, filterDays } = await request.json();

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sb = getSupabaseAdmin();

    // Verify the caller is shamal
    const { data: { user }, error: authErr } = await sb.auth.getUser(authToken);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: prof } = await sb
      .from('profiles')
      .select('handle')
      .eq('auth_user_id', user.id)
      .single();

    if (!prof || prof.handle !== 'shamal') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all profiles
    const { data: profiles, error: profErr } = await sb
      .from('profiles')
      .select('id, handle, name');

    if (profErr) {
      return NextResponse.json({ error: "Failed to load profiles" }, { status: 500 });
    }

    // Fetch chat messages with optional date filter
    let query = sb
      .from('chat_messages')
      .select('id, profile_id, role, message, created_at')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (filterDays) {
      const d = new Date();
      d.setDate(d.getDate() - filterDays);
      query = query.gte('created_at', d.toISOString());
    }

    const { data: messages, error: msgErr } = await query;

    if (msgErr) {
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
    }

    return NextResponse.json({ profiles, messages });
  } catch (err) {
    console.error('[ADMIN_TRANSCRIPTS_ERROR]', err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

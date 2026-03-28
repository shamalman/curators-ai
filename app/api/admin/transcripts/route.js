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

    // Use a separate client to verify the user's JWT (service role client can behave differently for auth)
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const { data: { user }, error: authErr } = await authClient.auth.getUser(authToken);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized", detail: authErr?.message }, { status: 401 });
    }

    const sb = getSupabaseAdmin();

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

    console.log('[ADMIN_TRANSCRIPTS_DEBUG] profiles:', profiles?.length, 'messages:', messages?.length, 'profErr:', profErr, 'msgErr:', msgErr);

    if (msgErr) {
      return NextResponse.json({ error: "Failed to load messages", detail: msgErr.message }, { status: 500 });
    }

    return NextResponse.json({ profiles, messages });
  } catch (err) {
    console.error('[ADMIN_TRANSCRIPTS_ERROR]', err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

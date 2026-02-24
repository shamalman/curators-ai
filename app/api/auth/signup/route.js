import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password are required" }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Use service role key to bypass triggers, RLS, and email confirmation
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return Response.json({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create user with admin API — skips email confirmation
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the email
    });

    if (error) {
      console.error("Admin createUser error:", JSON.stringify(error, null, 2));
      return Response.json({
        error: error.message || "Failed to create account",
        status: error.status,
        code: error.code,
        details: JSON.stringify(error),
      }, { status: error.status || 400 });
    }

    return Response.json({ user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    console.error("Signup route error:", err);
    return Response.json({ error: err.message || "Internal server error", details: String(err) }, { status: 500 });
  }
}

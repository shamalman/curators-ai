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
    const { messageId, interaction } = await request.json();

    if (!messageId || !interaction) {
      return NextResponse.json({ error: "messageId and interaction required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await sb
      .from("chat_messages")
      .select("interactions")
      .eq("id", messageId)
      .single();

    if (fetchErr) {
      console.error("Failed to fetch message for interaction:", fetchErr);
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const updated = [...(existing?.interactions || []), interaction];

    const { error: updateErr } = await sb
      .from("chat_messages")
      .update({ interactions: updated })
      .eq("id", messageId);

    if (updateErr) {
      console.error("Failed to update interactions:", updateErr);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Interaction API error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request) {
  try {
    const { url, curatorId, why, visibility, title, category, tags } = await request.json();

    if (!url || !curatorId) {
      return NextResponse.json({ error: "url and curatorId are required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    // Find unconfirmed chat-parse rec_files row for this URL + curator
    const { data: row, error: lookupError } = await sb
      .from("rec_files")
      .select("id, curation")
      .eq("curator_id", curatorId)
      .filter("source->>url", "eq", url)
      .filter("extraction->>extractor", "eq", "chat-parse@v1")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("[promote-chat-parse] lookup error:", lookupError.message);
      return NextResponse.json({ promoted: false, error: lookupError.message }, { status: 500 });
    }

    if (!row) {
      return NextResponse.json({ promoted: false });
    }

    const existingCuration = row.curation || {};
    if (existingCuration.confirmed === true) {
      return NextResponse.json({ promoted: false });
    }

    // Merge curation with curator-provided fields
    const updatedCuration = {
      ...existingCuration,
      why: why || null,
      title: title || existingCuration.title || null,
      category: category || existingCuration.category || null,
      tags: tags || existingCuration.tags || [],
      confirmed: true,
    };

    const { error: updateError } = await sb
      .from("rec_files")
      .update({
        curation: updatedCuration,
        visibility: { level: visibility || "public" },
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      console.error("[promote-chat-parse] update error:", updateError.message);
      return NextResponse.json({ promoted: false, error: updateError.message }, { status: 500 });
    }

    console.log(`[promote-chat-parse] promoted ${row.id} for curator ${curatorId}`);
    return NextResponse.json({ promoted: true, recFileId: row.id });
  } catch (err) {
    console.error("[promote-chat-parse] unexpected error:", err.message || err);
    return NextResponse.json({ promoted: false, error: err.message || String(err) }, { status: 500 });
  }
}

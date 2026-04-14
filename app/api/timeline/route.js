/*
taste_read_ignores: id, profile_id, inference_text, source_rec_file_id, source_url, created_at
taste_confirmations: id, profile_id, type, observation, source, created_at
taste_reads: id, profile_id, source_url, rec_file_id, extraction, inferences, states, refined_texts, collapsed, dismissed, done, created_at, updated_at
*/

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

async function resolveProfileId(admin, authUserId) {
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .single();
  if (error || !profile) return null;
  return profile.id;
}

function parseConfirmationSource(source) {
  if (typeof source !== "string" || !source.startsWith("taste_read:")) {
    return null;
  }
  const rest = source.slice("taste_read:".length);
  const refinedIdx = rest.indexOf("|refined_from:");
  if (refinedIdx === -1) {
    return { key: rest, original_text: null };
  }
  return {
    key: rest.slice(0, refinedIdx),
    original_text: rest.slice(refinedIdx + "|refined_from:".length) || null,
  };
}

function extractArticleTitle(extraction) {
  if (!extraction) return null;
  if (typeof extraction !== "string") {
    if (extraction && typeof extraction === "object") {
      return extraction.title || extraction.site_name || null;
    }
    return null;
  }
  try {
    const parsed = JSON.parse(extraction);
    if (parsed && typeof parsed === "object") {
      return parsed.title || parsed.site_name || null;
    }
  } catch {
    // Plain-text extraction, not JSON. No title available.
  }
  return null;
}

function parseDomain(url) {
  if (!url || typeof url !== "string") return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function GET(request) {
  try {
    const cookieStore = await cookies();
    const user = await getAuthUser(cookieStore);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor");

    const admin = getSupabaseAdmin();
    const profileId = await resolveProfileId(admin, user.id);
    if (!profileId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // SOURCE 1: taste_confirmations
    let confirmationsQuery = admin
      .from("taste_confirmations")
      .select("id, type, observation, source, created_at")
      .eq("profile_id", profileId)
      .in("type", ["taste_read_confirmed", "correction"])
      .order("created_at", { ascending: false });
    if (cursor) confirmationsQuery = confirmationsQuery.lt("created_at", cursor);
    const { data: confirmations, error: confErr } = await confirmationsQuery;
    if (confErr) {
      console.error("[TIMELINE_ERROR] taste_confirmations query failed:", confErr.message);
      return NextResponse.json({ error: "Confirmations query failed" }, { status: 500 });
    }

    // Parse and collect keys.
    const confParsed = [];
    const urlKeys = new Set();
    const recFileKeys = new Set();
    for (const row of confirmations || []) {
      const parsed = parseConfirmationSource(row.source);
      if (!parsed) continue;
      const isUrl = parsed.key.startsWith("http");
      if (isUrl) urlKeys.add(parsed.key);
      else recFileKeys.add(parsed.key);
      confParsed.push({ row, parsed, isUrl });
    }

    // SOURCE 2: taste_read_ignores
    let ignoresQuery = admin
      .from("taste_read_ignores")
      .select("id, inference_text, source_url, source_rec_file_id, created_at")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    if (cursor) ignoresQuery = ignoresQuery.lt("created_at", cursor);
    const { data: ignores, error: ignErr } = await ignoresQuery;
    if (ignErr) {
      console.error("[TIMELINE_ERROR] taste_read_ignores query failed:", ignErr.message);
      return NextResponse.json({ error: "Ignores query failed" }, { status: 500 });
    }

    for (const ig of ignores || []) {
      if (ig.source_url) urlKeys.add(ig.source_url);
      if (ig.source_rec_file_id) recFileKeys.add(ig.source_rec_file_id);
    }

    // Second step: taste_reads lookup — by source_url and by rec_file_id.
    const tasteReadsByUrl = new Map();
    const tasteReadsByRecFileId = new Map();
    if (urlKeys.size > 0) {
      const { data: rows, error: trErr } = await admin
        .from("taste_reads")
        .select("source_url, rec_file_id, extraction")
        .eq("profile_id", profileId)
        .in("source_url", Array.from(urlKeys));
      if (trErr) {
        console.error("[TIMELINE_ERROR] taste_reads URL lookup failed:", trErr.message);
        return NextResponse.json({ error: "Taste reads lookup failed" }, { status: 500 });
      }
      for (const r of rows || []) {
        if (r.source_url) tasteReadsByUrl.set(r.source_url, r);
      }
    }
    if (recFileKeys.size > 0) {
      const { data: rows, error: trErr } = await admin
        .from("taste_reads")
        .select("source_url, rec_file_id, extraction")
        .eq("profile_id", profileId)
        .in("rec_file_id", Array.from(recFileKeys));
      if (trErr) {
        console.error("[TIMELINE_ERROR] taste_reads rec_file_id lookup failed:", trErr.message);
        return NextResponse.json({ error: "Taste reads lookup failed" }, { status: 500 });
      }
      for (const r of rows || []) {
        if (r.rec_file_id) tasteReadsByRecFileId.set(r.rec_file_id, r);
      }
    }

    // Build confirmation events.
    const confirmationEvents = confParsed.map(({ row, parsed, isUrl }) => {
      const tr = isUrl
        ? tasteReadsByUrl.get(parsed.key)
        : tasteReadsByRecFileId.get(parsed.key);
      const article_url = tr?.source_url || (isUrl ? parsed.key : null);
      return {
        id: row.id,
        type: row.type === "correction" ? "corrected" : "confirmed",
        created_at: row.created_at,
        inference_text: row.observation,
        original_text: parsed.original_text,
        article_title: tr ? extractArticleTitle(tr.extraction) : null,
        article_url,
        article_domain: parseDomain(article_url),
      };
    });

    // Build ignore events.
    const ignoreEvents = (ignores || []).map(ig => {
      const tr = ig.source_url
        ? tasteReadsByUrl.get(ig.source_url)
        : (ig.source_rec_file_id ? tasteReadsByRecFileId.get(ig.source_rec_file_id) : null);
      const article_url = ig.source_url || tr?.source_url || null;
      return {
        id: ig.id,
        type: "ignored",
        created_at: ig.created_at,
        inference_text: ig.inference_text,
        original_text: null,
        article_title: tr ? extractArticleTitle(tr.extraction) : null,
        article_url,
        article_domain: parseDomain(article_url),
      };
    });

    // SOURCE 3: recommendations
    let recsQuery = admin
      .from("recommendations")
      .select("id, title, category, slug, rec_file_id, context, created_at")
      .eq("profile_id", profileId)
      .not("context", "is", null)
      .neq("context", "")
      .order("created_at", { ascending: false });
    if (cursor) recsQuery = recsQuery.lt("created_at", cursor);
    const { data: recs, error: recErr } = await recsQuery;
    if (recErr) {
      console.error("[TIMELINE_ERROR] recommendations query failed:", recErr.message);
      return NextResponse.json({ error: "Recommendations query failed" }, { status: 500 });
    }

    const recFileIds = Array.from(
      new Set((recs || []).map(r => r.rec_file_id).filter(Boolean))
    );
    const recFilesMap = new Map();
    if (recFileIds.length > 0) {
      const { data: rfRows, error: rfErr } = await admin
        .from("rec_files")
        .select("id, curation")
        .in("id", recFileIds);
      if (rfErr) {
        console.error("[TIMELINE_ERROR] rec_files lookup failed:", rfErr.message);
        return NextResponse.json({ error: "Rec files lookup failed" }, { status: 500 });
      }
      for (const rf of rfRows || []) recFilesMap.set(rf.id, rf);
    }

    const recEvents = (recs || []).map(rec => {
      const rf = rec.rec_file_id ? recFilesMap.get(rec.rec_file_id) : null;
      const why = rf?.curation?.why || null;
      return {
        id: rec.id,
        type: "rec_saved",
        created_at: rec.created_at,
        rec_title: rec.title,
        rec_why: why,
        rec_category: rec.category,
        rec_slug: rec.slug,
        rec_is_own: true,
      };
    });

    // Merge, sort, paginate.
    const merged = [...confirmationEvents, ...ignoreEvents, ...recEvents]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

    const PAGE_SIZE = 50;
    const hasMore = merged.length > PAGE_SIZE;
    const events = merged.slice(0, PAGE_SIZE);
    const next_cursor = hasMore ? events[events.length - 1].created_at : null;

    console.log(`[TIMELINE] profileId=${profileId} events=${events.length} total_merged=${merged.length} cursor=${cursor || "-"} next_cursor=${next_cursor || "-"}`);
    return NextResponse.json({ events, next_cursor });
  } catch (err) {
    console.error("[TIMELINE_ERROR]", err?.message || err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectSource, getParser } from "../../../../lib/agent/registry.js";

const PARSE_TIMEOUT_MS = 8000;

// Map parser source name → app category enum
const SOURCE_TO_CATEGORY = {
  spotify: "listen",
  "apple-music": "listen",
  apple_music: "listen",
  soundcloud: "listen",
  youtube: "watch",
  letterboxd: "watch",
  goodreads: "read",
  "google-maps": "visit",
  google_maps: "visit",
  twitter: "read",
  webpage: "read",
};

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function emptyResult(url) {
  return {
    url,
    title: null,
    category: null,
    thumbnail_url: null,
    provider: null,
    parsed_successfully: false,
  };
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    console.error("parse-link: invalid JSON body", err);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, profileId } = body || {};

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Validate http(s) URL
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return NextResponse.json({ error: "url must be http(s)" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const detection = detectSource(url);
  if (!detection.supported) {
    return NextResponse.json(emptyResult(url));
  }

  const parser = getParser(detection.parserName);
  if (!parser || !parser.parse) {
    console.error("parse-link: no parser available", { url, parserName: detection.parserName });
    return NextResponse.json(emptyResult(url));
  }

  const parseStart = Date.now();
  let result = null;
  let parseError = null;

  try {
    result = await Promise.race([
      parser.parse(url),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("parse timeout")), PARSE_TIMEOUT_MS)
      ),
    ]);
  } catch (err) {
    parseError = err.message || String(err);
    console.error("parse-link failed:", parseError, { url, parserName: detection.parserName });
  }

  const parseTimeMs = Date.now() - parseStart;

  // Defensive: validate parser returned the expected metadata.source
  let response;
  let logQuality;
  let logContentLength = 0;
  let logMetadata = null;

  if (!result) {
    response = emptyResult(url);
    logQuality = "failed";
  } else {
    const metadata = result.metadata || {};
    if (!metadata.source || typeof metadata.source !== "string") {
      console.error("parse-link: parser returned no metadata.source", {
        url,
        sourceType: detection.sourceType,
      });
      response = emptyResult(url);
      logQuality = "failed";
    } else {
      const items = result.items || [];
      const contentSample = items
        .map((it) => it.text || it.title || "")
        .join(" ");
      logContentLength = contentSample.length;

      const category = SOURCE_TO_CATEGORY[metadata.source] || null;
      const hasTitle = !!metadata.title;

      response = {
        url,
        title: metadata.title || null,
        category,
        thumbnail_url: metadata.thumbnailUrl || null,
        provider: metadata.providerName || null,
        parsed_successfully: hasTitle,
      };

      logQuality = hasTitle ? (logContentLength > 200 ? "full" : "partial") : "failed";
      logMetadata = { ...metadata, surface: "quick_capture" };
    }
  }

  // Fire-and-await log to link_parse_log (mirrors chat route convention)
  try {
    const sb = getSupabaseAdmin();
    const { error: logErr } = await sb.from("link_parse_log").insert({
      profile_id: profileId || null,
      url,
      source_type: detection.sourceType || "unknown",
      parse_quality: logQuality,
      content_length: logContentLength,
      parse_time_ms: parseTimeMs,
      error_message: parseError,
      ai_response_excerpt: null,
      ai_acknowledged_failure: null,
      metadata: logMetadata || { surface: "quick_capture" },
    });
    if (logErr) {
      console.error("[LINK_PARSE_LOG_ERROR]", logErr.message);
    }
  } catch (err) {
    console.error("[LINK_PARSE_LOG_ERROR]", err.message || err);
  }

  return NextResponse.json(response);
}

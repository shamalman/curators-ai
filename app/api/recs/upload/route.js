// app/api/recs/upload/route.js
//
// Upload capture endpoint. Accepts multipart/form-data with an image file
// + metadata (title, category, why). Stores the image as an artifact and
// synthesizes a parsedPayload envelope for the existing save flow.
//
// extraction.mode: 'uploaded'
// extraction.lossy: handled downstream (no body_md → extraction picks it up).
// curator_is_author: false (curator is capturing, not authoring)
// provenance.source_type: 'firsthand'
// source block: populated via a synthetic artifact:// canonical_url so that
//   buildRecFileRow emits a source block with media_type + artifact fields.
//
// v1 constraints:
// - Images only: image/png, image/jpeg, image/webp, image/heic
// - 5MB hard limit (file size, not encoded)
// - Curator provides title, category, why manually (no vision inference)
// - No PDF support (deferred)

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadArtifact } from "@/lib/rec-files/artifact";
import { CATEGORIES as VALID_CATEGORIES } from "@/lib/constants";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request) {
  const startedAt = Date.now();
  try {
    // Parse multipart form data
    let formData;
    try {
      formData = await request.formData();
    } catch (err) {
      return NextResponse.json(
        { error: "invalid multipart form data" },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const profileId = formData.get("profileId");
    const title = formData.get("title");
    const category = formData.get("category");
    const why = formData.get("why") || "";
    const tagsRaw = formData.get("tags") || "";

    // Validation
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!profileId) {
      return NextResponse.json({ error: "profileId is required" }, { status: 400 });
    }
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // File type and size
    const mimeType = file.type || "";
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `file type ${mimeType} not supported (allowed: PNG, JPEG, WebP, HEIC)` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `file too large (${file.size} bytes, max ${MAX_FILE_BYTES})` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "file is empty" }, { status: 400 });
    }

    // Read file bytes
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Upload to artifacts bucket via service-role
    const sb = getSupabaseAdmin();
    let artifactResult;
    try {
      artifactResult = await uploadArtifact(sb, profileId, bytes, mimeType);
    } catch (err) {
      console.error("[UPLOAD_ARTIFACT_ERROR]", err?.message || err);
      return NextResponse.json(
        { error: "failed to store file", detail: err?.message },
        { status: 500 }
      );
    }

    // Parse tags
    const tags = typeof tagsRaw === "string" && tagsRaw.length > 0
      ? tagsRaw.split(",").map(t => t.trim()).filter(Boolean).slice(0, 10)
      : [];

    // Synthesize body_md: title + why + artifact reference (minimal, lossy).
    const trimmedTitle = title.trim();
    const trimmedWhy = String(why || "").trim();
    const bodyMdParts = [`# ${trimmedTitle}`];
    if (trimmedWhy) {
      bodyMdParts.push("");
      bodyMdParts.push(trimmedWhy);
    }
    bodyMdParts.push("");
    bodyMdParts.push(`![Uploaded image](artifact://${artifactResult.sha256})`);
    const bodyMd = bodyMdParts.join("\n");

    // Synthetic canonical_url using artifact:// so buildRecFileRow emits a
    // source block with media_type + artifact_sha256 + artifact_ref. Slightly
    // hacky but avoids a buildRecFileRow change for this one case.
    const fakeCanonicalUrl = `artifact://${artifactResult.sha256}`;

    const parsedPayload = {
      body_md: bodyMd,
      body_truncated: false,
      body_original_length: bodyMd.length,
      canonical_url: fakeCanonicalUrl,
      site_name: null,
      author: null,
      authors: [],
      published_at: null,
      lang: "en",
      word_count: bodyMd.split(/\s+/).filter(Boolean).length,
      media_type: mimeType,
      artifact_sha256: artifactResult.sha256,
      artifact_ref: artifactResult.ref,
      extraction_mode: "uploaded",
      extractor: `upload@${mimeType.split("/")[1] || "unknown"}`,
      title: trimmedTitle,
      // Overrides for buildRecFileRow (picked up via parsedPayload fallback)
      curator_is_author: false,
      source_type: "firsthand",
    };

    // Log the upload event (reuses link_parse_log schema).
    try {
      const { error: logErr } = await sb.from("link_parse_log").insert({
        profile_id: profileId,
        url: null,
        source_type: "upload",
        parse_quality: "full",
        content_length: file.size,
        parse_time_ms: Date.now() - startedAt,
        error_message: null,
        ai_response_excerpt: null,
        ai_acknowledged_failure: null,
        metadata: {
          surface: "upload_capture",
          title: trimmedTitle,
          file_size: file.size,
          mime_type: mimeType,
          artifact_sha256: artifactResult.sha256,
        },
      });
      if (logErr) console.error("[UPLOAD_LOG_ERROR]", logErr.message);
    } catch (e) {
      console.error("[UPLOAD_LOG_ERROR]", e?.message || e);
    }

    return NextResponse.json({
      parsed_successfully: true,
      title: trimmedTitle,
      category: category,
      tags: tags,
      thumbnail_url: null,
      provider: "upload",
      parsedPayload,
      artifact_sha256: artifactResult.sha256,
      artifact_ref: artifactResult.ref,
    });
  } catch (error) {
    console.error("[UPLOAD_ROUTE_ERROR]", error?.message || error);
    return NextResponse.json(
      { error: "upload capture failed", detail: error?.message },
      { status: 500 }
    );
  }
}

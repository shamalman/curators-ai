// lib/rec-files/build.js
// Build a rec_files insert row from a parsedPayload and curator-provided curation.
import { generateRecId } from './id.js';
import { computeContentHash } from './hash.js';
import { extractImageUrl } from '../agent/parsers/extract-image.js';

/**
 * Build a row ready to insert into rec_files.
 *
 * @param {object} params
 * @param {string} params.curatorId - profile UUID
 * @param {string} params.curatorHandle - profile handle (denormalized for portability)
 * @param {object} params.parsedPayload - the enriched parser output from parse-link (Deploy 2a)
 * @param {object} params.curation - curator-provided fields from the save form
 *   { title, category, context, tags, visibility, ... }
 * @param {boolean} [params.curatorIsAuthor] - optional override, defaults to false.
 *   Paste mode sets this to true (the curator wrote the pasted text themselves).
 * @param {string} [params.sourceType] - optional override for provenance.source_type,
 *   defaults to 'firsthand'.
 * @returns {object} a row ready for supabase.from('rec_files').insert(row)
 */
export function buildRecFileRow({ curatorId, curatorHandle, parsedPayload, curation, curatorIsAuthor, sourceType }) {
  console.log('[BUILD_REC_FILE_ROW]', {
    hasPayload: !!parsedPayload,
    payloadImageUrl: parsedPayload?.image_url,
    extracted: extractImageUrl(parsedPayload),
  });
  const id = generateRecId();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);

  const bodyMd = parsedPayload?.body_md || '';
  const contentHash = computeContentHash(bodyMd);

  // source block — only populated for parsed captures (with a URL)
  const source = parsedPayload?.canonical_url ? {
    url: parsedPayload.canonical_url,
    canonical_url: parsedPayload.canonical_url,
    fetched_at: now,
    media_type: parsedPayload.media_type || 'text/html',
    artifact_sha256: parsedPayload.artifact_sha256 || null,
    artifact_ref: parsedPayload.artifact_ref || null,
  } : null;

  // work block — structured info about the referenced work
  const work = {
    title: curation.title || parsedPayload?.title || 'Untitled',
    category: curation.category || 'other',
    authors: parsedPayload?.authors || [],
    site_name: parsedPayload?.site_name || null,
    lang: parsedPayload?.lang || 'en',
    published_at: parsedPayload?.published_at || null,
    word_count: parsedPayload?.word_count || null,
    image_url: extractImageUrl(parsedPayload) || null,
  };
  // Strip nulls and empty arrays from work
  Object.keys(work).forEach(k => (work[k] == null || (Array.isArray(work[k]) && work[k].length === 0)) && delete work[k]);

  // curation block — what the curator says about the work
  const curationBlock = {
    tags: curation.tags || [],
    why: curation.context || null, // "context" in the UI is "why" in the spec
    notes: [], // verbatim notes layer — populated later in chat flows
    conviction: 'strong', // default; UI doesn't expose this yet
    confirmed: true, // URL captures via Quick Capture are always confirmed
    confirmed_at: now,
  };
  Object.keys(curationBlock).forEach(k => curationBlock[k] == null && delete curationBlock[k]);

  // visibility — maps from the UI's string values to the spec's enum
  const visibility = {
    level: curation.visibility === 'public' ? 'public' : 'taste-file-only',
    pool_eligible: true,
  };

  // provenance — URL captures are firsthand (curator saw the source themselves).
  // Explicit arg wins; otherwise allow callers to stuff an override onto the
  // parsedPayload envelope (used by the paste/upload routes which can't pass
  // named args through the unchanged addRec → ingestUrlCapture chain).
  const provenance = {
    source_type: sourceType ?? parsedPayload?.source_type ?? 'firsthand',
  };

  // extraction block — how the body_md was produced
  const extraction = {
    mode: parsedPayload?.extraction_mode || 'parsed',
    extractor: parsedPayload?.extractor || null,
    extracted_at: now,
    content_sha256: contentHash,
    lossy: false,
    notes: [],
  };
  if (!extraction.extractor) delete extraction.extractor;
  if (parsedPayload?.body_truncated) {
    extraction.lossy = true;
    extraction.notes.push(`body_md truncated from ${parsedPayload.body_original_length} to ${bodyMd.length} chars`);
  }
  if (extraction.notes.length === 0) delete extraction.notes;

  return {
    id,
    version: 1,
    schema_version: 'curators.rec/v1',
    curator_id: curatorId,
    curator_handle: curatorHandle,
    // URL captures are never curator-authored. Paste mode overrides to true.
    // Explicit arg wins; parsedPayload fallback lets the paste/upload routes
    // thread the flag through the unchanged addRec → ingestUrlCapture chain.
    curator_is_author: curatorIsAuthor ?? parsedPayload?.curator_is_author ?? false,
    created_at: now,
    updated_at: now,
    valid_from: today,
    body_md: bodyMd,
    content_sha256: contentHash,
    source,
    work,
    curation: curationBlock,
    visibility,
    provenance,
    extraction,
  };
}

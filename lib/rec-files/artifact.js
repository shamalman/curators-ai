// lib/rec-files/artifact.js
// Upload and reference artifacts in Supabase Storage
import { sha256 } from './hash.js';

/**
 * Upload artifact bytes to the artifacts bucket.
 * Path convention: <curator_id>/<first-2-chars-of-sha256>/<sha256>
 *
 * Deduplicates: if an artifact with the same hash already exists at the same
 * path, the upload is skipped and the existing ref is returned.
 *
 * @param {object} supabase - Supabase client with auth to write to artifacts bucket
 * @param {string} curatorId - UUID of the curator
 * @param {Buffer|Uint8Array|string} bytes - The artifact bytes (string is UTF-8 encoded)
 * @param {string} contentType - MIME type (e.g., 'text/html', 'application/json')
 * @returns {Promise<{ sha256: string, path: string, ref: string }>}
 * @throws {Error} if upload fails (caller should catch and log, not re-throw)
 */
export async function uploadArtifact(supabase, curatorId, bytes, contentType) {
  const byteBuffer = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : bytes;
  const hash = sha256(byteBuffer);
  const prefix = hash.slice(0, 2);
  const path = `${curatorId}/${prefix}/${hash}`;

  // Attempt upload with upsert:false so duplicates are detected
  const { error } = await supabase
    .storage
    .from('artifacts')
    .upload(path, byteBuffer, {
      contentType,
      upsert: false,
    });

  // "already exists" is OK — deduplication at work
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Artifact upload failed: ${error.message}`);
  }

  return {
    sha256: hash,
    path,
    ref: `artifact://${hash}`,
  };
}

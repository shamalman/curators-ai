// lib/rec-files/hash.js
// SHA-256 hashing utilities for .rec content integrity
import { createHash } from 'crypto';

/**
 * Compute SHA-256 hash of a string or Buffer.
 * Returns hex-encoded hash.
 */
export function sha256(input) {
  const hash = createHash('sha256');
  if (typeof input === 'string') {
    hash.update(input, 'utf8');
  } else {
    hash.update(input);
  }
  return hash.digest('hex');
}

/**
 * Compute content hash for a .rec body.
 * Strips leading/trailing whitespace and normalizes line endings to LF.
 * This is the canonical content_sha256 per spec §7.1.
 */
export function computeContentHash(bodyMd) {
  const normalized = (bodyMd || '')
    .replace(/\r\n/g, '\n')   // CRLF → LF
    .replace(/\r/g, '\n')     // CR → LF
    .trim();                   // strip leading/trailing whitespace
  return sha256(normalized);
}

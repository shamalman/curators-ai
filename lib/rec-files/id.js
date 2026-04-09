// lib/rec-files/id.js
// Generate ULID-based rec IDs per spec §7.2
import { ulid } from 'ulidx';

/**
 * Generate a new rec ID in the format `rec_<26 ULID chars>`.
 * ULIDs are monotonic and lexicographically sortable by creation time.
 */
export function generateRecId() {
  return `rec_${ulid()}`;
}

/**
 * Validate a rec ID format.
 */
export function isValidRecId(id) {
  return typeof id === 'string' && /^rec_[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
}

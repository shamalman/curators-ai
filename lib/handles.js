/**
 * Normalize a handle for comparison. Strips leading @ and lowercases.
 * profiles.handle values are canonically stored with a leading @ prefix.
 * All handle equality checks must use this helper to avoid @-prefix bugs.
 */
export function normalizeHandle(handle) {
  if (!handle || typeof handle !== 'string') return '';
  return handle.replace(/^@/, '').toLowerCase();
}

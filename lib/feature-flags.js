// Client-side feature flag helpers.
//
// Gated on handle membership + an optional URL override (`?thumbs=1` / `?thumbs=0`)
// so testers can demo or hide the feature mid-session without redeploying.

const THUMBNAIL_GATED_HANDLES = ['shamal', 'chris'];

function getThumbsOverride() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get('thumbs');
    if (value === '1') return true;
    if (value === '0') return false;
  } catch {
    // Malformed URL or missing URLSearchParams — fall through.
  }
  return null;
}

export function canSeeThumbnails(viewerHandle) {
  const override = getThumbsOverride();
  if (override !== null) return override;
  if (!viewerHandle) return false;
  const clean = String(viewerHandle).replace(/^@/, '').toLowerCase();
  return THUMBNAIL_GATED_HANDLES.includes(clean);
}

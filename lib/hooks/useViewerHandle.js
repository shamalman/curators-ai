'use client';

import { useCurator } from '@/context/CuratorContext';

// Returns the logged-in viewer's handle, normalized (no leading @, lowercased).
// Works in both curator and visitor contexts — each provider exposes
// `viewerHandle` on its context value. Returns null when no viewer is
// authenticated or the handle hasn't loaded yet.
export function useViewerHandle() {
  const ctx = useCurator();
  const raw = ctx?.viewerHandle || null;
  if (!raw) return null;
  return String(raw).replace(/^@/, '').toLowerCase();
}

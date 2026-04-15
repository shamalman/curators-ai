'use client';

import { useState, useEffect } from 'react';

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days — matches ArtifactImage

// Resolve an artifact sha256 to a Supabase signed URL on demand.
// Parallel-shipped alongside components/recs/ArtifactImage.jsx; we do NOT
// migrate that component in this deploy.
//
// @param {string | null | undefined} sha256 - the artifact sha256 (no prefix)
// @param {string | null | undefined} profileId - the rec owner's profile id
// @returns {{ url: string | null, loading: boolean, error: boolean }}
export function useArtifactSignedUrl(sha256, profileId) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(!!sha256 && !!profileId);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sha256 || !profileId) {
      setUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    const artifactPath = `${profileId}/${sha256.slice(0, 2)}/${sha256}`;
    (async () => {
      try {
        const res = await fetch('/api/recs/sign-artifact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId, artifactPath, expiresIn: SIGNED_URL_TTL_SECONDS }),
        });
        if (!res.ok) {
          console.error(`[useArtifactSignedUrl] sign-artifact failed status=${res.status} sha=${sha256}`);
          if (!cancelled) { setError(true); setLoading(false); }
          return;
        }
        const { signedUrl } = await res.json();
        if (!cancelled) {
          setUrl(signedUrl || null);
          setLoading(false);
        }
      } catch (err) {
        console.error(`[useArtifactSignedUrl] error=${err?.message} sha=${sha256}`);
        if (!cancelled) { setError(true); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [sha256, profileId]);

  return { url, loading, error };
}

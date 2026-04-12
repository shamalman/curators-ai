// components/recs/ArtifactImage.jsx
// Resolves artifact://<sha256> URLs to Supabase signed URLs on demand.
// Used as a custom react-markdown img renderer for rec body_md that
// contains uploaded image references.

import { useState, useEffect } from "react";

const ARTIFACT_PREFIX = "artifact://";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export default function ArtifactImage({ src, alt, profileId }) {
  console.log("[ARTIFACT_IMAGE_DEBUG]", { src, alt, profileId, startsWithPrefix: src?.startsWith?.("artifact://") });
  const [resolvedSrc, setResolvedSrc] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src || !src.startsWith(ARTIFACT_PREFIX)) {
      // Not an artifact ref — render as-is
      setResolvedSrc(src);
      return;
    }
    if (!profileId) {
      console.error("[ARTIFACT_IMAGE] missing profileId, cannot resolve", src);
      setError(true);
      return;
    }

    const sha256 = src.slice(ARTIFACT_PREFIX.length);
    // The artifact path convention is <curator_id>/<first-2-chars-of-sha256>/<sha256>
    const artifactPath = `${profileId}/${sha256.slice(0, 2)}/${sha256}`;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recs/sign-artifact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId, artifactPath, expiresIn: SIGNED_URL_TTL_SECONDS }),
        });
        if (!res.ok) {
          console.error(`[ARTIFACT_IMAGE] sign-artifact failed status=${res.status} sha=${sha256}`);
          if (!cancelled) setError(true);
          return;
        }
        const { signedUrl } = await res.json();
        if (!cancelled) setResolvedSrc(signedUrl);
      } catch (err) {
        console.error(`[ARTIFACT_IMAGE] sign-artifact error=${err?.message} sha=${sha256}`);
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [src, profileId]);

  if (error) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: "#888", fontStyle: "italic" }}>
        (Image unavailable)
      </div>
    );
  }

  if (!resolvedSrc) {
    return (
      <div style={{ padding: 12, fontSize: 13, color: "#888", fontStyle: "italic" }}>
        Loading image...
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt || ""}
      style={{ maxWidth: "100%", height: "auto", borderRadius: 8, display: "block", margin: "12px 0" }}
    />
  );
}

'use client';

import { useState } from 'react';
import { T, F } from '@/lib/constants';
import { useArtifactSignedUrl } from '@/lib/hooks/useArtifactSignedUrl';

const ARTIFACT_PREFIX = 'artifact://';

// Palette keyed by normalized source-type token. All dark-mode-friendly,
// muted enough to sit comfortably in a list.
const SOURCE_STYLE = {
  youtube:    { bg: '#8B1A1A', fg: '#FFFFFF', mark: 'Y' },
  spotify:    { bg: '#1A6E3A', fg: '#E8F5EC', mark: 'S' },
  apple_music:{ bg: '#9E2A31', fg: '#FDECEC', mark: 'A' },
  soundcloud: { bg: '#B8540D', fg: '#FFF2E5', mark: 'C' },
  letterboxd: { bg: '#14181C', fg: '#D8E0E8', mark: 'L' },
  goodreads:  { bg: '#553B2D', fg: '#F2E6D9', mark: 'G' },
  twitter:    { bg: '#155A85', fg: '#E6F2FA', mark: 'X' },
  google_maps:{ bg: '#2E5CB8', fg: '#E6EDFA', mark: 'M' },
  upload:     { bg: '#4A3A6E', fg: '#E6DFF5', mark: 'U' },
  webpage:    { bg: T.s, fg: T.ink3, mark: '•' },
  article:    { bg: T.s, fg: T.ink3, mark: '•' },
  paste:      { bg: T.s, fg: T.ink3, mark: '•' },
};

function normalizeSourceType(sourceType) {
  if (!sourceType) return null;
  const s = String(sourceType).toLowerCase().replace(/[-\s]/g, '_');
  // Strip versioned suffix like "@registry" or "@v1"
  const base = s.split('@')[0];
  if (SOURCE_STYLE[base]) return base;
  // Handle common aliases
  if (base === 'apple') return 'apple_music';
  if (base === 'google') return 'google_maps';
  if (base.startsWith('upload')) return 'upload';
  if (base === 'chat_parse' || base === 'webpage' || base === 'defuddle') return 'webpage';
  return null;
}

function Placeholder({ sourceType, size, altText }) {
  const style = SOURCE_STYLE[normalizeSourceType(sourceType)] || SOURCE_STYLE.article;
  const fontSize = size >= 56 ? 22 : 16;
  return (
    <div
      aria-label={altText || 'thumbnail placeholder'}
      style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        background: style.bg, color: style.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontFamily: F, fontWeight: 700, letterSpacing: '0.02em',
        border: `1px solid ${T.bdr}`,
      }}
    >
      {style.mark}
    </div>
  );
}

export default function RecThumbnail({ imageUrl, sourceType, size = 'sm', altText, profileId }) {
  const px = size === 'md' ? 64 : 48;
  const [imgFailed, setImgFailed] = useState(false);

  const isArtifact = typeof imageUrl === 'string' && imageUrl.startsWith(ARTIFACT_PREFIX);
  const sha = isArtifact ? imageUrl.slice(ARTIFACT_PREFIX.length) : null;
  const { url: signedUrl, error: signedError } = useArtifactSignedUrl(
    isArtifact ? sha : null,
    isArtifact ? profileId : null,
  );

  // Resolve the URL to actually render. Artifacts wait for the signed URL;
  // plain http(s) URLs render immediately.
  let renderUrl = null;
  if (isArtifact) {
    if (signedUrl && !signedError) renderUrl = signedUrl;
  } else if (typeof imageUrl === 'string' && imageUrl.length > 0) {
    renderUrl = imageUrl;
  }

  const showPlaceholder = !renderUrl || imgFailed || signedError;

  if (showPlaceholder) {
    return <Placeholder sourceType={sourceType} size={px} altText={altText} />;
  }

  return (
    <img
      src={renderUrl}
      alt={altText || ''}
      onError={() => setImgFailed(true)}
      style={{
        width: px, height: px, borderRadius: 8, flexShrink: 0,
        objectFit: 'cover', display: 'block',
        border: `1px solid ${T.bdr}`, background: T.s,
      }}
    />
  );
}

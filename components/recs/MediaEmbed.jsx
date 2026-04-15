'use client';

import { useState } from 'react';
import { deriveEmbedUrl } from '@/lib/recs/embed-url';
import { MEDIA_EMBEDS_ENABLED } from '@/lib/feature-flags';

export default function MediaEmbed({ extractor, sourceUrl, mediaId }) {
  const [failed, setFailed] = useState(false);

  if (!MEDIA_EMBEDS_ENABLED) return null;
  if (failed) return null;

  const embed = deriveEmbedUrl({ extractor, sourceUrl, mediaId });
  if (!embed) return null;

  const isVideo = embed.type === 'video';
  const isSoundCloud = embed.src.includes('w.soundcloud.com');
  const isAppleMusic = embed.src.includes('embed.music.apple.com');

  let height = 152;
  if (embed.type === 'audio_album' || embed.type === 'audio_playlist') {
    height = isAppleMusic ? 450 : 352;
  } else if (isAppleMusic) {
    height = 175;
  } else if (isSoundCloud) {
    height = 166;
  } else if (embed.type === 'audio_episode') {
    height = 232;
  }

  const wrapperStyle = {
    marginTop: 24,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  };

  if (isVideo) {
    return (
      <div style={wrapperStyle}>
        <div style={{ position: 'relative', paddingTop: '56.25%' }}>
          <iframe
            src={embed.src}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 0,
              borderRadius: 12,
            }}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            onError={() => setFailed(true)}
            title="Embedded media"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={wrapperStyle}>
      <iframe
        src={embed.src}
        style={{
          width: '100%',
          height,
          border: 0,
          borderRadius: 12,
        }}
        allow="autoplay *; encrypted-media *; clipboard-write"
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        onError={() => setFailed(true)}
        title="Embedded media"
      />
    </div>
  );
}

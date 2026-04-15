// Derive an iframe embed URL from a rec's extractor + source URL.
// Pure string parsing. Returns { type, src } or null. Null = render nothing.

function normalizeSource(extractor) {
  if (!extractor || typeof extractor !== 'string') return null;
  const beforeAt = extractor.split('@')[0];
  return beforeAt.toLowerCase().replace(/-/g, '_');
}

function youtubeEmbed(sourceUrl, mediaId) {
  let id = mediaId || null;
  if (!id && typeof sourceUrl === 'string') {
    const m =
      sourceUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
      sourceUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
      sourceUrl.match(/youtube\.com\/(?:embed|shorts|live)\/([a-zA-Z0-9_-]{11})/);
    id = m ? m[1] : null;
  }
  if (!id) return null;
  return { type: 'video', src: `https://www.youtube.com/embed/${id}` };
}

function spotifyEmbed(sourceUrl) {
  if (typeof sourceUrl !== 'string') return null;
  const m = sourceUrl.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/i);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const id = m[2];
  const typeMap = {
    track: 'audio_track',
    album: 'audio_album',
    playlist: 'audio_playlist',
    episode: 'audio_episode',
  };
  return { type: typeMap[kind], src: `https://open.spotify.com/embed/${kind}/${id}` };
}

function appleMusicEmbed(sourceUrl) {
  if (typeof sourceUrl !== 'string') return null;
  // music.apple.com/{country}/{album|song|playlist}/{slug}/{id}[?i=trackId]
  const m = sourceUrl.match(/https?:\/\/music\.apple\.com\/([^/]+)\/(album|song|playlist)\/([^/?#]+)\/([^/?#]+)(\?[^#]*)?/i);
  if (!m) return null;
  const kind = m[2].toLowerCase();
  const type = kind === 'song' ? 'audio_track' : kind === 'album' ? 'audio_album' : 'audio_playlist';
  const src = sourceUrl
    .replace(/^https?:\/\/music\.apple\.com/i, 'https://embed.music.apple.com')
    .split('#')[0];
  return { type, src };
}

function soundcloudEmbed(sourceUrl) {
  if (typeof sourceUrl !== 'string') return null;
  if (!/^https?:\/\/(www\.|m\.)?soundcloud\.com\//i.test(sourceUrl)) return null;
  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(sourceUrl)}&color=%23ff5500&inverse=false&auto_play=false&show_user=true`;
  return { type: 'audio_track', src };
}

export function deriveEmbedUrl({ extractor, sourceUrl, mediaId } = {}) {
  const source = normalizeSource(extractor);
  if (!source) return null;
  switch (source) {
    case 'youtube': return youtubeEmbed(sourceUrl, mediaId);
    case 'spotify': return spotifyEmbed(sourceUrl);
    case 'apple_music': return appleMusicEmbed(sourceUrl);
    case 'soundcloud': return soundcloudEmbed(sourceUrl);
    default: return null;
  }
}

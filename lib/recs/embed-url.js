// Derive an iframe embed URL from a rec's extractor + source URL.
// Pure string parsing. Returns { type, src } or null. Null = render nothing.
//
// Strategy: URL-first. If the URL matches a known host, render it regardless
// of what `extractor` says. This is critical for backfilled recs whose
// extractor is "webpage@backfill" rather than "youtube@..." etc.
// Extractor is used only as a tiebreaker / hint.

function normalizeSource(extractor) {
  if (!extractor || typeof extractor !== 'string') return null;
  const beforeAt = extractor.split('@')[0];
  return beforeAt.toLowerCase().replace(/-/g, '_');
}

function detectHostFromUrl(sourceUrl) {
  if (typeof sourceUrl !== 'string') return null;
  const url = sourceUrl.toLowerCase();
  if (/(?:^|\/\/)(?:www\.|m\.)?youtube\.com\//.test(url) || /(?:^|\/\/)youtu\.be\//.test(url)) return 'youtube';
  if (/open\.spotify\.com\//.test(url)) return 'spotify';
  if (/music\.apple\.com\//.test(url)) return 'apple_music';
  if (/(?:^|\/\/)(?:www\.|m\.)?soundcloud\.com\//.test(url)) return 'soundcloud';
  if (/(?:^|\/\/)(?:www\.)?mixcloud\.com\//.test(url)) return 'mixcloud';
  if (/(?:^|\/\/)(?:www\.|listen\.)?tidal\.com\//.test(url)) return 'tidal';
  return null;
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

function mixcloudEmbed(sourceUrl) {
  if (typeof sourceUrl !== 'string') return null;
  let pathname;
  try {
    pathname = new URL(sourceUrl).pathname;
  } catch {
    return null;
  }
  if (!pathname || pathname === '/') return null;
  if (!pathname.endsWith('/')) pathname += '/';
  const encodedPath = encodeURIComponent(pathname);
  return {
    type: 'audio_episode',
    src: `https://www.mixcloud.com/widget/iframe/?hide_cover=1&light=1&feed=${encodedPath}`,
  };
}

function tidalEmbed(sourceUrl) {
  if (typeof sourceUrl !== 'string') return null;
  let pathname;
  try {
    pathname = new URL(sourceUrl).pathname;
  } catch {
    return null;
  }
  pathname = pathname.replace(/^\/browse\//, '/');
  const m = pathname.match(/^\/(album|track|playlist|video)\/([^/?#]+)/);
  if (!m) return null;
  const kind = m[1];
  const id = m[2];
  if (kind === 'video') return null;
  const typeMap = {
    album: 'audio_album',
    track: 'audio_track',
    playlist: 'audio_playlist',
  };
  return {
    type: typeMap[kind],
    src: `https://embed.tidal.com/${kind}s/${id}`,
  };
}

export function deriveEmbedUrl({ extractor, sourceUrl, mediaId } = {}) {
  // URL-first: if the URL itself identifies a known host, use that.
  // This handles backfilled recs where extractor is "webpage@backfill".
  const urlHost = detectHostFromUrl(sourceUrl);
  const extractorHost = normalizeSource(extractor);
  const source = urlHost || extractorHost;
  if (!source) return null;

  switch (source) {
    case 'youtube': return youtubeEmbed(sourceUrl, mediaId);
    case 'spotify': return spotifyEmbed(sourceUrl);
    case 'apple_music': return appleMusicEmbed(sourceUrl);
    case 'soundcloud': return soundcloudEmbed(sourceUrl);
    case 'mixcloud': return mixcloudEmbed(sourceUrl);
    case 'tidal': return tidalEmbed(sourceUrl);
    default: return null;
  }
}

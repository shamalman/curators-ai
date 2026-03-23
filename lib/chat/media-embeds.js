// ── Content Blocks helpers ──
export function classifyMediaType(url, metadata) {
  if (url.includes('spotify.com')) return 'audio';
  if (url.includes('music.apple.com')) return 'audio';
  if (url.includes('soundcloud.com')) return 'audio';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'video';
  if (url.includes('maps.google.com') || url.includes('maps.app.goo.gl')) return 'place';
  if (url.includes('letterboxd.com')) {
    return url.includes('/film/') ? 'article' : 'profile';
  }
  if (url.includes('goodreads.com')) return 'book';
  return 'article';
}

export function hasEmbeddablePlayer(provider) {
  return ['Spotify', 'YouTube', 'SoundCloud', 'Apple Music'].includes(provider);
}

export async function fetchLinkMetadataForBlocks(url) {
  let metadata = { title: null, source: null, author: null, thumbnail_url: null, embed_html: null };
  try {
    if (url.includes('spotify.com')) {
      metadata.source = 'Spotify';
      const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if (res.ok) { const d = await res.json(); metadata.title = d.title; metadata.author = d.author_name || null; metadata.thumbnail_url = d.thumbnail_url || null; metadata.embed_html = d.html || null; }
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      metadata.source = 'YouTube';
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) { const d = await res.json(); metadata.title = d.title; metadata.author = d.author_name || null; metadata.thumbnail_url = d.thumbnail_url || null; metadata.embed_html = d.html || null; }
    } else if (url.includes('soundcloud.com')) {
      metadata.source = 'SoundCloud';
      const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) { const d = await res.json(); metadata.title = d.title; metadata.author = d.author_name || null; metadata.thumbnail_url = d.thumbnail_url || null; metadata.embed_html = d.html || null; }
    } else if (url.includes('music.apple.com')) {
      metadata.source = 'Apple Music';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuratorsBot/1.0)' } });
      if (res.ok) { const html = await res.text(); const t = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (t) metadata.title = t[1].trim(); }
    } else {
      metadata.source = 'Website';
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CuratorsBot/1.0)' } });
      if (res.ok) { const html = await res.text(); const t = html.match(/<title[^>]*>([^<]+)<\/title>/i); if (t) metadata.title = t[1].trim(); }
    }
  } catch (err) {
    console.error('fetchLinkMetadataForBlocks error:', url, err);
  }
  return metadata;
}

// Build MediaEmbed blocks from detected URLs, reusing parsed metadata when available
export async function buildMediaEmbedBlocks(urls, parsedLinkBlocks) {
  // Index parsed content by URL for reuse
  const parsedByUrl = {};
  if (parsedLinkBlocks) {
    for (const block of parsedLinkBlocks) {
      parsedByUrl[block.url] = block;
    }
  }

  return Promise.all(
    urls.map(async (url) => {
      try {
        // Reuse metadata from link-parsing if available, otherwise fetch fresh
        let metadata;
        const parsed = parsedByUrl[url];
        if (parsed && parsed.metadata) {
          const m = parsed.metadata;
          metadata = {
            title: m.title || null,
            source: m.providerName || m.source || null,
            author: m.author || null,
            thumbnail_url: m.thumbnail_url || null,
            embed_html: m.embed_html || null,
          };
          // For embeddable providers, we still need oEmbed data if not already present
          if (!metadata.embed_html && hasEmbeddablePlayer(metadata.source)) {
            const fresh = await fetchLinkMetadataForBlocks(url);
            metadata.embed_html = fresh.embed_html;
            metadata.thumbnail_url = metadata.thumbnail_url || fresh.thumbnail_url;
          }
        } else {
          metadata = await fetchLinkMetadataForBlocks(url);
        }

        const provider = metadata.source || "generic";
        return {
          type: "media_embed",
          data: {
            url,
            provider,
            title: metadata.title || url,
            author: metadata.author || null,
            description: null,
            thumbnail_url: metadata.thumbnail_url || null,
            media_type: classifyMediaType(url, metadata),
            has_embed: hasEmbeddablePlayer(provider),
            embed_html: metadata.embed_html || null,
            rating: null,
          }
        };
      } catch (e) {
        console.error('MediaEmbed fetch error:', url, e);
        return {
          type: "media_embed",
          data: {
            url, provider: "generic", title: url, author: null,
            description: null, thumbnail_url: null, media_type: "article",
            has_embed: false, embed_html: null, rating: null,
          }
        };
      }
    })
  );
}

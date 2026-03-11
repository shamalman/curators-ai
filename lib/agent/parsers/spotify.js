// ── Spotify Source Parser ──
// Handles open.spotify.com URLs — playlists, profiles, tracks, albums
// Uses oEmbed for metadata + HTML scraping for track listings

export const name = "spotify";
export const sourceType = "spotify";

export const patterns = [
  /^https?:\/\/(open\.)?spotify\.com\/(playlist|user|track|album|artist)\//i,
];

export function classifyUrl(url) {
  if (/spotify\.com\/playlist\//i.test(url)) return "profile";
  if (/spotify\.com\/user\//i.test(url)) return "profile";
  if (/spotify\.com\/artist\//i.test(url)) return "profile";
  if (/spotify\.com\/track\//i.test(url)) return "single_item";
  if (/spotify\.com\/album\//i.test(url)) return "single_item";
  return "profile";
}

// Extract Spotify resource ID from URL
function extractId(url) {
  const match = url.match(/spotify\.com\/(playlist|user|track|album|artist)\/([a-zA-Z0-9]+)/);
  return match ? { type: match[1], id: match[2] } : null;
}

// Fetch oEmbed metadata (public, no API key needed)
async function fetchOEmbed(url) {
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CuratorsBot/1.0)" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Spotify oEmbed fetch error:", err);
    return null;
  }
}

// Fetch the public Spotify page HTML and extract track data
async function fetchPageData(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error("Spotify page fetch error:", err);
    return null;
  }
}

// Parse items from Spotify HTML — tracks AND podcast episodes
// Spotify embeds structured data in meta tags and JSON-LD
function extractItemsFromHtml(html) {
  const items = [];

  // Try JSON-LD / structured data in script tags
  const scriptMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scriptMatches) {
    try {
      const data = JSON.parse(match[1]);

      // Music playlist with tracks
      if (data["@type"] === "MusicPlaylist" && data.track) {
        const trackList = Array.isArray(data.track) ? data.track : [data.track];
        for (const t of trackList) {
          if (t.name) {
            items.push({
              title: t.name,
              artist: t.byArtist?.name || t.creator?.name || null,
              url: t.url || null,
              itemType: "track",
              duration: t.duration || null,
            });
          }
        }
      }

      // Music album
      if (data["@type"] === "MusicAlbum" && data.track) {
        const trackList = Array.isArray(data.track) ? data.track : [data.track];
        for (const t of trackList) {
          if (t.name) {
            items.push({
              title: t.name,
              artist: data.byArtist?.name || null,
              url: t.url || null,
              itemType: "track",
              duration: t.duration || null,
            });
          }
        }
      }

      // Podcast episode (single page)
      if (data["@type"] === "PodcastEpisode") {
        items.push({
          title: data.name,
          artist: null,
          showName: data.partOfSeries?.name || null,
          url: data.url || null,
          itemType: "episode",
          duration: data.timeRequired || data.duration || null,
          description: data.description || null,
        });
      }

      // Podcast series
      if (data["@type"] === "PodcastSeries" && data.episode) {
        const episodes = Array.isArray(data.episode) ? data.episode : [data.episode];
        for (const ep of episodes) {
          if (ep.name) {
            items.push({
              title: ep.name,
              artist: null,
              showName: data.name || null,
              url: ep.url || null,
              itemType: "episode",
              duration: ep.timeRequired || ep.duration || null,
              description: ep.description || null,
            });
          }
        }
      }
    } catch (err) {
      // JSON parse failed, skip this script tag
    }
  }

  // Fallback: try Spotify's internal data from __NEXT_DATA__ or resource script
  if (items.length === 0) {
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const entities = nextData?.props?.pageProps?.state?.data?.entity;
        if (entities) {
          const trackItems = entities.trackList || entities.tracks?.items || [];
          for (const t of trackItems) {
            const inner = t.track || t;
            if (inner.name) {
              // Spotify internal data uses type field: "track" vs "episode"
              const isEpisode = inner.type === "episode" || inner.is_podcast || !!inner.show;
              items.push({
                title: inner.name,
                artist: isEpisode ? null : (inner.artists?.[0]?.name || null),
                showName: isEpisode ? (inner.show?.name || null) : null,
                url: inner.uri || null,
                itemType: isEpisode ? "episode" : "track",
                duration: inner.duration_ms ? Math.round(inner.duration_ms / 1000) : null,
                description: inner.description || null,
              });
            }
          }
        }
      } catch (err) {
        // __NEXT_DATA__ parse failed
      }
    }
  }

  // Fallback: extract from meta tags
  if (items.length === 0) {
    const metaMusic = html.matchAll(/<meta[^>]*property="music:song"[^>]*content="([^"]+)"[^>]*>/gi);
    for (const m of metaMusic) {
      items.push({ title: null, artist: null, url: m[1], itemType: "track" });
    }
  }

  // Fallback: extract track names from title attributes or aria-labels
  if (items.length === 0) {
    const titleMatches = html.matchAll(/data-testid="tracklist-row"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi);
    for (const m of titleMatches) {
      items.push({ title: m[1].trim(), artist: m[2].trim(), url: null, itemType: "track" });
    }
  }

  return items;
}

// Extract meta tag content
function extractMeta(html, property) {
  const match = html.match(new RegExp(`<meta[^>]*(?:property|name)="${property}"[^>]*content="([^"]*)"`, "i"));
  return match ? match[1] : null;
}

export async function parse(url) {
  const resource = extractId(url);
  if (!resource) {
    throw new Error(`Could not parse Spotify URL: ${url}`);
  }

  // Clean URL (strip query params and tracking)
  const cleanUrl = `https://open.spotify.com/${resource.type}/${resource.id}`;

  // Fetch oEmbed and page HTML in parallel
  const [oembed, html] = await Promise.all([
    fetchOEmbed(cleanUrl),
    fetchPageData(cleanUrl),
  ]);

  const metadata = {
    source: "spotify",
    sourceType: "spotify",
    resourceType: resource.type,
    url: cleanUrl,
    title: oembed?.title || null,
    description: null,
    thumbnailUrl: oembed?.thumbnail_url || null,
    providerName: oembed?.provider_name || "Spotify",
  };

  let items = [];

  if (html) {
    // Extract description from meta tags
    metadata.description = extractMeta(html, "og:description") || extractMeta(html, "description");

    if (resource.type === "playlist") {
      const extracted = extractItemsFromHtml(html);
      items = extracted.map((t, i) => ({
        position: i + 1,
        title: t.title,
        artist: t.artist,
        showName: t.showName || null,
        url: t.url,
        itemType: t.itemType || "track",
        duration: t.duration || null,
        description: t.description || null,
      }));
    }

    if (resource.type === "album") {
      const extracted = extractItemsFromHtml(html);
      const albumArtist = extractMeta(html, "music:musician") || oembed?.title?.split(" - ")?.[1];
      items = extracted.map((t, i) => ({
        position: i + 1,
        title: t.title,
        artist: t.artist || albumArtist || null,
        url: t.url,
        itemType: "track",
        duration: t.duration || null,
      }));
    }

    if (resource.type === "user" || resource.type === "artist") {
      metadata.title = metadata.title || extractMeta(html, "og:title");
      const playlistLinks = html.matchAll(/href="\/playlist\/([a-zA-Z0-9]+)"/gi);
      for (const m of playlistLinks) {
        items.push({
          itemType: "playlist",
          url: `https://open.spotify.com/playlist/${m[1]}`,
          title: null,
        });
      }
    }

    if (resource.type === "track") {
      metadata.title = metadata.title || extractMeta(html, "og:title");
      const artist = extractMeta(html, "music:musician:name") || extractMeta(html, "twitter:audio:artist_name");
      items = [{
        position: 1,
        title: metadata.title,
        artist: artist || oembed?.title?.split(" by ")?.[1] || null,
        url: cleanUrl,
        itemType: "track",
      }];
    }
  }

  // If HTML scraping got nothing but we have oEmbed, create a minimal result
  if (items.length === 0 && oembed) {
    if (resource.type === "track") {
      const parts = oembed.title?.split(" - ") || [];
      items = [{
        position: 1,
        title: parts[0]?.trim() || oembed.title,
        artist: parts[1]?.trim() || null,
        url: cleanUrl,
        itemType: "track",
      }];
    } else if (resource.type === "album") {
      const parts = oembed.title?.split(" - ") || [];
      items = [{
        title: parts[0]?.trim() || oembed.title,
        artist: parts[1]?.trim() || null,
        url: cleanUrl,
        itemType: "album",
      }];
    }
  }

  return { metadata, items };
}

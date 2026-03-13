// ── Apple Music Source Parser ──
// Handles music.apple.com URLs — playlists, albums, songs, artists
//
// Reliability strategy (discovered via diagnostics 2026-03):
// - Main page serves identical 444KB fully server-rendered HTML regardless of UA
// - JSON-LD (@type: MusicPlaylist/MusicAlbum) has track names + durations but NO artist names
// - serialized-server-data script tag has the richest data: title, artistName,
//   duration (ms), contentDescriptor.kind, and direct song URLs
// - oEmbed at /api/oembed?url= (NOT /oembed) — discovered via <link rel="alternate">
// - Embed page is useless (2KB empty shell)
//
// Order: oEmbed (metadata) + main page (serialized-server-data → JSON-LD → meta tags)

export const name = "apple-music";
export const sourceType = "apple_music";

export const patterns = [
  /^https?:\/\/music\.apple\.com\//i,
];

export function classifyUrl(url) {
  if (/\/playlist\//i.test(url)) return "profile";
  if (/\/artist\//i.test(url)) return "profile";
  // Album URL with ?i= track param → single item
  if (/\/album\/.*[?&]i=/i.test(url)) return "single_item";
  if (/\/album\//i.test(url)) return "profile";
  if (/\/song\//i.test(url)) return "single_item";
  return "profile";
}

// Extract resource info from URL
// Formats: music.apple.com/{country}/playlist/{name}/{id}
//          music.apple.com/{country}/album/{name}/{id}?i={trackId}
//          music.apple.com/{country}/artist/{name}/{id}
function extractResource(url) {
  const match = url.match(/music\.apple\.com\/([a-z]{2})\/(playlist|album|artist|song)\/([^/?]+)\/([^/?]+)/i);
  if (!match) return null;

  const parsed = new URL(url);
  const trackId = parsed.searchParams.get("i");

  return {
    country: match[1],
    type: match[2],
    slug: match[3],
    id: match[4],
    trackId: trackId || null,
  };
}

// ── Fetch helpers ──

async function fetchOEmbed(url) {
  try {
    const res = await fetch(`https://music.apple.com/api/oembed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Apple Music oEmbed fetch error:", err);
    return null;
  }
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error("Apple Music page fetch error:", err);
    return null;
  }
}

function extractMeta(html, property) {
  const match = html.match(new RegExp(`<meta[^>]*(?:property|name)="${property}"[^>]*content="([^"]*)"`, "i"));
  return match ? match[1] : null;
}

// Parse ISO 8601 duration (PT3M4S) to seconds
function parseDuration(iso) {
  if (!iso) return null;
  if (typeof iso === "number") return Math.round(iso / 1000);
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
}

// ── Track extraction strategies ──

// Strategy A (primary): serialized-server-data script tag
// Richest data — has title, artistName, duration (ms), kind, URLs
function extractFromSerializedData(html) {
  const match = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const sections = data?.data?.[0]?.data?.sections;
    if (!sections || !Array.isArray(sections)) return null;

    // Find the section with track items — it's the one with itemKind and multiple items
    // Usually sections[1] for playlists/albums, but search to be safe
    let trackSection = null;
    for (const sec of sections) {
      if (sec.items && sec.items.length > 1 && sec.items[0]?.title) {
        trackSection = sec;
        break;
      }
    }

    if (!trackSection || trackSection.items.length === 0) return null;

    const items = trackSection.items
      .filter(t => t.title)
      .map(t => ({
        title: t.title,
        artist: t.artistName || null,
        url: t.contentDescriptor?.url || null,
        itemType: t.contentDescriptor?.kind === "song" ? "track" : "track",
        duration: t.duration ? Math.round(t.duration / 1000) : null,
        showName: null,
        description: null,
      }));

    return items.length > 0 ? items : null;
  } catch (err) {
    console.error("Apple Music: serialized-server-data parse error:", err);
    return null;
  }
}

// Strategy B (fallback): JSON-LD MusicPlaylist/MusicAlbum
// Has track names and durations but NO artist names
function extractFromJsonLd(html) {
  const items = [];
  const scriptMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scriptMatches) {
    try {
      const data = JSON.parse(match[1]);

      if ((data["@type"] === "MusicPlaylist" || data["@type"] === "MusicAlbum") && data.track) {
        const trackList = Array.isArray(data.track) ? data.track : [data.track];
        const albumArtist = data.byArtist?.name || null;

        for (const t of trackList) {
          if (t.name) {
            items.push({
              title: t.name,
              artist: t.byArtist?.name || albumArtist || null,
              url: t.url || null,
              itemType: "track",
              duration: parseDuration(t.duration),
              showName: null,
              description: null,
            });
          }
        }
      }
    } catch (err) {
      // JSON parse failed, skip
    }
  }

  return items.length > 0 ? items : null;
}

// Strategy C (last resort): music:song meta tags — just URLs, no names
function extractFromMetaTags(html) {
  const songUrls = [...html.matchAll(/<meta[^>]*property="music:song"[^>]*content="([^"]+)"[^>]*>/gi)];
  if (songUrls.length === 0) return null;

  return songUrls.map(m => ({
    title: null,
    artist: null,
    url: m[1],
    itemType: "track",
    duration: null,
    showName: null,
    description: null,
  }));
}

// ── Main parse function ──

export async function parse(url) {
  const resource = extractResource(url);
  if (!resource) {
    throw new Error(`Could not parse Apple Music URL: ${url}`);
  }

  const cleanUrl = `https://music.apple.com/${resource.country}/${resource.type}/${resource.slug}/${resource.id}${resource.trackId ? `?i=${resource.trackId}` : ""}`;

  // Fetch oEmbed + main page in parallel
  const [oembed, html] = await Promise.all([
    fetchOEmbed(cleanUrl),
    fetchHtml(cleanUrl),
  ]);

  const metadata = {
    source: "apple_music",
    sourceType: "apple_music",
    resourceType: resource.type,
    url: cleanUrl,
    title: oembed?.title || null,
    description: null,
    thumbnailUrl: oembed?.thumbnail_url || null,
    providerName: oembed?.provider_name || "Apple Music",
  };

  let items = [];

  if (html) {
    // Extract metadata from OG tags
    if (!metadata.title) metadata.title = extractMeta(html, "og:title")?.replace(/ on Apple Music$/, "");
    metadata.description = extractMeta(html, "og:description") || extractMeta(html, "description");
    if (!metadata.thumbnailUrl) metadata.thumbnailUrl = extractMeta(html, "og:image");
  }

  // ── Playlists and Albums ──
  if (resource.type === "playlist" || (resource.type === "album" && !resource.trackId)) {
    if (html) {
      // Try strategies in order: serialized-server-data → JSON-LD → meta tags
      items = extractFromSerializedData(html)
        || extractFromJsonLd(html)
        || extractFromMetaTags(html)
        || [];
    }

  // ── Single song (album URL with ?i= parameter, or /song/ URL) ──
  } else if (resource.type === "song" || (resource.type === "album" && resource.trackId)) {
    if (html) {
      // For single songs, try to extract from serialized data or JSON-LD
      const allTracks = extractFromSerializedData(html) || extractFromJsonLd(html);
      if (allTracks && allTracks.length > 0) {
        if (resource.trackId) {
          // Find the specific track by matching the trackId in the URL
          const match = allTracks.find(t => t.url && t.url.includes(resource.trackId));
          items = match ? [match] : [allTracks[0]];
        } else {
          items = [allTracks[0]];
        }
      }
    }
    // Fallback to oEmbed title
    if (items.length === 0 && oembed?.title) {
      items = [{
        title: oembed.title,
        artist: null,
        url: cleanUrl,
        itemType: "track",
        duration: null,
        showName: null,
        description: null,
      }];
    }

  // ── Artists ──
  } else if (resource.type === "artist") {
    if (html) {
      metadata.title = metadata.title || extractMeta(html, "og:title")?.replace(/ on Apple Music$/, "");
      // Look for album/playlist links in the artist page
      const albumLinks = [...html.matchAll(/href="(\/[a-z]{2}\/album\/[^"]+)"/gi)];
      for (const m of albumLinks) {
        items.push({
          itemType: "album",
          url: `https://music.apple.com${m[1]}`,
          title: null,
          artist: null,
          duration: null,
          showName: null,
          description: null,
        });
      }
    }
  }

  // Normalize items with position
  items = items.map((t, i) => ({
    position: i + 1,
    title: t.title,
    artist: t.artist || null,
    showName: t.showName || null,
    url: t.url || null,
    itemType: t.itemType || "track",
    duration: t.duration || null,
    description: t.description || null,
  }));

  return { metadata, items };
}

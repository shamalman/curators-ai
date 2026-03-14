// ── SoundCloud Source Parser ──
// Handles soundcloud.com URLs — profiles, tracks, playlists/sets, likes
//
// Reliability strategy (discovered via diagnostics 2026-03):
// - Primary data source: window.__sc_hydration array of {hydratable, data} objects
// - Single tracks: hydratable "sound" — title, duration, playback_count, genre, artwork_url, user
// - Playlists/sets: hydratable "playlist" — full track data for ~5 tracks, stubs (ID only) for rest
// - Profiles: return 403 server-side — fall back to oEmbed for metadata
// - oEmbed works for all URL types: title, author_name, thumbnail_url, description
// - User object in hydration: username, followers_count, track_count, city, description
//
// Strategy: oEmbed (metadata) + __sc_hydration (track data) → graceful degradation

export const name = "soundcloud";
export const sourceType = "soundcloud";

export const patterns = [
  /^https?:\/\/(www\.|m\.)?soundcloud\.com\//i,
];

export function classifyUrl(url) {
  // Playlist/set
  if (/soundcloud\.com\/[^/]+\/sets\//i.test(url)) return "profile";
  // Likes
  if (/soundcloud\.com\/[^/]+\/likes/i.test(url)) return "profile";
  // Reposts
  if (/soundcloud\.com\/[^/]+\/reposts/i.test(url)) return "profile";
  // Single track: /username/track-name (not /sets/, /likes, /reposts, /tracks, /albums, /popular-tracks)
  if (/soundcloud\.com\/[^/]+\/[^/]+\/?$/i.test(url) &&
      !/\/(sets|likes|reposts|tracks|albums|popular-tracks|followers|following)\/?$/i.test(url)) {
    return "single_item";
  }
  // Profile pages
  return "profile";
}

// ── Fetch helpers ──

const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": CHROME_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error("SoundCloud fetch error:", url, err);
    return null;
  }
}

async function fetchOEmbed(url) {
  try {
    const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("SoundCloud oEmbed error:", err);
    return null;
  }
}

// ── Hydration data extraction ──

function extractHydration(html) {
  const match = html.match(/window\.__sc_hydration\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (err) {
    console.error("SoundCloud hydration parse error:", err);
    return null;
  }
}

function getHydratable(hydration, type) {
  if (!hydration) return null;
  const entry = hydration.find(h => h.hydratable === type);
  return entry?.data || null;
}

function formatDuration(ms) {
  if (!ms) return null;
  const totalSec = Math.round(ms / 1000);
  return totalSec;
}

// ── Track extraction from playlist hydration ──

function extractPlaylistTracks(playlistData) {
  const items = [];
  const tracks = playlistData?.tracks || [];

  for (const track of tracks) {
    // Skip stubs (only have id, kind, monetization_model, policy)
    if (!track.title) continue;

    items.push({
      title: track.title,
      artist: track.user?.username || null,
      url: track.permalink_url || null,
      itemType: "track",
      duration: formatDuration(track.duration),
      playbackCount: track.playback_count || null,
      likesCount: track.likes_count || null,
      genre: track.genre || null,
    });
  }

  return items;
}

// ── Main parse function ──

export async function parse(url) {
  const metadata = {
    source: "soundcloud",
    sourceType: "soundcloud",
    resourceType: "profile",
    url,
    title: null,
    description: null,
    thumbnailUrl: null,
    providerName: "SoundCloud",
  };

  let items = [];

  // Fetch oEmbed for all URL types (always works)
  const oembed = await fetchOEmbed(url);
  if (oembed) {
    metadata.title = oembed.title || null;
    metadata.description = oembed.description || null;
    metadata.thumbnailUrl = oembed.thumbnail_url || null;
  }

  // ── Single track ──
  if (classifyUrl(url) === "single_item") {
    metadata.resourceType = "track";

    const html = await fetchHtml(url);
    if (html) {
      const hydration = extractHydration(html);
      const sound = getHydratable(hydration, "sound");
      const user = getHydratable(hydration, "user");

      if (sound) {
        metadata.title = metadata.title || sound.title;
        metadata.thumbnailUrl = metadata.thumbnailUrl || sound.artwork_url?.replace("-large", "-t500x500");

        const description = [
          sound.genre || null,
          sound.playback_count ? `${sound.playback_count.toLocaleString()} plays` : null,
          sound.likes_count ? `${sound.likes_count.toLocaleString()} likes` : null,
          sound.label_name || null,
        ].filter(Boolean).join(" · ");

        items.push({
          position: 1,
          title: sound.title,
          artist: user?.username || sound.user?.username || null,
          url: sound.permalink_url || url,
          itemType: "track",
          duration: formatDuration(sound.duration),
          showName: null,
          description: description || sound.description || null,
        });

        return { metadata, items };
      }
    }

    // Fallback: parse oEmbed title "Track Name by Artist"
    if (oembed?.title) {
      const byMatch = oembed.title.match(/^(.+?)\s+by\s+(.+)$/);
      items.push({
        position: 1,
        title: byMatch ? byMatch[1] : oembed.title,
        artist: byMatch ? byMatch[2] : (oembed.author_name || null),
        url,
        itemType: "track",
        duration: null,
        showName: null,
        description: null,
      });
    }

    return { metadata, items };
  }

  // ── Playlist/set ──
  if (/soundcloud\.com\/[^/]+\/sets\//i.test(url)) {
    metadata.resourceType = "playlist";

    const html = await fetchHtml(url);
    if (html) {
      const hydration = extractHydration(html);
      const playlist = getHydratable(hydration, "playlist");
      const user = getHydratable(hydration, "user");

      if (playlist) {
        metadata.title = metadata.title || playlist.title;
        metadata.description = metadata.description || playlist.description;
        metadata.thumbnailUrl = metadata.thumbnailUrl || playlist.artwork_url?.replace("-large", "-t500x500");

        const trackItems = extractPlaylistTracks(playlist);
        const artistName = user?.username || playlist.user?.username || oembed?.author_name || null;

        items = trackItems.map((t, i) => ({
          position: i + 1,
          title: t.title,
          artist: t.artist || artistName,
          url: t.url || null,
          itemType: "track",
          duration: t.duration,
          showName: null,
          description: [
            t.genre || null,
            t.playbackCount ? `${t.playbackCount.toLocaleString()} plays` : null,
          ].filter(Boolean).join(" · ") || null,
        }));

        // Note stub tracks count for context
        const totalTracks = playlist.track_count || playlist.tracks?.length || 0;
        if (totalTracks > items.length && items.length > 0) {
          metadata.description = (metadata.description || "") +
            (metadata.description ? " · " : "") +
            `${totalTracks} tracks total (${items.length} with full data)`;
        }

        return { metadata, items };
      }
    }

    // Fallback: oEmbed title "Playlist Name by Artist"
    if (oembed?.title) {
      const byMatch = oembed.title.match(/^(.+?)\s+by\s+(.+)$/);
      metadata.title = byMatch ? byMatch[1] : oembed.title;
    }

    return { metadata, items };
  }

  // ── Profile / likes / reposts ──
  metadata.resourceType = "profile";

  // Profiles often return 403 — try fetching, fall back to oEmbed
  const html = await fetchHtml(url);
  if (html) {
    const hydration = extractHydration(html);
    const user = getHydratable(hydration, "user");

    if (user) {
      metadata.title = metadata.title || user.username;
      metadata.description = metadata.description || user.description;
      metadata.thumbnailUrl = metadata.thumbnailUrl || user.avatar_url?.replace("-large", "-t500x500");

      // Add profile context
      const profileInfo = [
        user.city || null,
        user.country_code || null,
        user.followers_count ? `${user.followers_count.toLocaleString()} followers` : null,
        user.track_count ? `${user.track_count} tracks` : null,
      ].filter(Boolean).join(" · ");
      if (profileInfo) {
        metadata.description = profileInfo + (metadata.description ? ` — ${metadata.description}` : "");
      }
    }

    // Try to find track listings from collection or sound hydratables
    if (hydration) {
      // Some profile pages include a "collection" hydratable with recent tracks
      const collection = getHydratable(hydration, "collection");
      if (collection && Array.isArray(collection)) {
        for (const item of collection) {
          const track = item.track || item;
          if (!track.title) continue;
          items.push({
            title: track.title,
            artist: track.user?.username || user?.username || null,
            url: track.permalink_url || null,
            itemType: "track",
            duration: formatDuration(track.duration),
            playbackCount: track.playback_count || null,
            genre: track.genre || null,
          });
        }
      }

      // Check for individual sound entries
      const sound = getHydratable(hydration, "sound");
      if (sound && items.length === 0) {
        items.push({
          title: sound.title,
          artist: sound.user?.username || user?.username || null,
          url: sound.permalink_url || null,
          itemType: "track",
          duration: formatDuration(sound.duration),
          playbackCount: sound.playback_count || null,
          genre: sound.genre || null,
        });
      }
    }

    // Try to extract track links from HTML as fallback
    if (items.length === 0) {
      const trackLinks = [...html.matchAll(/<a[^>]*href="(\/[^/]+\/[^/]+)"[^>]*>([^<]+)<\/a>/g)];
      const seen = new Set();
      for (const m of trackLinks) {
        const href = m[1];
        const text = m[2].trim();
        // Filter to likely track links (not /sets/, /likes, etc.)
        if (/\/(sets|likes|reposts|tracks|albums|followers|following|popular-tracks|tags|stats|comments)\//i.test(href)) continue;
        if (href.split("/").length !== 3) continue; // /username/track-name
        if (text.length < 2 || text.length > 200) continue;
        if (seen.has(text)) continue;
        seen.add(text);

        items.push({
          title: text,
          artist: user?.username || oembed?.author_name || null,
          url: `https://soundcloud.com${href}`,
          itemType: "track",
          duration: null,
          playbackCount: null,
          genre: null,
        });

        if (items.length >= 30) break;
      }
    }
  }

  // If profile returned 403 and we have no data, use oEmbed metadata
  if (!html && oembed) {
    metadata.title = oembed.title || oembed.author_name || "SoundCloud Profile";
    metadata.description = oembed.description || null;
  }

  // Normalize items
  items = items.map((t, i) => ({
    position: i + 1,
    title: t.title,
    artist: t.artist || null,
    url: t.url || null,
    itemType: "track",
    duration: t.duration || null,
    showName: null,
    description: [
      t.genre || null,
      t.playbackCount ? `${t.playbackCount.toLocaleString()} plays` : null,
    ].filter(Boolean).join(" · ") || null,
  }));

  return { metadata, items };
}

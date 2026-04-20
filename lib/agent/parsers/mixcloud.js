// ── Mixcloud Source Parser ──
// Handles mixcloud.com URLs — shows (cloudcasts) and user profiles.
//
// Reliability strategy:
// - Mixcloud pages are JS-rendered SPAs (raw HTML has no og:tags), so HTML scraping is dead.
// - Primary data source: api.mixcloud.com/{key}/ — undocumented but stable public JSON,
//   no auth required. Returns name, description, audio_length, tags, pictures, user.
// - Fallback: app.mixcloud.com/oembed/ — sparse but reliable when the API misses.
// - Some shows have hidden_stats:true which zeros play_count/listener_count
//   (we don't surface those anyway).

export const name = "mixcloud";
export const sourceType = "mixcloud";

export const patterns = [
  /^https?:\/\/(?:www\.)?mixcloud\.com\//i,
];

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 10000;
const RESERVED_PATH = /^\/(discover|categories|genres|tag|live|select|search|upload|settings|notifications)\b/i;

function getPathname(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

export function classifyUrl(url) {
  const pathname = getPathname(url);
  if (!pathname || pathname === "/") return null;
  if (RESERVED_PATH.test(pathname)) return null;
  const trimmed = pathname.replace(/\/$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  // /{user}/{slug} or /{user}/{slug}/reposts → treat as single show
  if (parts.length >= 2) return "single_item";
  // /{user} → profile
  return "profile";
}

// ── Fetch helpers ──

async function fetchJson(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error("Mixcloud API error:", url, res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Mixcloud fetch error:", url, err.message || err);
    return null;
  }
}

async function fetchOEmbed(url) {
  // app.mixcloud.com is the redirect target of www.mixcloud.com/oembed/.
  // Hitting it directly skips a 301 hop.
  return fetchJson(`https://app.mixcloud.com/oembed/?url=${encodeURIComponent(url)}&format=json`);
}

function truncate(text, maxChars) {
  if (typeof text !== "string") return null;
  const cleaned = text
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ");
  if (!cleaned) return null;
  if (cleaned.length <= maxChars) return cleaned;
  const slice = cleaned.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + "…";
}

function pickThumbnail(pictures) {
  if (!pictures || typeof pictures !== "object") return null;
  return pictures.extra_large || pictures.large || pictures.medium || null;
}

function blankMetadata(url, resourceType) {
  return {
    source: "mixcloud",
    sourceType: "mixcloud",
    resourceType,
    url,
    title: null,
    description: null,
    thumbnailUrl: null,
    providerName: "Mixcloud",
    author: null,
    publishedTime: null,
  };
}

// ── oEmbed fallback (used when API fails) ──

async function applyOEmbed(metadata, originalUrl) {
  const oembed = await fetchOEmbed(originalUrl);
  if (!oembed) return metadata;
  metadata.title = metadata.title || oembed.title || null;
  metadata.thumbnailUrl = metadata.thumbnailUrl || oembed.image || null;
  metadata.author = metadata.author || oembed.author_name || null;
  metadata.providerName = oembed.provider_name || metadata.providerName;
  return metadata;
}

function fallbackItems(metadata, itemType) {
  if (!metadata.title) return [];
  return [{
    position: 1,
    title: metadata.title,
    artist: metadata.author || null,
    url: metadata.url,
    itemType,
    duration: null,
    showName: itemType === "show" ? metadata.title : null,
    description: null,
    genre: null,
  }];
}

// ── Single show parsing ──

async function parseSingleItem(url) {
  const pathname = getPathname(url);
  const metadata = blankMetadata(url, "track");
  if (!pathname) {
    await applyOEmbed(metadata, url);
    return { metadata, items: fallbackItems(metadata, "show") };
  }

  // Strip trailing /reposts/ so we hit the base show key
  let key = pathname.replace(/\/reposts\/?$/i, "/");
  if (!key.endsWith("/")) key += "/";

  const apiUrl = `https://api.mixcloud.com${key}`;
  const data = await fetchJson(apiUrl);

  if (!data) {
    await applyOEmbed(metadata, url);
    return { metadata, items: fallbackItems(metadata, "show") };
  }

  metadata.title = data.name || null;
  metadata.description = truncate(data.description, 500);
  metadata.thumbnailUrl = pickThumbnail(data.pictures);
  metadata.author = data.user?.name || data.user?.username || null;
  metadata.publishedTime = data.created_time || null;
  metadata.url = data.url || url;

  const items = [{
    position: 1,
    title: data.name || null,
    artist: data.user?.name || data.user?.username || null,
    url: data.url || url,
    itemType: "show",
    duration: data.audio_length || null,
    showName: data.name || null,
    description: truncate(data.description, 500),
    genre: (data.tags || []).map(t => t?.name).filter(Boolean).join(", ") || null,
  }];

  return { metadata, items };
}

// ── Profile parsing ──

async function parseProfile(url) {
  const pathname = getPathname(url);
  const metadata = blankMetadata(url, "profile");
  if (!pathname) {
    await applyOEmbed(metadata, url);
    return { metadata, items: fallbackItems(metadata, "profile") };
  }

  const username = pathname.replace(/\/$/, "").split("/").filter(Boolean)[0];
  if (!username) {
    await applyOEmbed(metadata, url);
    return { metadata, items: fallbackItems(metadata, "profile") };
  }

  const userApi = `https://api.mixcloud.com/${encodeURIComponent(username)}/`;
  const cloudcastsApi = `https://api.mixcloud.com/${encodeURIComponent(username)}/cloudcasts/?limit=25`;

  const [user, cloudcastsRes] = await Promise.all([
    fetchJson(userApi),
    fetchJson(cloudcastsApi),
  ]);

  if (!user) {
    await applyOEmbed(metadata, url);
    return { metadata, items: fallbackItems(metadata, "profile") };
  }

  metadata.title = user.name || user.username || null;
  metadata.description = truncate(user.biog, 500);
  metadata.thumbnailUrl = pickThumbnail(user.pictures);
  metadata.author = user.name || user.username || null;
  metadata.url = user.url || url;

  const cloudcasts = Array.isArray(cloudcastsRes?.data) ? cloudcastsRes.data : [];
  const items = cloudcasts.map((c, i) => ({
    position: i + 1,
    title: c.name || null,
    artist: user.name || user.username || null,
    url: c.url || null,
    itemType: "show",
    duration: c.audio_length || null,
    showName: c.name || null,
    description: null,
    genre: (c.tags || []).map(t => t?.name).filter(Boolean).join(", ") || null,
  }));

  return { metadata, items };
}

// ── Main entry ──

export async function parse(url) {
  const kind = classifyUrl(url);
  if (kind === "single_item") return parseSingleItem(url);
  if (kind === "profile") return parseProfile(url);

  // Unknown shape — return a valid envelope so downstream doesn't choke.
  return { metadata: blankMetadata(url, "other"), items: [] };
}

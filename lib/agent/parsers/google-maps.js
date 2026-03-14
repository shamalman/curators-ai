// ── Google Maps Source Parser ──
// Handles google.com/maps and maps.app.goo.gl URLs
//
// Reliability strategy (discovered via diagnostics 2026-03):
// - Google Maps is heavily JS-rendered — NO og:title, NO JSON-LD, NO structured HTML
// - APP_INITIALIZATION_STATE has place name in [[null,\"Name\" pattern
// - Place name is reliably extractable from the URL: /place/Name+Here/@lat,lng
// - Short links (maps.app.goo.gl) serve JS-only shell — cannot resolve server-side
// - Shared lists/collections have no server-rendered place data
//
// Strategy: URL parsing (primary) + APP_INITIALIZATION_STATE (backup) + coordinates from URL

export const name = "google-maps";
export const sourceType = "google_maps";

export const patterns = [
  /^https?:\/\/(www\.)?google\.[a-z.]+\/maps\//i,
  /^https?:\/\/maps\.google\.[a-z.]+\//i,
  /^https?:\/\/goo\.gl\/maps\//i,
  /^https?:\/\/maps\.app\.goo\.gl\//i,
];

export function classifyUrl(url) {
  // Short links — might be a place or a list, we can't tell without resolving
  if (/goo\.gl/i.test(url)) return "single_item";
  // Contributed reviews / saved lists = profile analysis
  if (/\/contrib\//i.test(url)) return "profile";
  if (/\/lists\//i.test(url)) return "profile";
  if (/\/placelists\//i.test(url)) return "profile";
  if (/\/@[^/]*\/data=/i.test(url)) return "profile";
  // Single place = single item
  if (/\/place\//i.test(url)) return "single_item";
  // Search query
  if (/\/search\//i.test(url)) return "single_item";
  return "profile";
}

// ── URL helpers ──

const CHROME_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function extractPlaceFromUrl(url) {
  // /place/Name+Here/@lat,lng,zoom
  const match = url.match(/\/place\/([^/@?]+)/);
  if (!match) return null;
  const rawName = match[1];
  try {
    return decodeURIComponent(rawName.replace(/\+/g, " "));
  } catch {
    return rawName.replace(/\+/g, " ");
  }
}

function extractCoordsFromUrl(url) {
  const match = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (!match) return null;
  return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
}

function extractSearchQuery(url) {
  const match = url.match(/\/search\/([^/@?]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return match[1].replace(/\+/g, " ");
  }
}

// ── Fetch helpers ──

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
    return { html: res.ok ? await res.text() : null, finalUrl: res.url };
  } catch (err) {
    console.error("Google Maps fetch error:", url, err);
    return { html: null, finalUrl: url };
  }
}

// Extract place name from APP_INITIALIZATION_STATE embedded data
function extractNameFromAppInit(html) {
  // Pattern 1: [[null,\"Name\"
  const match1 = html.match(/\[\[null,\\"([^\\]+)\\"/);
  if (match1) return match1[1];
  // Pattern 2: [null,null,[null,"Name"]]
  const match2 = html.match(/\[null,null,\[null,"([^"]+)"\]\]/);
  if (match2) return match2[1];
  return null;
}

// ── Main parse function ──

export async function parse(url) {
  const metadata = {
    source: "google_maps",
    sourceType: "google_maps",
    resourceType: "place",
    url,
    title: null,
    description: null,
    thumbnailUrl: null,
    providerName: "Google Maps",
    coordinates: null,
    address: null,
  };

  const items = [];

  // Short links can't be resolved server-side (JS-only redirect)
  if (/goo\.gl/i.test(url)) {
    metadata.title = "Google Maps Link";
    metadata.description = "Short link — place details will be extracted during analysis.";
    metadata.resourceType = "short_link";
    // Try fetching anyway — the final URL might redirect on server
    const { html, finalUrl } = await fetchHtml(url);
    if (finalUrl && finalUrl !== url && /\/place\//.test(finalUrl)) {
      // Redirect worked — extract from the final URL
      const placeName = extractPlaceFromUrl(finalUrl);
      if (placeName) {
        metadata.title = placeName;
        metadata.url = finalUrl;
        metadata.resourceType = "place";
        const coords = extractCoordsFromUrl(finalUrl);
        if (coords) metadata.coordinates = coords;
        items.push({
          position: 1,
          title: placeName,
          artist: null,
          url: finalUrl,
          itemType: "place",
          duration: null,
          showName: null,
          description: null,
        });
      }
    }
    // If redirect didn't help, return minimal metadata
    if (items.length === 0) {
      items.push({
        position: 1,
        title: "Google Maps Place",
        artist: null,
        url,
        itemType: "place",
        duration: null,
        showName: null,
        description: "Shared via Google Maps short link",
      });
    }
    return { metadata, items };
  }

  // Single place URLs
  if (/\/place\//.test(url) || /\/search\//.test(url)) {
    const isSearch = /\/search\//.test(url);
    const placeName = isSearch ? extractSearchQuery(url) : extractPlaceFromUrl(url);
    const coords = extractCoordsFromUrl(url);

    metadata.resourceType = "place";
    metadata.title = placeName;
    if (coords) metadata.coordinates = coords;

    // Fetch the page to try getting the real name from APP_INITIALIZATION_STATE
    const { html, finalUrl } = await fetchHtml(url);

    // Update URL if redirected (search URLs often redirect to /place/)
    if (finalUrl && finalUrl !== url) {
      metadata.url = finalUrl;
      const redirectedName = extractPlaceFromUrl(finalUrl);
      if (redirectedName) metadata.title = redirectedName;
      const redirectedCoords = extractCoordsFromUrl(finalUrl);
      if (redirectedCoords) metadata.coordinates = redirectedCoords;
    }

    // Try extracting the real name from the page HTML
    if (html) {
      const appInitName = extractNameFromAppInit(html);
      if (appInitName) metadata.title = appInitName;
    }

    if (metadata.title) {
      items.push({
        position: 1,
        title: metadata.title,
        artist: null,
        url: metadata.url,
        itemType: "place",
        duration: null,
        showName: null,
        description: coords ? `Location: ${coords.lat}, ${coords.lng}` : null,
      });
    }

    return { metadata, items };
  }

  // Lists, collections, contributed reviews
  if (/\/placelists\/|\/contrib\/|\/lists\/|\/@[^/]*\/data=/.test(url)) {
    metadata.resourceType = "list";

    const { html, finalUrl } = await fetchHtml(url);
    if (finalUrl) metadata.url = finalUrl;

    // Lists are JS-rendered — no place data available server-side
    // Return minimal metadata so the agent can at least acknowledge it
    metadata.title = "Google Maps Collection";
    metadata.description = "Shared list — Google Maps renders list content client-side only.";

    // Try to extract any place names from the embedded data
    if (html) {
      const appInitName = extractNameFromAppInit(html);
      if (appInitName) metadata.title = appInitName;

      // Look for place names in the embedded data
      const placeNames = html.matchAll(/\[null,"([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,5})"\]/g);
      let pos = 1;
      for (const m of placeNames) {
        const name = m[1];
        if (name.includes("Google") || name.includes("Find local") || name === "United States") continue;
        items.push({
          position: pos++,
          title: name,
          artist: null,
          url: null,
          itemType: "place",
          duration: null,
          showName: null,
          description: null,
        });
        if (pos > 50) break;
      }
    }

    if (items.length === 0) {
      items.push({
        position: 1,
        title: metadata.title,
        artist: null,
        url: metadata.url,
        itemType: "list",
        duration: null,
        showName: null,
        description: metadata.description,
      });
    }

    return { metadata, items };
  }

  // Generic fallback — try to extract what we can
  const { html, finalUrl } = await fetchHtml(url);
  if (finalUrl) metadata.url = finalUrl;

  const redirectedName = extractPlaceFromUrl(finalUrl || url);
  if (redirectedName) {
    metadata.title = redirectedName;
    metadata.resourceType = "place";
    items.push({
      position: 1,
      title: redirectedName,
      artist: null,
      url: metadata.url,
      itemType: "place",
      duration: null,
      showName: null,
      description: null,
    });
  }

  if (html) {
    const appInitName = extractNameFromAppInit(html);
    if (appInitName && !metadata.title) {
      metadata.title = appInitName;
      if (items.length === 0) {
        items.push({
          position: 1,
          title: appInitName,
          artist: null,
          url: metadata.url,
          itemType: "place",
          duration: null,
          showName: null,
          description: null,
        });
      }
    }
  }

  return { metadata, items };
}

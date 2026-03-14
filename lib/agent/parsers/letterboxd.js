// ── Letterboxd Source Parser ──
// Handles letterboxd.com URLs — profiles, lists, single films
//
// Reliability strategy (discovered via diagnostics 2026-03):
// - Profiles serve clean HTML with film data in sections:
//   - Favourites: img alt tags in #favourites section
//   - Recent activity: data-film-id + img alt + rated-N classes for ratings
//   - Pinned/recent reviews, popular reviews, pinned/recent lists
// - Single films: rich JSON-LD (Movie type) with director, genre, year, rating
// - OG tags work on profiles (title, description with bio + favourites + watch count)
// - /films/, /lists/ index, /watchlist/ return 403 — server-side blocked
// - Lists: OG title available, film data extraction varies
//
// Order: OG tags (metadata) + section parsing (profiles) or JSON-LD (films)

export const name = "letterboxd";
export const sourceType = "letterboxd";

export const patterns = [
  /^https?:\/\/(www\.)?letterboxd\.com\//i,
];

export function classifyUrl(url) {
  // Single film page
  if (/letterboxd\.com\/film\/[^/]+/i.test(url)) return "single_item";
  // User profile pages
  if (/letterboxd\.com\/[^/]+\/list\//i.test(url)) return "profile";
  if (/letterboxd\.com\/[^/]+\/films\/?/i.test(url)) return "profile";
  if (/letterboxd\.com\/[^/]+\/watchlist\/?/i.test(url)) return "profile";
  if (/letterboxd\.com\/[^/]+\/?$/i.test(url)) return "profile";
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
    console.error("Letterboxd fetch error:", url, err);
    return null;
  }
}

function extractMeta(html, property) {
  const match = html.match(new RegExp(`<meta[^>]*(?:property|name)="${property}"[^>]*content="([^"]*)"`, "i"));
  return match ? decodeEntities(match[1]) : null;
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'");
}

// ── Profile extraction ──

function extractProfileFilms(html) {
  const items = [];
  const seen = new Set();

  // Parse each section for film data
  const sections = html.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/gi);
  for (const sec of sections) {
    const content = sec[1];
    const filmIds = [...content.matchAll(/data-film-id="(\d+)"/g)];
    if (filmIds.length === 0) continue;

    // Determine section type from heading
    const heading = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    const sectionName = heading ? heading[1].replace(/<[^>]+>/g, "").trim().toLowerCase() : "";

    // Extract film names from img alt
    const alts = [...content.matchAll(/<img[^>]*alt="([^"]+)"/g)];
    const filmNames = alts
      .map(m => decodeEntities(m[1]))
      .filter(name => name.length > 1 && name.length < 100);

    // Extract ratings (rated-N class where N is 1-10, representing half-stars)
    const ratings = [...content.matchAll(/rated-(\d+)/g)];

    // Determine section category for context
    let sectionType = "film";
    if (sectionName.includes("favorite")) sectionType = "favorite";
    else if (sectionName.includes("recent activity")) sectionType = "recent";
    else if (sectionName.includes("review")) sectionType = "reviewed";
    else if (sectionName.includes("list")) sectionType = "listed";

    for (let i = 0; i < filmNames.length; i++) {
      const name = filmNames[i];
      if (seen.has(name)) continue;
      seen.add(name);

      const rating = ratings[i] ? parseInt(ratings[i][1]) / 2 : null; // Convert half-stars to 5-point scale

      items.push({
        title: name,
        artist: null,
        url: null,
        itemType: "film",
        duration: null,
        showName: null,
        description: sectionType === "favorite" ? "Favourite film" : null,
        rating,
        sectionType,
      });
    }
  }

  return items;
}

// ── List extraction ──

function extractListFilms(html) {
  const items = [];

  // Try data-film-slug or data-film-id patterns
  const filmSlugs = [...html.matchAll(/data-film-slug="([^"]+)"/g)];
  if (filmSlugs.length > 0) {
    for (const m of filmSlugs) {
      const slug = m[1];
      const name = slug.replace(/-\d{4}$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      items.push({
        title: name,
        artist: null,
        url: `https://letterboxd.com/film/${slug}/`,
        itemType: "film",
      });
    }
    return items;
  }

  // Try img alt tags with image class
  const filmAlts = [...html.matchAll(/<img[^>]*alt="([^"]+)"[^>]*class="[^"]*image/g)];
  for (const m of filmAlts) {
    const name = decodeEntities(m[1]);
    if (name.length > 1 && name.length < 100) {
      items.push({ title: name, artist: null, url: null, itemType: "film" });
    }
  }

  // Try poster containers with data-target-link
  if (items.length === 0) {
    const targets = [...html.matchAll(/data-target-link="\/film\/([^/"]+)/g)];
    for (const m of targets) {
      const slug = m[1];
      const name = slug.replace(/-\d{4}$/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      items.push({
        title: name,
        artist: null,
        url: `https://letterboxd.com/film/${slug}/`,
        itemType: "film",
      });
    }
  }

  // Last resort: all img alt tags in poster sections
  if (items.length === 0) {
    const allAlts = [...html.matchAll(/<img[^>]*alt="([^"]+)"/g)];
    const filmNames = allAlts
      .map(m => decodeEntities(m[1]))
      .filter(n => n.length > 2 && n.length < 80 && !/avatar|profile|logo/i.test(n));
    const seen = new Set();
    for (const name of filmNames) {
      if (seen.has(name)) continue;
      seen.add(name);
      items.push({ title: name, artist: null, url: null, itemType: "film" });
    }
  }

  return items;
}

// ── Single film extraction (JSON-LD) ──

function extractFilmJsonLd(html) {
  const scriptMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scriptMatches) {
    try {
      const cleaned = match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
      const data = JSON.parse(cleaned);

      if (data["@type"] === "Movie") {
        return {
          title: data.name || null,
          directors: (data.director || []).map(d => d.name).filter(Boolean),
          year: data.releasedEvent?.[0]?.startDate || null,
          genres: data.genre || [],
          rating: data.aggregateRating?.ratingValue || null,
          ratingCount: data.aggregateRating?.ratingCount || null,
          country: (data.countryOfOrigin || []).map(c => c.name).filter(Boolean),
          actors: (data.actors || []).slice(0, 5).map(a => a.name).filter(Boolean),
          url: data.url || null,
          image: data.image || null,
        };
      }
    } catch (err) {
      // JSON parse failed, skip
    }
  }
  return null;
}

// ── Main parse function ──

export async function parse(url) {
  const metadata = {
    source: "letterboxd",
    sourceType: "letterboxd",
    resourceType: "profile",
    url,
    title: null,
    description: null,
    thumbnailUrl: null,
    providerName: "Letterboxd",
  };

  let items = [];

  // ── Single film ──
  if (/letterboxd\.com\/film\/[^/]+/i.test(url)) {
    metadata.resourceType = "film";

    const html = await fetchHtml(url);
    if (!html) throw new Error(`Could not fetch Letterboxd film page: ${url}`);

    metadata.title = extractMeta(html, "og:title");
    metadata.description = extractMeta(html, "og:description");
    metadata.thumbnailUrl = extractMeta(html, "og:image");

    const filmData = extractFilmJsonLd(html);
    if (filmData) {
      metadata.title = metadata.title || filmData.title;
      const directorStr = filmData.directors.length > 0 ? filmData.directors.join(", ") : null;

      items.push({
        position: 1,
        title: filmData.title || metadata.title,
        artist: directorStr,
        url,
        itemType: "film",
        duration: null,
        showName: null,
        description: [
          filmData.year ? `(${filmData.year})` : null,
          filmData.genres.length > 0 ? filmData.genres.join(", ") : null,
          filmData.country.length > 0 ? filmData.country.join(", ") : null,
          filmData.rating ? `${filmData.rating}/5 on Letterboxd` : null,
        ].filter(Boolean).join(" · "),
      });
    } else if (metadata.title) {
      items.push({
        position: 1,
        title: metadata.title,
        artist: null,
        url,
        itemType: "film",
        duration: null,
        showName: null,
        description: metadata.description,
      });
    }

    return { metadata, items };
  }

  // ── User list ──
  if (/letterboxd\.com\/[^/]+\/list\//i.test(url)) {
    metadata.resourceType = "list";

    const html = await fetchHtml(url);
    if (!html) throw new Error(`Could not fetch Letterboxd list: ${url}`);

    metadata.title = extractMeta(html, "og:title");
    metadata.description = extractMeta(html, "og:description");
    metadata.thumbnailUrl = extractMeta(html, "og:image");

    items = extractListFilms(html);

    // Normalize
    items = items.map((t, i) => ({
      position: i + 1,
      title: t.title,
      artist: t.artist || null,
      url: t.url || null,
      itemType: "film",
      duration: null,
      showName: null,
      description: t.description || null,
    }));

    return { metadata, items };
  }

  // ── Profile (or /films/, /watchlist/ which may 403 → fall back to profile) ──
  metadata.resourceType = "profile";

  // If URL is /films/ or /watchlist/, try it first, then fall back to base profile
  let html = null;
  const profileBase = url.match(/letterboxd\.com\/([^/]+)/)?.[1];

  if (/\/(films|watchlist)\/?/.test(url)) {
    html = await fetchHtml(url);
    // If blocked, fall back to base profile
    if (!html && profileBase) {
      html = await fetchHtml(`https://letterboxd.com/${profileBase}/`);
      metadata.url = `https://letterboxd.com/${profileBase}/`;
    }
  } else {
    html = await fetchHtml(url);
  }

  if (!html) throw new Error(`Could not fetch Letterboxd page: ${url}`);

  metadata.title = extractMeta(html, "og:title");
  metadata.description = extractMeta(html, "og:description");
  metadata.thumbnailUrl = extractMeta(html, "og:image");

  items = extractProfileFilms(html);

  // Normalize
  items = items.map((t, i) => ({
    position: i + 1,
    title: t.title,
    artist: t.artist || null,
    url: t.url || null,
    itemType: "film",
    duration: null,
    showName: null,
    description: [
      t.sectionType === "favorite" ? "Favourite" : null,
      t.sectionType === "recent" ? "Recently watched" : null,
      t.sectionType === "reviewed" ? "Reviewed" : null,
      t.rating ? `Rated ${t.rating}/5` : null,
    ].filter(Boolean).join(" · ") || null,
  }));

  return { metadata, items };
}

// ── Goodreads Source Parser ──
// Handles goodreads.com URLs — books, profiles, lists, authors
//
// Reliability strategy (discovered via diagnostics 2026-03):
// - Single books: rich JSON-LD (Book type) with author array, aggregateRating, pages, awards
// - Community lists: book names from <a title=""> attributes + href slugs, author from /author/show/ links
//   Rating as "4.35 avg rating" text node. .bookTitle class exists but text is empty (JS-rendered)
// - Author pages: same pattern — title attr + href slug on /book/show/ links
// - Profiles: /book/show/ links, img title="Book Name by Author", currently-reading section
//   OG tags unreliable. Shelves (/review/list) redirect to sign_in — auth required
// - Fallback: extract book names from href slugs (/book/show/ID-book-name or /book/show/ID.Book_Name)

export const name = "goodreads";
export const sourceType = "goodreads";

export const patterns = [
  /^https?:\/\/(www\.)?goodreads\.com\//i,
];

export function classifyUrl(url) {
  if (/goodreads\.com\/book\/show\//i.test(url)) return "single_item";
  if (/goodreads\.com\/author\//i.test(url)) return "profile";
  if (/goodreads\.com\/list\//i.test(url)) return "profile";
  if (/goodreads\.com\/user\/show\//i.test(url)) return "profile";
  if (/goodreads\.com\/review\/list/i.test(url)) return "profile";
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
    if (!res.ok) return { html: null, finalUrl: res.url };
    return { html: await res.text(), finalUrl: res.url };
  } catch (err) {
    console.error("Goodreads fetch error:", url, err);
    return { html: null, finalUrl: url };
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

// ── Book name from URL slug ──

function bookNameFromSlug(href) {
  // /book/show/2767052-the-hunger-games or /book/show/1885.Pride_and_Prejudice
  const match = href.match(/\/book\/show\/\d+[.-](.+)/);
  if (!match) return null;
  const slug = match[1];
  // Handle both formats: dashes and underscores
  const name = slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
  return name.length > 1 ? name : null;
}

// ── Author name from URL slug ──

function authorNameFromSlug(href) {
  // /author/show/153394.Suzanne_Collins
  const match = href.match(/\/author\/show\/\d+\.(.+)/);
  if (!match) return null;
  return match[1].replace(/_/g, " ");
}

// ── Single book extraction (JSON-LD) ──

function extractBookJsonLd(html) {
  const scriptMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scriptMatches) {
    try {
      const cleaned = match[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
      const data = JSON.parse(cleaned);

      if (data["@type"] === "Book") {
        return {
          title: data.name || null,
          authors: (data.author || []).map(a => a.name).filter(Boolean),
          rating: data.aggregateRating?.ratingValue || null,
          ratingCount: data.aggregateRating?.ratingCount || null,
          reviewCount: data.aggregateRating?.reviewCount || null,
          pages: data.numberOfPages || null,
          format: data.bookFormat || null,
          language: data.inLanguage || null,
          awards: data.awards || null,
          image: data.image || null,
          url: null,
        };
      }
    } catch (err) {
      console.error("Goodreads JSON-LD parse error:", err);
    }
  }
  return null;
}

// ── Extract genres from HTML ──

function extractGenres(html) {
  // Genres appear as links to /genres/genre-name
  const genreMatches = [...html.matchAll(/\/genres\/([^"]+)"/g)];
  const genres = [];
  const seen = new Set();
  for (const m of genreMatches) {
    const genre = decodeURIComponent(m[1]).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (!seen.has(genre.toLowerCase()) && genre.length < 40) {
      seen.add(genre.toLowerCase());
      genres.push(genre);
    }
    if (genres.length >= 8) break;
  }
  return genres;
}

// ── Community list extraction ──

function extractListBooks(html) {
  const items = [];
  const seen = new Set();

  // Strategy 1: <a> tags with title attribute linking to /book/show/
  const titleLinks = [...html.matchAll(/<a[^>]*href="([^"]*\/book\/show\/[^"]*)"[^>]*title="([^"]*)"[^>]*>/gi)];
  for (const m of titleLinks) {
    const href = m[1];
    const title = decodeEntities(m[2]);
    if (seen.has(title) || title.length < 2) continue;
    seen.add(title);

    // Look for nearby author link
    const bookId = href.match(/\/book\/show\/(\d+)/)?.[1];
    let author = null;

    // Search for author near this book entry
    if (bookId) {
      const bookContext = html.substring(
        Math.max(0, html.indexOf(href) - 200),
        Math.min(html.length, html.indexOf(href) + 500)
      );
      const authorMatch = bookContext.match(/\/author\/show\/\d+\.([^"]+)"/);
      if (authorMatch) {
        author = authorMatch[1].replace(/_/g, " ");
      }
    }

    // Look for rating text near this book
    let rating = null;
    if (bookId) {
      const afterBook = html.substring(
        html.indexOf(href),
        Math.min(html.length, html.indexOf(href) + 600)
      );
      const ratingMatch = afterBook.match(/([\d.]+)\s*avg\s*rating/);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
    }

    items.push({
      title,
      artist: author,
      url: href.startsWith("http") ? href : `https://www.goodreads.com${href}`,
      itemType: "book",
      rating,
    });

    if (items.length >= 100) break;
  }

  // Strategy 2: If no title attrs found, extract from href slugs
  if (items.length === 0) {
    const bookLinks = [...html.matchAll(/href="([^"]*\/book\/show\/[^"]*)"/gi)];
    for (const m of bookLinks) {
      const href = m[1];
      const title = bookNameFromSlug(href);
      if (!title || seen.has(title)) continue;
      seen.add(title);

      items.push({
        title,
        artist: null,
        url: href.startsWith("http") ? href : `https://www.goodreads.com${href}`,
        itemType: "book",
        rating: null,
      });

      if (items.length >= 100) break;
    }
  }

  return items;
}

// ── Author page extraction ──

function extractAuthorBooks(html) {
  const items = [];
  const seen = new Set();

  // Extract author name from the page
  let authorName = null;
  const authorH1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  if (authorH1) authorName = decodeEntities(authorH1[1].trim());

  // Strategy 1: <a> with title attr + /book/show/
  const titleLinks = [...html.matchAll(/<a[^>]*href="([^"]*\/book\/show\/[^"]*)"[^>]*title="([^"]*)"[^>]*>/gi)];
  for (const m of titleLinks) {
    const href = m[1];
    const title = decodeEntities(m[2]);
    if (seen.has(title) || title.length < 2) continue;
    seen.add(title);

    items.push({
      title,
      artist: authorName,
      url: href.startsWith("http") ? href : `https://www.goodreads.com${href}`,
      itemType: "book",
    });

    if (items.length >= 50) break;
  }

  // Strategy 2: href slug fallback
  if (items.length === 0) {
    const bookLinks = [...html.matchAll(/href="([^"]*\/book\/show\/[^"]*)"/gi)];
    for (const m of bookLinks) {
      const href = m[1];
      const title = bookNameFromSlug(href);
      if (!title || seen.has(title)) continue;
      seen.add(title);

      items.push({
        title,
        artist: authorName,
        url: href.startsWith("http") ? href : `https://www.goodreads.com${href}`,
        itemType: "book",
      });

      if (items.length >= 50) break;
    }
  }

  return items;
}

// ── Profile extraction ──

function extractProfileBooks(html) {
  const items = [];
  const seen = new Set();

  // Strategy 1: img title="Book Name by Author"
  const imgTitles = [...html.matchAll(/<img[^>]*title="([^"]+)"[^>]*>/gi)];
  for (const m of imgTitles) {
    const raw = decodeEntities(m[1]);
    // Pattern: "Book Name by Author Name"
    const byMatch = raw.match(/^(.+?)\s+by\s+(.+)$/);
    if (byMatch) {
      const title = byMatch[1].trim();
      const author = byMatch[2].trim();
      if (seen.has(title) || title.length < 2) continue;
      seen.add(title);
      items.push({ title, artist: author, url: null, itemType: "book", section: null });
    }
  }

  // Strategy 2: <a> with title attr + /book/show/
  const titleLinks = [...html.matchAll(/<a[^>]*href="([^"]*\/book\/show\/[^"]*)"[^>]*title="([^"]*)"[^>]*>/gi)];
  for (const m of titleLinks) {
    const href = m[1];
    const title = decodeEntities(m[2]);
    if (seen.has(title) || title.length < 2) continue;
    seen.add(title);

    // Try to find author nearby
    const pos = html.indexOf(href);
    const context = html.substring(pos, Math.min(html.length, pos + 500));
    const authorMatch = context.match(/\/author\/show\/\d+\.([^"]+)"/);
    const author = authorMatch ? authorMatch[1].replace(/_/g, " ") : null;

    items.push({
      title,
      artist: author,
      url: href.startsWith("http") ? href : `https://www.goodreads.com${href}`,
      itemType: "book",
      section: null,
    });
  }

  // Strategy 3: href slug fallback for any remaining /book/show/ links
  const bookLinks = [...html.matchAll(/href="([^"]*\/book\/show\/[^"]*)"/gi)];
  for (const m of bookLinks) {
    const href = m[1];
    const title = bookNameFromSlug(href);
    if (!title || seen.has(title)) continue;
    seen.add(title);

    items.push({
      title,
      artist: null,
      url: href.startsWith("http") ? href : `https://www.goodreads.com${href}`,
      itemType: "book",
      section: null,
    });
  }

  // Try to detect "currently reading" section and tag those items
  const currentlyReadingMatch = html.match(/currently[\s-]reading/i);
  if (currentlyReadingMatch && items.length > 0) {
    // The first few items on a profile are typically "currently reading"
    const crPos = html.search(/currently[\s-]reading/i);
    for (const item of items) {
      if (item.url) {
        const itemPos = html.indexOf(item.url);
        if (itemPos > 0 && Math.abs(itemPos - crPos) < 2000) {
          item.section = "currently_reading";
        }
      }
    }
  }

  return items;
}

// ── Main parse function ──

export async function parse(url) {
  const metadata = {
    source: "goodreads",
    sourceType: "goodreads",
    resourceType: "profile",
    url,
    title: null,
    description: null,
    thumbnailUrl: null,
    providerName: "Goodreads",
  };

  let items = [];

  // ── Single book ──
  if (/goodreads\.com\/book\/show\//i.test(url)) {
    metadata.resourceType = "book";

    const { html } = await fetchHtml(url);
    if (!html) throw new Error(`Could not fetch Goodreads book page: ${url}`);

    metadata.title = extractMeta(html, "og:title");
    metadata.description = extractMeta(html, "og:description");
    metadata.thumbnailUrl = extractMeta(html, "og:image");

    const bookData = extractBookJsonLd(html);
    const genres = extractGenres(html);

    if (bookData) {
      metadata.title = metadata.title || bookData.title;
      const authorStr = bookData.authors.length > 0 ? bookData.authors[0] : null;

      items.push({
        position: 1,
        title: bookData.title || metadata.title,
        artist: authorStr,
        url,
        itemType: "book",
        duration: null,
        showName: null,
        description: [
          bookData.pages ? `${bookData.pages} pages` : null,
          genres.length > 0 ? genres.slice(0, 5).join(", ") : null,
          bookData.rating ? `${bookData.rating}/5 on Goodreads (${(bookData.ratingCount || 0).toLocaleString()} ratings)` : null,
          bookData.awards ? `Awards: ${bookData.awards.substring(0, 100)}` : null,
        ].filter(Boolean).join(" · "),
      });
    } else if (metadata.title) {
      items.push({
        position: 1,
        title: metadata.title,
        artist: null,
        url,
        itemType: "book",
        duration: null,
        showName: null,
        description: metadata.description,
      });
    }

    return { metadata, items };
  }

  // ── Author page ──
  if (/goodreads\.com\/author\//i.test(url)) {
    metadata.resourceType = "author";

    const { html } = await fetchHtml(url);
    if (!html) throw new Error(`Could not fetch Goodreads author page: ${url}`);

    metadata.title = extractMeta(html, "og:title");
    metadata.description = extractMeta(html, "og:description");
    metadata.thumbnailUrl = extractMeta(html, "og:image");

    // Try h1 for author name
    if (!metadata.title) {
      const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
      if (h1) metadata.title = decodeEntities(h1[1].trim());
    }

    items = extractAuthorBooks(html);

    items = items.map((t, i) => ({
      position: i + 1,
      title: t.title,
      artist: t.artist || null,
      url: t.url || null,
      itemType: "book",
      duration: null,
      showName: null,
      description: null,
    }));

    return { metadata, items };
  }

  // ── Community list ──
  if (/goodreads\.com\/list\//i.test(url)) {
    metadata.resourceType = "list";

    const { html } = await fetchHtml(url);
    if (!html) throw new Error(`Could not fetch Goodreads list: ${url}`);

    metadata.title = extractMeta(html, "og:title");
    metadata.description = extractMeta(html, "og:description");
    metadata.thumbnailUrl = extractMeta(html, "og:image");

    // Fallback title from <title> tag
    if (!metadata.title) {
      const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleTag) metadata.title = decodeEntities(titleTag[1].trim());
    }

    items = extractListBooks(html);

    items = items.map((t, i) => ({
      position: i + 1,
      title: t.title,
      artist: t.artist || null,
      url: t.url || null,
      itemType: "book",
      duration: null,
      showName: null,
      description: t.rating ? `${t.rating}/5 avg on Goodreads` : null,
    }));

    return { metadata, items };
  }

  // ── Shelf / review list (may redirect to sign_in) ──
  if (/goodreads\.com\/review\/list/i.test(url)) {
    metadata.resourceType = "shelf";

    const { html, finalUrl } = await fetchHtml(url);

    // Check if redirected to sign_in
    if (!html || /sign_in|sign-in/i.test(finalUrl)) {
      // Try to extract user ID and fall back to their profile
      const userMatch = url.match(/\/review\/list\/(\d+)/);
      if (userMatch) {
        const profileUrl = `https://www.goodreads.com/user/show/${userMatch[1]}`;
        const { html: profileHtml } = await fetchHtml(profileUrl);
        if (profileHtml) {
          metadata.url = profileUrl;
          metadata.resourceType = "profile";
          metadata.title = extractMeta(profileHtml, "og:title");
          metadata.description = extractMeta(profileHtml, "og:description");
          metadata.thumbnailUrl = extractMeta(profileHtml, "og:image");

          items = extractProfileBooks(profileHtml);
          items = items.map((t, i) => ({
            position: i + 1,
            title: t.title,
            artist: t.artist || null,
            url: t.url || null,
            itemType: "book",
            duration: null,
            showName: null,
            description: t.section === "currently_reading" ? "Currently reading" : null,
          }));

          return { metadata, items };
        }
      }

      // Complete fallback
      metadata.title = "Goodreads Shelf";
      metadata.description = "This shelf requires authentication to view.";
      return { metadata, items: [] };
    }

    // If we got HTML, extract books
    items = extractListBooks(html);
    items = items.map((t, i) => ({
      position: i + 1,
      title: t.title,
      artist: t.artist || null,
      url: t.url || null,
      itemType: "book",
      duration: null,
      showName: null,
      description: null,
    }));

    return { metadata, items };
  }

  // ── User profile ──
  metadata.resourceType = "profile";

  const { html } = await fetchHtml(url);
  if (!html) throw new Error(`Could not fetch Goodreads profile: ${url}`);

  metadata.title = extractMeta(html, "og:title");
  metadata.description = extractMeta(html, "og:description");
  metadata.thumbnailUrl = extractMeta(html, "og:image");

  // Fallback title
  if (!metadata.title) {
    const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleTag) metadata.title = decodeEntities(titleTag[1].trim());
  }

  items = extractProfileBooks(html);

  items = items.map((t, i) => ({
    position: i + 1,
    title: t.title,
    artist: t.artist || null,
    url: t.url || null,
    itemType: "book",
    duration: null,
    showName: null,
    description: t.section === "currently_reading" ? "Currently reading" : null,
  }));

  return { metadata, items };
}

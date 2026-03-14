// ── Generic Webpage Parser ──
// Fallback parser for any article, blog post, or website URL.
// Extracts main content text for Claude to analyze.
// Handles Pitchfork reviews, Substack posts, food blogs, listicles, etc.

export const name = "webpage";
export const sourceType = "webpage";

// No patterns — this parser is the fallback when no other parser matches.
// Registry handles the fallback logic.
export const patterns = [];

const NON_CONTENT_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|mp3|mp4|wav|pdf|zip|tar|gz|css|js|woff|woff2|ttf|eot)$/i;

export function classifyUrl(url) {
  try {
    const parsed = new URL(url);

    // Non-content file URLs
    if (NON_CONTENT_EXTENSIONS.test(parsed.pathname)) return "unknown";

    // Bare domains with no meaningful path
    const path = parsed.pathname.replace(/\/+$/, "");
    if (!path || path === "") return "unknown";

    return "profile";
  } catch {
    return "unknown";
  }
}

// ── Fetch ──

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
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) return null;
    return await res.text();
  } catch (err) {
    console.error("Webpage fetch error:", url, err);
    return null;
  }
}

// ── Metadata extraction ──

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
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractMetadata(html) {
  return {
    title: extractMeta(html, "og:title") || extractMeta(html, "twitter:title") || extractTitleTag(html),
    description: extractMeta(html, "og:description") || extractMeta(html, "description") || extractMeta(html, "twitter:description"),
    thumbnailUrl: extractMeta(html, "og:image") || extractMeta(html, "twitter:image"),
    author: extractMeta(html, "article:author") || extractMeta(html, "author"),
    publishedTime: extractMeta(html, "article:published_time") || extractMeta(html, "date"),
    siteName: extractMeta(html, "og:site_name"),
  };
}

function extractTitleTag(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? decodeEntities(match[1]).trim() : null;
}

// ── Content extraction ──

// Remove non-content elements from HTML before extracting text
function stripNonContent(html) {
  // Remove script, style, nav, header, footer, aside, form tags and their content
  let cleaned = html;
  const tagsToRemove = ["script", "style", "nav", "header", "footer", "aside", "form", "noscript", "iframe", "svg"];
  for (const tag of tagsToRemove) {
    cleaned = cleaned.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
  }
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  return cleaned;
}

// Extract text content from a chunk of HTML
function extractText(html) {
  const cleaned = stripNonContent(html);
  // Get paragraph text and heading text
  const blocks = [];

  // Extract headings
  const headings = cleaned.matchAll(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi);
  for (const m of headings) {
    const text = stripTags(m[1]).trim();
    if (text.length > 2) blocks.push(text);
  }

  // Extract paragraphs
  const paragraphs = cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const m of paragraphs) {
    const text = stripTags(m[1]).trim();
    if (text.length > 10) blocks.push(text);
  }

  // Extract list items (for listicles)
  const listItems = cleaned.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  for (const m of listItems) {
    const text = stripTags(m[1]).trim();
    if (text.length > 10) blocks.push(text);
  }

  return blocks;
}

// Strategy A: <article> tag
function extractFromArticle(html) {
  const match = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!match) return null;
  const blocks = extractText(match[1]);
  return blocks.length >= 2 ? blocks : null;
}

// Strategy B: <main> tag
function extractFromMain(html) {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) return null;
  const blocks = extractText(match[1]);
  return blocks.length >= 2 ? blocks : null;
}

// Strategy C: role="main" or id/class containing "content", "article", "post"
function extractFromContentDiv(html) {
  const contentPatterns = [
    /<div[^>]*(?:role="main"|id="content"|class="[^"]*(?:article|post|entry|story)[^"]*")[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|$)/i,
    /<div[^>]*(?:id="[^"]*(?:content|article|post|main)[^"]*"|class="[^"]*content[^"]*")[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|$)/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match) {
      const blocks = extractText(match[1]);
      if (blocks.length >= 2) return blocks;
    }
  }
  return null;
}

// Strategy D: all paragraph text from the page
function extractAllParagraphs(html) {
  const cleaned = stripNonContent(html);
  const blocks = [];
  const paragraphs = cleaned.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const m of paragraphs) {
    const text = stripTags(m[1]).trim();
    if (text.length > 20) blocks.push(text);
  }
  return blocks.length >= 2 ? blocks : null;
}

// ── List detection ──
// Try to detect if the page has a numbered/structured list of recommendations

function extractListItems(html) {
  const cleaned = stripNonContent(html);
  const items = [];

  // Look for ordered lists with substantial content
  const olMatches = cleaned.matchAll(/<ol[^>]*>([\s\S]*?)<\/ol>/gi);
  for (const ol of olMatches) {
    const liMatches = ol[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    for (const li of liMatches) {
      const text = stripTags(li[1]).trim();
      if (text.length > 15) items.push(text);
    }
  }
  if (items.length >= 3) return items;

  // Look for headings that seem like list items (h2/h3 with numbers or ranking patterns)
  const headingItems = [];
  const numberedHeadings = cleaned.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi);
  for (const m of numberedHeadings) {
    const text = stripTags(m[1]).trim();
    // Match patterns like "1. Album Name", "10: Restaurant", "#5 — Book Title"
    if (/^\s*(?:#?\d+[\s.):—\-]|•|–)/.test(text) && text.length > 5) {
      headingItems.push(text);
    }
  }
  if (headingItems.length >= 3) return headingItems;

  return null;
}

// ── JSON-LD extraction ──
// Some pages have structured data we can use

function extractFromJsonLd(html) {
  const metadata = {};
  const scriptMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scriptMatches) {
    try {
      let data = JSON.parse(match[1]);
      // Handle @graph arrays
      if (data["@graph"]) data = data["@graph"].find(d => d["@type"] === "Article" || d["@type"] === "Review" || d["@type"] === "BlogPosting" || d["@type"] === "NewsArticle") || data;

      if (["Article", "Review", "BlogPosting", "NewsArticle", "WebPage"].includes(data["@type"])) {
        metadata.title = metadata.title || data.headline || data.name;
        metadata.author = metadata.author || data.author?.name || (Array.isArray(data.author) ? data.author[0]?.name : null);
        metadata.description = metadata.description || data.description;
        metadata.publishedTime = metadata.publishedTime || data.datePublished;

        // Review-specific data
        if (data["@type"] === "Review" && data.itemReviewed) {
          metadata.reviewedItem = data.itemReviewed.name;
          metadata.reviewedItemType = data.itemReviewed["@type"];
          metadata.reviewRating = data.reviewRating?.ratingValue;
        }
      }
    } catch (err) {
      // JSON parse failed, skip
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}

// ── Main parse function ──

const MAX_CONTENT_LENGTH = 10000;

export async function parse(url) {
  const html = await fetchHtml(url);

  if (!html) {
    throw new Error(`Could not fetch page: ${url}`);
  }

  // Extract metadata from multiple sources
  const pageMeta = extractMetadata(html);
  const jsonLdMeta = extractFromJsonLd(html) || {};

  const metadata = {
    source: "webpage",
    sourceType: "webpage",
    resourceType: jsonLdMeta.reviewedItemType ? "review" : "article",
    url,
    title: pageMeta.title || jsonLdMeta.title || null,
    description: pageMeta.description || jsonLdMeta.description || null,
    thumbnailUrl: pageMeta.thumbnailUrl || null,
    providerName: pageMeta.siteName || new URL(url).hostname.replace(/^www\./, ""),
    author: pageMeta.author || jsonLdMeta.author || null,
    publishedTime: pageMeta.publishedTime || jsonLdMeta.publishedTime || null,
    reviewedItem: jsonLdMeta.reviewedItem || null,
    reviewRating: jsonLdMeta.reviewRating || null,
  };

  const items = [];

  // Check for list structure first
  const listItems = extractListItems(html);
  if (listItems && listItems.length >= 3) {
    // Page has a clear list of items — return each as a separate item
    for (let i = 0; i < listItems.length; i++) {
      items.push({
        position: i + 1,
        itemType: "list_item",
        text: listItems[i].slice(0, 500),
        title: null,
        artist: null,
        url: null,
        duration: null,
        showName: null,
        description: null,
      });
    }
  }

  // Extract main article content regardless (Claude needs context even for lists)
  const contentBlocks =
    extractFromArticle(html)
    || extractFromMain(html)
    || extractFromContentDiv(html)
    || extractAllParagraphs(html)
    || [];

  let fullText = contentBlocks.join("\n\n");

  // Truncate to limit
  if (fullText.length > MAX_CONTENT_LENGTH) {
    fullText = fullText.slice(0, MAX_CONTENT_LENGTH) + "\n[content truncated]";
  }

  if (fullText.length > 50) {
    items.push({
      position: items.length + 1,
      itemType: "article_content",
      text: fullText,
      title: metadata.title,
      artist: metadata.author,
      url,
      duration: null,
      showName: null,
      description: metadata.description,
    });
  }

  // If we got nothing at all, at least return the metadata
  if (items.length === 0 && metadata.title) {
    items.push({
      position: 1,
      itemType: "article_content",
      text: [metadata.title, metadata.description].filter(Boolean).join("\n\n"),
      title: metadata.title,
      artist: metadata.author,
      url,
      duration: null,
      showName: null,
      description: metadata.description,
    });
  }

  return { metadata, items };
}

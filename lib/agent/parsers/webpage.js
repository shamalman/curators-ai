// ── Generic Webpage Parser (defuddle) ──
// Fallback parser for any article, blog post, or website URL.
// Uses defuddle for clean content extraction (handles linkedom internally).

import { Defuddle } from 'defuddle/node';

export const name = "webpage";
export const sourceType = "webpage";

// No patterns — this parser is the fallback when no other parser matches.
export const patterns = [];

const NON_CONTENT_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|ico|mp3|mp4|wav|pdf|zip|tar|gz|css|js|woff|woff2|ttf|eot)$/i;

export function classifyUrl(url) {
  try {
    const parsed = new URL(url);
    if (NON_CONTENT_EXTENSIONS.test(parsed.pathname)) return "unknown";
    const path = parsed.pathname.replace(/\/+$/, "");
    if (!path || path === "") return "unknown";
    return "profile";
  } catch {
    return "unknown";
  }
}

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

function stripTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── List detection (kept from original — defuddle doesn't handle this) ──

function stripNonContent(html) {
  let cleaned = html;
  const tagsToRemove = ["script", "style", "nav", "header", "footer", "aside", "form", "noscript", "iframe", "svg"];
  for (const tag of tagsToRemove) {
    cleaned = cleaned.replace(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi"), "");
  }
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");
  return cleaned;
}

function extractListItems(html) {
  const cleaned = stripNonContent(html);
  const items = [];

  const olMatches = cleaned.matchAll(/<ol[^>]*>([\s\S]*?)<\/ol>/gi);
  for (const ol of olMatches) {
    const liMatches = ol[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);
    for (const li of liMatches) {
      const text = stripTags(li[1]).trim();
      if (text.length > 15) items.push(text);
    }
  }
  if (items.length >= 3) return items;

  const headingItems = [];
  const numberedHeadings = cleaned.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi);
  for (const m of numberedHeadings) {
    const text = stripTags(m[1]).trim();
    if (/^\s*(?:#?\d+[\s.):—\-]|•|–)/.test(text) && text.length > 5) {
      headingItems.push(text);
    }
  }
  if (headingItems.length >= 3) return headingItems;

  return null;
}

// ── Main parse function ──

const MAX_CONTENT_LENGTH = 20000;

export async function parse(url) {
  const html = await fetchHtml(url);

  if (!html) {
    throw new Error(`Could not fetch page: ${url}`);
  }

  // Pass HTML string directly — defuddle/node handles linkedom parsing
  // and applies necessary polyfills (getComputedStyle, styleSheets)
  let result;
  try {
    result = await Defuddle(html, url, { markdown: true });
  } catch (err) {
    console.error("Defuddle extraction error:", url, err);
    result = {};
  }

  const metadata = {
    source: "webpage",
    sourceType: "webpage",
    resourceType: result.schemaOrgData?.["@type"] === "Review" ? "review" : "article",
    url,
    title: result.title || null,
    description: result.description || null,
    thumbnailUrl: result.image || null,
    providerName: result.site || new URL(url).hostname.replace(/^www\./, ""),
    author: result.author || null,
    publishedTime: result.published || null,
    reviewedItem: result.schemaOrgData?.itemReviewed?.name || null,
    reviewRating: result.schemaOrgData?.reviewRating?.ratingValue || null,
  };

  const items = [];

  // Check for list structure first (from raw HTML, before defuddle cleanup)
  const listItems = extractListItems(html);
  if (listItems && listItems.length >= 3) {
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

  // Use defuddle's markdown content (or fall back to cleaned HTML content)
  let fullText = result.contentMarkdown || result.content || '';

  // Strip any remaining HTML tags if we got HTML content
  if (fullText.includes('<') && !result.contentMarkdown) {
    fullText = stripTags(fullText);
  }

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
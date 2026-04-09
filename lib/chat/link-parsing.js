import { detectSource, getParser } from "../agent/registry.js";

// ── Extract URLs from message text ──
export const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

// Safari strips https:// when copying from the address bar.
// Detect bare domain URLs and prepend https:// so URL_REGEX can find them.
const BARE_URL_REGEX = /(?:^|\s)((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|io|ai|co|me|fm|tv|app|dev|xyz|gg|so|to|cc|be|ly|link|club|page|site|world|pub|info|us|uk|ca|de|fr|es|it|nl|se|no|fi|dk|at|ch|au|nz|jp|kr|in|br|mx|ar|cl|za|ru|pl|cz|hu|ro|bg|hr|sk|si|ee|lt|lv|pt|gr|ie|is)\/.+?)(?=\s|$)/gi;

export function normalizeUrls(message) {
  if (!message) return message;
  return message.replace(BARE_URL_REGEX, (match, bareUrl, offset) => {
    // Don't double-prefix if already preceded by ://
    const before = message.substring(Math.max(0, offset - 8), offset);
    if (/https?:\/\/$/i.test(before.trim())) return match;
    return match.replace(bareUrl, `https://${bareUrl}`);
  });
}

export function sourceNameFromType(t) {
  const map = { spotify: "Spotify", apple_music: "Apple Music", google_maps: "Google Maps", youtube: "YouTube", letterboxd: "Letterboxd", goodreads: "Goodreads", soundcloud: "SoundCloud", twitter: "X (Twitter)", webpage: "Webpage" };
  return map[t] || t;
}

// ── Find most recent URL from chat history ──
export function findRecentUrl(history, currentMessage) {
  // Check current message first
  if (currentMessage) {
    const match = currentMessage.match(URL_REGEX);
    if (match) return { url: match[0] };
  }

  // Search backwards through history for the most recent user message with a URL
  if (history && Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'user' && msg.text) {
        const match = msg.text.match(URL_REGEX);
        if (match) return { url: match[0] };
      }
    }
  }

  return null;
}

// ── Detect taste read intent (for messages without a URL, referring to a previous link) ──
const TASTE_READ_INTENT = /^(do a )?taste read( on this)?$|^taste read$|^read (this|that|those|the link|it)$|^analyze (this|that|it)$|^dive into (this|that|it|those)$|^what do you think of (this|that)$|^check (this|that) out$|^look at (this|that)$/i;

export function isTasteReadIntent(message) {
  if (!message) return false;
  const trimmed = message.trim();
  return TASTE_READ_INTENT.test(trimmed);
}

// ── Parse content inline for taste read ──
const MAX_TASTE_READ_CONTENT = 100000; // ~33K tokens -- enough for long-form Substack gift guides
const PARSE_TIMEOUT_MS = 15000; // 15s timeout for parse

/**
 * Assess parse quality based on content length and metadata
 * @returns {'full' | 'partial' | 'failed'}
 */
function assessQuality(content, metadata, items) {
  const len = content?.length || 0;
  const itemCount = items?.length || 0;
  if (len === 0 && !metadata?.title) return 'failed';
  // Structured list content (playlists, tracklists): 5+ items is full coverage
  if (itemCount >= 5) return 'full';
  if (len > 2000) return 'full';
  if (len > 200) return 'partial';
  // Very short content but has a title -- partial at minimum
  if (metadata?.title) return 'partial';
  return 'failed';
}

export async function parseContentForTasteRead(url) {
  const detection = detectSource(url);
  if (!detection.supported || !detection.implemented) {
    return { error: `I can't read ${url} yet. That platform isn't supported.`, parserName: null, quality: 'failed', sourceType: detection.sourceType || null };
  }

  const parser = getParser(detection.parserName);
  if (!parser || !parser.parse) {
    return { error: `No parser available for ${detection.sourceType}.`, parserName: detection.parserName, quality: 'failed', sourceType: detection.sourceType };
  }

  try {
    const parseStart = Date.now();
    const result = await Promise.race([
      parser.parse(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Parser timeout -- site took too long to respond')), PARSE_TIMEOUT_MS))
    ]);
    const parseMs = Date.now() - parseStart;
    console.log(`[TASTE_READ_PARSE] url=${url} parser=${detection.parserName} duration_ms=${parseMs}`);

    const metadata = result.metadata || {};
    const items = result.items || [];

    // Build content string from parsed items
    let content = '';
    for (const item of items) {
      if (item.itemType === 'article_content' && item.text) {
        content += item.text + '\n\n';
      } else if (item.title) {
        // Structured items (tracks, episodes, list items) with title/artist/show
        let line = item.title;
        if (item.artist) line += ` - ${item.artist}`;
        if (item.showName) line += ` (${item.showName})`;
        if (item.description) line += `: ${item.description}`;
        content += `- ${line}\n`;
      } else if (item.text) {
        content += `- ${item.text}\n`;
      }
    }

    const wasTruncated = content.length > MAX_TASTE_READ_CONTENT;
    if (wasTruncated) {
      content = content.slice(0, MAX_TASTE_READ_CONTENT) + '\n[content truncated]';
    }

    let quality = assessQuality(content, metadata, items);
    // If we truncated full content, it's still full (we have enough)
    if (wasTruncated && quality === 'partial') quality = 'full';

    if (quality === 'failed') {
      return { error: `I couldn't extract any content from that link. Try pasting it again or send me a screenshot.`, parserName: detection.parserName, quality: 'failed', sourceType: detection.sourceType, parseTimeMs: parseMs };
    }

    return {
      content,
      metadata,
      parserName: detection.parserName,
      sourceType: detection.sourceType,
      quality,
      parseTimeMs: parseMs,
      error: null,
    };
  } catch (err) {
    console.error('Inline taste read parse error:', url, err.message);
    return { error: err.message, parserName: detection.parserName, quality: 'failed', sourceType: detection.sourceType };
  }
}

// ── Build agent notes for system prompt injection ──
export function buildAgentUrlNotes(agentNotes) {
  if (!agentNotes || agentNotes.length === 0) return "";

  const lines = [];
  for (const note of agentNotes) {
    if (note.type === "link_parsed") {
      lines.push(`URL DETECTED: ${note.url} -- The content from this link has been parsed and is available in your context above. Engage with it naturally. Do NOT say you can't read it.`);
    } else if (note.type === "link_parse_failed") {
      lines.push(`URL DETECTED: ${note.url} -- I tried to read this link but couldn't access the content: ${note.error}. Be honest about this and suggest alternatives (paste again, send a screenshot, tell you about it).`);
    } else if (note.type === "coming_soon") {
      lines.push(`URL DETECTED: ${note.url} -- This is a ${note.sourceType} link. I can't read this platform yet, but it's on my list. Be honest about it.`);
    } else if (note.type === "unsupported") {
      lines.push(`URL DETECTED: ${note.url} -- I don't support this platform yet. Be honest. Ask them to tell you their favorites from there instead.`);
    }
  }

  return lines.length > 0 ? `\nURLs IN THIS MESSAGE:\n${lines.join("\n")}\n` : "";
}

/**
 * Distill a previously-parsed link block down to a bounded summary for
 * re-injection into follow-up turns of the same conversation.
 *
 * The full parsed content (up to 100K chars) already landed in the system
 * prompt on the turn when the URL was pasted. On follow-up turns we don't
 * need to replay the whole article -- we just need enough context for Claude
 * to remember what was being discussed and respond coherently.
 *
 * Hard cap: ~800 chars total output. This keeps re-injection bounded no
 * matter how big the original article was, eliminating the context bloat
 * and needle-in-haystack failures that caused Claude to hallucinate on
 * long follow-up conversations.
 *
 * @param {Object} block - A parsed_content block as stored in chat_messages:
 *   { url, content, metadata, quality, sourceType }
 * @returns {string} The distilled block as a ready-to-concatenate string,
 *   or '' if the block is unusable.
 */
export function distillForReinjection(block) {
  if (!block || !block.url) return '';
  if (block.quality !== 'full' && block.quality !== 'partial') return '';

  const title = block.metadata?.title || '';
  const author = block.metadata?.author || '';
  const providerName = block.metadata?.providerName || '';
  const content = block.content || '';

  // Take the first ~1200 chars of content as an opening snippet. Trim at a
  // word boundary to avoid chopping mid-word. This is a reminder of what
  // the article opened with, not a substitute for the full content.
  // Claude's own earlier responses in the conversation history contain
  // the actual substance of what was discussed -- the snippet is a nudge,
  // not the source of truth.
  const PREVIEW_MAX = 1200;
  let snippet = '';
  if (content.length > 0) {
    if (content.length <= PREVIEW_MAX) {
      snippet = content;
    } else {
      const sliced = content.slice(0, PREVIEW_MAX);
      const lastSpace = sliced.lastIndexOf(' ');
      snippet = lastSpace > PREVIEW_MAX * 0.8
        ? sliced.slice(0, lastSpace)
        : sliced;
      snippet += '…';
    }
  }

  // Frame this as CONVERSATION MEMORY, not a compressed re-share.
  // The previous framing ("compressed reference") was being misread by
  // Claude as "a new share attempt that failed to parse fully", causing
  // it to apologize and ask the curator to re-paste the section.
  //
  // The actual intent: Claude ALREADY read this article earlier in the
  // conversation. Its own earlier responses contain the real recall.
  // This block is just a reminder that the discussion happened, plus
  // an opening snippet to jog the memory.
  const parts = [];
  parts.push(`\n\n=== CONVERSATION MEMORY: EARLIER ARTICLE DISCUSSION (${block.url}) ===`);
  parts.push('You ALREADY read this article earlier in this conversation and discussed it with the curator. What follows is a brief reminder so you can continue the discussion coherently.');
  parts.push('');
  parts.push('IMPORTANT INSTRUCTIONS FOR USING THIS MEMORY:');
  parts.push('- You have ALREADY READ and DISCUSSED this article. Your own earlier responses in this conversation history reflect what you know about it — consult them first when the curator asks follow-up questions.');
  parts.push('- The snippet below is an opening fragment to jog your memory, NOT the full article. Do not treat it as the complete content.');
  parts.push('- DO NOT say things like "I wasn\'t able to read it this time" or "you shared it again" or "can you paste the section". The curator did NOT re-share the article — this memory block is automatic and internal.');
  parts.push('- If the curator asks about a specific detail that is not in your earlier responses or in the snippet below, say so directly ("I don\'t recall that specific detail — I\'d need to re-read the article to answer accurately"). Do not guess or confabulate.');
  parts.push('');
  if (title) parts.push(`Title: ${title}`);
  if (author) parts.push(`Author: ${author}`);
  if (providerName) parts.push(`Source: ${providerName}`);
  if (snippet) {
    parts.push('');
    parts.push(`Opening snippet (first ~1200 chars of the article, for memory reinforcement only):`);
    parts.push(snippet);
  }
  parts.push('=== END CONVERSATION MEMORY ===');

  return parts.join('\n');
}

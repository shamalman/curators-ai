// ── Source Parser Registry ──
// Central registry for all source parsers. Adding a new source = one file + one import.

import * as spotify from "./parsers/spotify.js";
import * as appleMusic from "./parsers/apple-music.js";
import * as googleMaps from "./parsers/google-maps.js";
import * as youtube from "./parsers/youtube.js";
import * as webpage from "./parsers/webpage.js";

const parsers = [spotify, appleMusic, googleMaps, youtube];

// Check if a parser's parse() is a real implementation or a stub
function isImplemented(parser) {
  try {
    // Stubs throw errors with "not yet implemented" — we can't call parse() to check,
    // so we check if the parser file has items beyond the stub signature.
    // Instead, maintain a simple set of implemented parsers.
    return implementedParsers.has(parser.name);
  } catch (err) {
    return false;
  }
}

const implementedParsers = new Set(["spotify", "apple-music", "youtube", "google-maps", "webpage"]);

/**
 * Detect source from URL — returns match info or unsupported
 * Falls back to the generic webpage parser for any http/https URL
 * @param {string} url
 * @returns {{ supported: boolean, sourceType?: string, classification?: string, parserName?: string, implemented?: boolean }}
 */
export function detectSource(url) {
  if (!url || typeof url !== "string") {
    return { supported: false };
  }

  // Check specific parsers first
  for (const parser of parsers) {
    const matched = parser.patterns.some((re) => re.test(url));
    if (matched) {
      return {
        supported: true,
        sourceType: parser.sourceType,
        classification: parser.classifyUrl(url),
        parserName: parser.name,
        implemented: implementedParsers.has(parser.name),
      };
    }
  }

  // Fallback: any http/https URL → generic webpage parser
  if (/^https?:\/\//i.test(url)) {
    const classification = webpage.classifyUrl(url);
    if (classification === "unknown") {
      return { supported: false };
    }
    return {
      supported: true,
      sourceType: webpage.sourceType,
      classification,
      parserName: webpage.name,
      implemented: true,
    };
  }

  return { supported: false };
}

/**
 * Get a parser by name
 * @param {string} name
 * @returns {object|null}
 */
export function getParser(name) {
  if (name === "webpage") return webpage;
  return parsers.find((p) => p.name === name) || null;
}

// ── Source Parser Registry ──
// Central registry for all source parsers. Adding a new source = one file + one import.

import * as spotify from "./parsers/spotify.js";
import * as appleMusic from "./parsers/apple-music.js";
import * as googleMaps from "./parsers/google-maps.js";

const parsers = [spotify, appleMusic, googleMaps];

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

const implementedParsers = new Set(["spotify", "apple-music"]);

/**
 * Detect source from URL — returns match info or unsupported
 * @param {string} url
 * @returns {{ supported: boolean, sourceType?: string, classification?: string, parserName?: string, implemented?: boolean }}
 */
export function detectSource(url) {
  if (!url || typeof url !== "string") {
    return { supported: false };
  }

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

  return { supported: false };
}

/**
 * Get a parser by name
 * @param {string} name
 * @returns {object|null}
 */
export function getParser(name) {
  return parsers.find((p) => p.name === name) || null;
}

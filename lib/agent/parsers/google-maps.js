// ── Google Maps Source Parser (Stub) ──
// URL detection and classification work, parsing not yet implemented

export const name = "google-maps";
export const sourceType = "google_maps";

export const patterns = [
  /^https?:\/\/(www\.)?google\.[a-z.]+\/maps\//i,
  /^https?:\/\/maps\.google\.[a-z.]+\//i,
  /^https?:\/\/goo\.gl\/maps\//i,
  /^https?:\/\/maps\.app\.goo\.gl\//i,
];

export function classifyUrl(url) {
  // Contributed reviews / saved lists = profile analysis
  if (/\/contrib\//i.test(url)) return "profile";
  if (/\/lists\//i.test(url)) return "profile";
  if (/\/@/i.test(url)) return "profile";
  // Single place = single item
  if (/\/place\//i.test(url)) return "single_item";
  return "profile";
}

export async function parse(url) {
  throw new Error("Google Maps parser is not yet implemented. Coming soon.");
}

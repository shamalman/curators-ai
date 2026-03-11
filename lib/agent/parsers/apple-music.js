// ── Apple Music Source Parser (Stub) ──
// URL detection and classification work, parsing not yet implemented

export const name = "apple-music";
export const sourceType = "apple_music";

export const patterns = [
  /^https?:\/\/music\.apple\.com\//i,
];

export function classifyUrl(url) {
  if (/\/playlist\//i.test(url)) return "profile";
  if (/\/artist\//i.test(url)) return "profile";
  if (/\/album\//i.test(url)) return "single_item";
  if (/\/song\//i.test(url)) return "single_item";
  return "profile";
}

export async function parse(url) {
  throw new Error("Apple Music parser is not yet implemented. Coming soon.");
}

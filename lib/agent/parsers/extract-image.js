/**
 * Given a parsedPayload (the envelope passed from parse-link / paste / upload
 * through addRec into buildRecFileRow), return the best available image URL.
 *
 * All parsers normalize their native image field to metadata.thumbnailUrl;
 * the envelope constructors (parse-link, paste, upload, QCS, CuratorContext
 * re-parse, ChatView chat-parse) lift that value onto parsedPayload.image_url.
 * Upload mode writes `artifact://<sha256>` so the rec's artifact itself is the
 * durable image pointer.
 *
 * Null-safe. Returns null, never throws.
 *
 * @param {object | null | undefined} parsedPayload
 * @returns {string | null}
 */
export function extractImageUrl(parsedPayload) {
  if (!parsedPayload || typeof parsedPayload !== 'object') return null;
  const url = parsedPayload.image_url;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

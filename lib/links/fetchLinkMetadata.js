/**
 * Fetch link metadata via the rich parse-link route.
 * Returns { title, type, url } — the normalized shape all callers need.
 * `type` is derived from provider/site_name, lowercased, defaulting to "website".
 */
export async function fetchLinkMetadata(url, profileId = null) {
  const res = await fetch("/api/recs/parse-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, profileId }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!data || !data.title) return null;

  const rawType = data.provider || data.site_name || "website";
  const type = rawType.toLowerCase();

  return {
    url: data.canonical_url || url,
    title: data.title,
    type,
  };
}

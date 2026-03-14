// ── Twitter/X Source Parser ──
// Handles x.com and twitter.com URLs — profiles, tweets, likes
//
// Reliability strategy (discovered via diagnostics 2026-03):
// - Direct x.com/twitter.com pages are 100% JS-rendered — login wall, zero content server-side
// - NO og: tags, NO JSON-LD, NO useful HTML on direct page fetches
//
// What actually works:
// - Syndication endpoint: syndication.twitter.com/srv/timeline-profile/screen-name/{username}
//   Returns pure JSON with ~16 recent tweets: full_text, user data, entities.urls (expanded),
//   media (photos), engagement metrics (favorites, retweets, replies, quotes)
//   Path: props.pageProps.timeline.entries[].content.tweet
// - oEmbed: publish.twitter.com/oembed?url={tweet_url}
//   Works for individual tweets — returns author_name, HTML blockquote with tweet text
//   Does NOT work for profiles
// - Card binding_values in syndication response has link preview data (title, description, image)
//
// Strategy: syndication (profiles/tweets) + oEmbed (single tweet fallback)

export const name = "twitter";
export const sourceType = "twitter";

export const patterns = [
  /^https?:\/\/(www\.)?(x|twitter)\.com\//i,
];

export function classifyUrl(url) {
  // Single tweet
  if (/(x|twitter)\.com\/[^/]+\/status\/\d+/i.test(url)) return "single_item";
  // Likes, lists
  if (/(x|twitter)\.com\/[^/]+\/likes/i.test(url)) return "profile";
  if (/(x|twitter)\.com\/[^/]+\/lists/i.test(url)) return "profile";
  // Profile
  return "profile";
}

// ── URL helpers ──

function extractUsername(url) {
  const match = url.match(/(x|twitter)\.com\/([^/?#]+)/i);
  if (!match) return null;
  const username = match[2];
  // Filter out non-profile paths
  if (["home", "explore", "search", "notifications", "messages", "settings", "i", "compose"].includes(username.toLowerCase())) {
    return null;
  }
  return username;
}

function extractTweetId(url) {
  const match = url.match(/\/status\/(\d+)/);
  return match ? match[1] : null;
}

function normalizeUrl(url) {
  // Normalize twitter.com → x.com
  return url.replace(/twitter\.com/i, "x.com");
}

// ── Fetch helpers ──

async function fetchSyndicationTimeline(username) {
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${username}`,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Twitter syndication fetch error:", err);
    return null;
  }
}

async function fetchOEmbed(tweetUrl) {
  try {
    // oEmbed uses twitter.com domain in URLs
    const normalizedUrl = tweetUrl.replace(/x\.com/i, "twitter.com");
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(normalizedUrl)}`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Twitter oEmbed error:", err);
    return null;
  }
}

// ── Data extraction ──

function extractTweetsFromSyndication(data) {
  try {
    const entries = data?.props?.pageProps?.timeline?.entries;
    if (!Array.isArray(entries)) return { tweets: [], user: null };

    let user = null;
    const tweets = [];

    for (const entry of entries) {
      if (entry.type !== "tweet") continue;
      const tweet = entry.content?.tweet;
      if (!tweet?.full_text) continue;

      // Capture user from first tweet
      if (!user && tweet.user) {
        user = {
          name: tweet.user.name || null,
          screenName: tweet.user.screen_name || null,
          description: tweet.user.description || null,
          followersCount: tweet.user.followers_count || null,
          friendsCount: tweet.user.friends_count || null,
          statusesCount: tweet.user.statuses_count || null,
          profileImageUrl: tweet.user.profile_image_url_https || null,
          profileBannerUrl: tweet.user.profile_banner_url || null,
          verified: tweet.user.is_blue_verified || tweet.user.verified || false,
          verifiedType: tweet.user.verified_type || null,
          location: tweet.user.location || null,
        };
      }

      // Expand t.co URLs in tweet text
      let text = tweet.full_text || tweet.text || "";
      const urls = tweet.entities?.urls || [];
      for (const u of urls) {
        if (u.url && u.expanded_url) {
          text = text.replace(u.url, u.expanded_url);
        }
      }
      // Remove pic.twitter.com/pic.x.com media URLs from text
      text = text.replace(/https?:\/\/pic\.(twitter|x)\.com\/\S+/g, "").trim();

      // Extract expanded URLs
      const expandedUrls = urls
        .filter(u => u.expanded_url && !u.expanded_url.includes("twitter.com") && !u.expanded_url.includes("x.com"))
        .map(u => u.expanded_url);

      // Extract media
      const media = (tweet.extended_entities?.media || tweet.entities?.media || []).map(m => ({
        type: m.type,
        url: m.media_url_https || null,
      }));

      // Extract card data (link previews)
      let cardTitle = null;
      let cardDescription = null;
      if (tweet.card?.binding_values) {
        const bv = tweet.card.binding_values;
        cardTitle = bv.title?.string_value || null;
        cardDescription = bv.description?.string_value || null;
      }

      tweets.push({
        id: tweet.id_str,
        text,
        createdAt: tweet.created_at || null,
        favoriteCount: tweet.favorite_count || 0,
        retweetCount: tweet.retweet_count || 0,
        replyCount: tweet.reply_count || 0,
        quoteCount: tweet.quote_count || 0,
        expandedUrls,
        media,
        cardTitle,
        cardDescription,
        permalink: tweet.permalink || null,
      });
    }

    return { tweets, user };
  } catch (err) {
    console.error("Twitter syndication parse error:", err);
    return { tweets: [], user: null };
  }
}

function extractTweetTextFromOEmbed(oembed) {
  if (!oembed?.html) return null;
  // Extract text from <p> in the blockquote
  const pMatch = oembed.html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!pMatch) return null;
  // Strip HTML tags, decode entities
  let text = pMatch[1]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .trim();
  return text;
}

// ── Main parse function ──

export async function parse(url) {
  const normalizedUrl = normalizeUrl(url);
  const username = extractUsername(normalizedUrl);
  const tweetId = extractTweetId(normalizedUrl);

  const metadata = {
    source: "twitter",
    sourceType: "twitter",
    resourceType: tweetId ? "tweet" : "profile",
    url: normalizedUrl,
    title: null,
    description: null,
    thumbnailUrl: null,
    providerName: "X (Twitter)",
  };

  let items = [];

  // ── Single tweet ──
  if (tweetId && username) {
    metadata.resourceType = "tweet";

    // Try syndication first (has richer data than oEmbed)
    const syndicationData = await fetchSyndicationTimeline(username);
    if (syndicationData) {
      const { tweets, user } = extractTweetsFromSyndication(syndicationData);

      // Find the specific tweet
      const tweet = tweets.find(t => t.id === tweetId);
      if (tweet) {
        metadata.title = user ? `@${user.screenName}` : `@${username}`;
        metadata.thumbnailUrl = user?.profileImageUrl || null;

        const description = [
          tweet.favoriteCount ? `${tweet.favoriteCount.toLocaleString()} likes` : null,
          tweet.retweetCount ? `${tweet.retweetCount.toLocaleString()} retweets` : null,
        ].filter(Boolean).join(" · ");

        items.push({
          position: 1,
          title: tweet.cardTitle || tweet.text.slice(0, 100),
          artist: user?.name || username,
          url: `https://x.com/${username}/status/${tweetId}`,
          itemType: "tweet",
          duration: null,
          showName: null,
          description: [
            tweet.text,
            tweet.cardDescription || null,
            description || null,
          ].filter(Boolean).join("\n\n"),
          expandedUrls: tweet.expandedUrls,
        });

        return { metadata, items };
      }
    }

    // Fallback: oEmbed
    const oembed = await fetchOEmbed(normalizedUrl);
    if (oembed) {
      metadata.title = `@${oembed.author_name || username}`;
      const tweetText = extractTweetTextFromOEmbed(oembed);

      items.push({
        position: 1,
        title: tweetText ? tweetText.slice(0, 100) : `Tweet by @${oembed.author_name || username}`,
        artist: oembed.author_name || username,
        url: normalizedUrl,
        itemType: "tweet",
        duration: null,
        showName: null,
        description: tweetText || null,
      });

      return { metadata, items };
    }

    // Complete fallback — no data available
    metadata.title = `Tweet by @${username}`;
    metadata.description = "Could not fetch tweet data — X requires authentication for most content.";
    return { metadata, items };
  }

  // ── Profile ──
  if (username) {
    metadata.resourceType = "profile";

    const syndicationData = await fetchSyndicationTimeline(username);
    if (syndicationData) {
      const { tweets, user } = extractTweetsFromSyndication(syndicationData);

      if (user) {
        metadata.title = `${user.name} (@${user.screenName})`;
        metadata.description = user.description || null;
        metadata.thumbnailUrl = user.profileImageUrl || null;
      } else {
        metadata.title = `@${username}`;
      }

      // Convert tweets to items
      for (let i = 0; i < tweets.length; i++) {
        const tweet = tweets[i];

        items.push({
          position: i + 1,
          title: tweet.cardTitle || tweet.text.slice(0, 100),
          artist: user?.name || username,
          url: tweet.permalink
            ? `https://x.com${tweet.permalink}`
            : `https://x.com/${username}/status/${tweet.id}`,
          itemType: "tweet",
          duration: null,
          showName: null,
          description: [
            tweet.text,
            tweet.cardDescription || null,
            tweet.expandedUrls.length > 0 ? `Links: ${tweet.expandedUrls.join(", ")}` : null,
          ].filter(Boolean).join("\n\n"),
        });
      }

      // Add profile context to metadata
      if (user) {
        const profileInfo = [
          user.location || null,
          user.followersCount ? `${user.followersCount.toLocaleString()} followers` : null,
          user.statusesCount ? `${user.statusesCount.toLocaleString()} tweets` : null,
          user.verified ? `Verified (${user.verifiedType || "blue"})` : null,
        ].filter(Boolean).join(" · ");
        if (profileInfo) {
          metadata.description = (metadata.description || "") +
            (metadata.description ? "\n" : "") + profileInfo;
        }
      }

      return { metadata, items };
    }

    // Syndication failed — try oEmbed as last resort (limited for profiles)
    metadata.title = `@${username}`;
    metadata.description = "Profile data unavailable — X blocks server-side access. Recent tweets could not be loaded.";
    return { metadata, items };
  }

  // No username extracted
  metadata.title = "X (Twitter)";
  metadata.description = "Could not parse this X URL.";
  return { metadata, items };
}

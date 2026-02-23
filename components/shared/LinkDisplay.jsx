'use client'

import { T, F } from "@/lib/constants";

export default function LinkDisplay({ links }) {
  if (!links || links.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {links.map((link, i) => {
        const isSpotify = link.url?.includes("spotify.com");
        const isYouTube = link.url?.includes("youtube.com") || link.url?.includes("youtu.be");
        const isWikipedia = link.url?.includes("wikipedia.org");
        const isGoogleMaps = link.url?.includes("google.com/maps") || link.url?.includes("goo.gl/maps");
        const isAppleMusic = link.url?.includes("music.apple.com");
        const isSoundCloud = link.url?.includes("soundcloud.com");

        const iconStyle = { width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
        const icon = isSpotify ? (
          <div style={{ ...iconStyle, background: "#1DB954" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          </div>
        ) : isYouTube ? (
          <div style={{ ...iconStyle, background: "#FF0000" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </div>
        ) : isWikipedia ? (
          <div style={{ ...iconStyle, background: "#fff", border: "1px solid " + T.bdr }}>
            <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "serif" }}>W</span>
          </div>
        ) : isGoogleMaps ? (
          <div style={{ ...iconStyle, background: "#4285F4" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          </div>
        ) : isAppleMusic ? (
          <div style={{ ...iconStyle, background: "linear-gradient(135deg, #FA2D48, #A833B9)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.801.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03a12.5 12.5 0 001.57-.1c.822-.106 1.596-.35 2.295-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.455-2.105-1.392-.238-.693-.106-1.384.428-1.945.37-.39.833-.6 1.35-.7.351-.067.709-.103 1.063-.163.238-.04.388-.186.397-.437.003-.063.003-.125.003-.19V9.357a.472.472 0 00-.49-.503c-.67-.032-1.34-.062-2.007-.105a41.27 41.27 0 01-1.433-.123.46.46 0 00-.52.467V17.77c0 .41-.057.815-.242 1.188-.29.583-.76.955-1.38 1.128-.86.238-1.7.116-2.447-.474-.476-.376-.715-.873-.764-1.467-.052-.627.12-1.19.55-1.66.355-.39.8-.6 1.31-.7.512-.098 1.03-.16 1.546-.242.26-.04.397-.194.405-.457.002-.068 0-.136 0-.204V6.946c0-.083.007-.167.017-.25.043-.354.255-.57.607-.615.21-.027.424-.04.635-.054.946-.06 1.893-.105 2.838-.17 1.042-.07 2.082-.16 3.124-.234.17-.012.342-.016.51.006.347.046.563.263.607.61.02.158.024.318.024.477v3.35z"/></svg>
          </div>
        ) : isSoundCloud ? (
          <div style={{ ...iconStyle, background: "#FF5500" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.052-.1-.084-.1zm-.899 1.18c-.048 0-.091.037-.098.094l-.18 1.072.18 1.048c.007.057.05.092.098.092.046 0 .087-.035.094-.092l.21-1.048-.21-1.072c-.007-.057-.048-.094-.094-.094zm1.83-.091c-.06 0-.109.053-.116.112l-.216 1.266.216 1.225c.007.063.056.113.116.113.06 0 .107-.05.116-.113l.246-1.225-.246-1.266c-.009-.063-.056-.112-.116-.112zm.93-.478c-.066 0-.119.059-.127.126l-.195 1.741.195 1.64c.008.066.061.122.127.122.066 0 .119-.056.127-.122l.225-1.64-.225-1.741c-.008-.067-.061-.126-.127-.126z"/></svg>
          </div>
        ) : (
          <div style={{ ...iconStyle, background: T.s2 }}>
            <span style={{ fontSize: 14 }}>{"🔗"}</span>
          </div>
        );

        const sourceName = isSpotify ? "Spotify" : isYouTube ? "YouTube" : isWikipedia ? "Wikipedia" : isGoogleMaps ? "Google Maps" : isAppleMusic ? "Apple Music" : isSoundCloud ? "SoundCloud" : (() => { try { return link.url ? new URL(link.url).hostname.replace("www.", "").split(".")[0].charAt(0).toUpperCase() + new URL(link.url).hostname.replace("www.", "").split(".")[0].slice(1) : "Link"; } catch(e) { return "Link"; } })();

        return (
          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px", background: T.s, borderRadius: 12, border: "1px solid " + T.bdr,
            textDecoration: "none", color: T.ink, transition: "background .15s"
          }}>
            {icon}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F, fontSize: 13, fontWeight: 600 }}>{link.label || (link.title !== "Suggested link" ? link.title : null) || sourceName}</div>
              <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 2 }}>{(() => { try { return link.url ? new URL(link.url).hostname.replace("www.", "") : sourceName; } catch(e) { return sourceName; } })()}</div>
            </div>
            <span style={{ fontSize: 12, color: T.ink3 }}>{"↗"}</span>
          </a>
        );
      })}
    </div>
  );
}

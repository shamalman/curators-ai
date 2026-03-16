'use client'

import { T, F } from "@/lib/constants";

const PROVIDER_COLORS = {
  Spotify: "#1DB954",
  "Apple Music": "#FA2D48",
  YouTube: "#FF0000",
  "Google Maps": "#4285F4",
  Letterboxd: "#00E054",
  Goodreads: "#553B08",
  SoundCloud: "#FF5500",
  generic: T.acc,
};

const PROVIDER_ICONS = {
  Spotify: "\u266B",
  "Apple Music": "\u266A",
  YouTube: "\u25B6",
  "Google Maps": "\u25CE",
  Letterboxd: "\u25D1",
  Goodreads: "G",
  SoundCloud: "\u25C9",
  generic: "\uD83D\uDD17",
};

export default function FeedMediaEmbed({ data }) {
  if (!data?.url) return null;
  const color = PROVIDER_COLORS[data.provider] || PROVIDER_COLORS.generic;
  const icon = PROVIDER_ICONS[data.provider] || PROVIDER_ICONS.generic;

  return (
    <div
      onClick={() => window.open(data.url, '_blank')}
      style={{
        borderRadius: 14,
        background: T.s,
        border: `1px solid ${T.bdr}`,
        overflow: "hidden",
        cursor: "pointer",
        marginBottom: 4,
      }}
    >
      {data.has_embed && (
        <div style={{
          height: 88,
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            background: `${color}20`, border: `1.5px solid ${color}40`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 16, color }}>{"\u25B6"}</span>
          </div>
          <span style={{ fontFamily: F, fontSize: 13, fontWeight: 600, color }}>
            Play on {data.provider}
          </span>
        </div>
      )}
      <div style={{
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${color}15`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, color }}>{icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {data.title || data.url}
          </div>
          {(data.author || data.description) && (
            <div style={{
              fontFamily: F, fontSize: 12, color: T.ink3, marginTop: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {data.author || data.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

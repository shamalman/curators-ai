'use client'

import Link from "next/link";
import { T, W, V, F, S, MN } from "@/lib/constants";

const linkStyle = {
  color: T.acc, textDecoration: "underline",
  textUnderlineOffset: 2, cursor: "pointer",
};

// Parse markdown links [text](url) into React elements
const parseLinks = (text) => {
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (!match) return part;
    const [, label, href] = match;
    if (href.startsWith("/")) {
      return <Link key={i} href={href} style={linkStyle}>{label}</Link>;
    }
    return <a key={i} href={href} target="_blank" rel="noopener noreferrer" style={linkStyle}>{label}</a>;
  });
};

const renderMd = (text) => text.split("\n").map((line, i) => {
  // Bold + links
  const b = line.replace(/\*\*(.*?)\*\*/g, '<b_mark>$1</b_mark>');
  const segments = b.split(/(<b_mark>.*?<\/b_mark>)/g);
  const content = segments.map((seg, j) => {
    const boldMatch = seg.match(/^<b_mark>(.*?)<\/b_mark>$/);
    if (boldMatch) return <strong key={j}>{parseLinks(boldMatch[1])}</strong>;
    return <span key={j}>{parseLinks(seg)}</span>;
  });
  return <div key={i} style={{ marginBottom: line === "" ? 8 : 2 }}>{content}</div>;
});

export default function MessageBubble({ msg, variant, profileInitial }) {
  const isCurator = variant === "curator";

  const bubbleStyle = isCurator ? {
    maxWidth: "82%", padding: msg.role === "user" ? "12px 16px" : "14px 18px",
    borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
    background: msg.role === "user" ? W.userBub : W.aiBub,
    color: msg.role === "user" ? W.userTxt : T.ink,
    fontSize: 14, lineHeight: 1.55, fontFamily: F,
    fontWeight: msg.role === "user" ? 500 : 400,
    border: msg.role === "user" ? "none" : `1px solid ${W.bdr}`,
  } : {
    maxWidth: "82%", padding: msg.role === "user" ? "12px 16px" : "14px 18px",
    borderRadius: msg.role === "user" ? "20px 20px 6px 20px" : "20px 20px 20px 6px",
    background: msg.role === "user" ? V.userBub : V.aiBub,
    color: msg.role === "user" ? V.userTxt : T.ink,
    fontSize: 14, lineHeight: 1.55, fontFamily: F,
    fontWeight: msg.role === "user" ? 500 : 400,
    border: "none",
    boxShadow: msg.role === "user" ? "none" : `inset 0 0 0 1px ${V.bdr}`,
  };

  const avatar = isCurator ? (
    <div style={{ width: 24, height: 24, borderRadius: 7, background: W.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, flexShrink: 0, border: `1px solid ${W.accent}25` }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: W.accent, fontFamily: F }}>C</span>
    </div>
  ) : (
    <div style={{ width: 26, height: 26, borderRadius: 9, background: `linear-gradient(145deg, ${T.s2}, ${T.s})`, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, marginTop: 2, flexShrink: 0 }}>
      <span style={{ fontFamily: S, fontSize: 13, color: T.acc, fontWeight: 400 }}>{profileInitial}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: isCurator ? 12 : 14 }}>
      {msg.role === "ai" && avatar}
      <div style={{ maxWidth: "82%" }}>
        <div style={bubbleStyle}>{msg.role === "ai" ? renderMd(msg.text) : msg.text}</div>
      </div>
    </div>
  );
}

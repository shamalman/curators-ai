'use client'

import Link from "next/link";
import { T, W, F } from "@/lib/constants";

const linkStyle = {
  color: T.acc, textDecoration: "underline",
  textUnderlineOffset: 2, cursor: "pointer",
};

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
  const b = line.replace(/\*\*(.*?)\*\*/g, '<b_mark>$1</b_mark>');
  const segments = b.split(/(<b_mark>.*?<\/b_mark>)/g);
  const content = segments.map((seg, j) => {
    const boldMatch = seg.match(/^<b_mark>(.*?)<\/b_mark>$/);
    if (boldMatch) return <strong key={j}>{parseLinks(boldMatch[1])}</strong>;
    return <span key={j}>{parseLinks(seg)}</span>;
  });
  return <div key={i} style={{ marginBottom: line === "" ? 8 : 2 }}>{content}</div>;
});

export default function FeedLegacyBubble({ text, imagePreview }) {
  if (!text) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        background: W.accentSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginRight: 8, marginTop: 2, flexShrink: 0,
        border: `1px solid ${W.accent}25`,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: W.accent, fontFamily: F }}>C</span>
      </div>
      <div style={{ maxWidth: "82%", minWidth: 0 }}>
        <div style={{
          padding: "14px 18px",
          borderRadius: "20px 20px 20px 6px",
          background: W.aiBub,
          color: T.ink,
          fontSize: 14,
          lineHeight: 1.55,
          fontFamily: F,
          fontWeight: 400,
          border: `1px solid ${W.bdr}`,
          overflowWrap: "break-word",
          wordBreak: "break-word",
        }}>
          {imagePreview && (
            <img src={imagePreview} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 12, marginBottom: text ? 8 : 0, display: "block" }} />
          )}
          {renderMd(text)}
        </div>
      </div>
    </div>
  );
}

'use client'

import Link from "next/link";
import { T, F } from "@/lib/constants";

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

export default function FeedTextBlock({ data }) {
  if (!data?.content) return null;
  return (
    <div style={{
      padding: "6px 0",
      fontFamily: F,
      fontSize: 15,
      lineHeight: 1.6,
      color: T.ink,
      overflowWrap: "break-word",
      wordBreak: "break-word",
    }}>
      {renderMd(data.content)}
    </div>
  );
}

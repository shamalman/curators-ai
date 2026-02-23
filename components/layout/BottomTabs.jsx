'use client'

import { usePathname, useRouter } from "next/navigation";
import { T, W, F } from "@/lib/constants";

export default function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();

  const isAsk = pathname.startsWith("/ask");

  const tabs = [
    { id: "ask", icon: "\u25C8", label: "Ask", path: "/ask", active: pathname.startsWith("/ask"), activeColor: W.accent },
    { id: "recs", icon: "\u25C9", label: "Recs", path: "/recs", active: pathname.startsWith("/recs"), activeColor: T.acc },
    { id: "fans", icon: "\u2661", label: "Fans", path: null, active: false, activeColor: T.acc, disabled: true },
    { id: "taste", icon: "\u25C6", label: "Taste", path: "/taste", active: pathname.startsWith("/taste"), activeColor: T.acc },
  ];

  return (
    <div style={{
      display: "flex", borderTop: `1px solid ${isAsk ? W.bdr : T.bdr}`,
      background: isAsk ? W.bg : T.bg2,
      padding: "6px 0 28px", flexShrink: 0, transition: "background .3s",
    }}>
      {tabs.map(tab => (
        <button key={tab.id}
          onClick={() => { if (!tab.disabled && tab.path) router.push(tab.path); }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            border: "none", background: "transparent", cursor: tab.disabled ? "default" : "pointer", padding: "10px 0",
            color: tab.active ? tab.activeColor : T.ink3,
            opacity: tab.disabled ? 0.35 : 1,
          }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: 11, fontFamily: F, fontWeight: tab.active ? 700 : 400 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

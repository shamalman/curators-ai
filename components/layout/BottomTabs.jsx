'use client'

import { T, W, F } from "@/lib/constants";

export default function BottomTabs({ curatorTab, setCuratorTab }) {
  return (
    <div style={{
      display: "flex", borderTop: `1px solid ${curatorTab === "myai" ? W.bdr : T.bdr}`,
      background: curatorTab === "myai" ? W.bg : T.bg2,
      padding: "6px 0 28px", flexShrink: 0, transition: "background .3s",
    }}>
      {[
        { id: "myai", icon: "◈", label: "My AI", activeColor: W.accent },
        { id: "profile", icon: "◉", label: "Profile", activeColor: T.acc },
      ].map(tab => (
        <button key={tab.id} onClick={() => setCuratorTab(tab.id)}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            border: "none", background: "transparent", cursor: "pointer", padding: "10px 0",
            color: curatorTab === tab.id ? tab.activeColor : T.ink3,
          }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: 11, fontFamily: F, fontWeight: curatorTab === tab.id ? 700 : 400 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

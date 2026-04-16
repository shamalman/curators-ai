'use client'

import { useState } from "react";
import { T, F, S } from "@/lib/constants";
import TasteManager from "@/components/taste/TasteManager";
import NetworkView from "@/components/recs/NetworkView";
import SavedView from "@/components/recs/SavedView";

const TABS = [
  { key: "yours", label: "My Recs" },
  { key: "saved", label: "Saved" },
  { key: "network", label: "Curator Network" },
];

export default function RecommendationsPage() {
  const [tab, setTab] = useState("yours");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
      <div style={{ maxWidth: 700, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>
        {/* Header */}
        <div style={{ padding: "52px 20px 0", flexShrink: 0 }}>
          <h2 style={{ fontFamily: S, fontSize: 28, color: T.ink, fontWeight: 400, marginBottom: 16 }}>Recommendations</h2>

          {/* Segmented control */}
          <div style={{ display: "flex", gap: 2, background: T.s, borderRadius: 8, padding: 2, marginBottom: 16 }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                flex: 1, padding: "7px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: tab === t.key ? T.s2 : "transparent",
                color: tab === t.key ? T.ink : T.ink3,
                fontSize: 12, fontWeight: 600, fontFamily: F,
                transition: "background .15s, color .15s",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        {tab === "network" && <NetworkView />}
        {tab === "saved" && <SavedView onSwitchToNetwork={() => setTab("network")} />}
        {tab === "yours" && <TasteManager embedded />}
      </div>
    </div>
  );
}

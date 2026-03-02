'use client'

import { usePathname, useRouter } from "next/navigation";
import { T, F, S } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { useCurator } from "@/context/CuratorContext";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useCurator();

  const handle = profile?.handle?.replace("@", "") || "";

  const nav = [
    { id: "ask", icon: "\u25C8", label: "My AI", path: "/myai" },
    { id: "recs", icon: "\u25C6", label: "Recommendations", path: "/recommendations" },
    { id: "subs", icon: "\u2661", label: "Subs", path: "/subs" },
    { id: "profile", icon: "\u25C7", label: "Profile", path: "/profile" },
  ];

  const isActive = (item) => {
    if (item.id === "recs") return pathname.startsWith("/recommendations");
    if (item.id === "ask") return pathname.startsWith("/myai");
    if (item.id === "subs") return pathname.startsWith("/subs");
    if (item.id === "profile") return pathname.startsWith("/profile") || pathname.startsWith("/settings");
    return false;
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, bottom: 0, width: 220,
      background: T.bg, borderRight: `1px solid ${T.bdr}`,
      display: "flex", flexDirection: "column", zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: "24px 20px", flexShrink: 0 }}>
        <span style={{ fontFamily: S, fontSize: 20, color: T.acc, fontWeight: 400 }}>curators</span>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: "0 12px", display: "flex", flexDirection: "column", gap: 4 }}>
        {nav.map(item => (
          <div key={item.id}>
            <button
              onClick={() => router.push(item.path)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 8, border: "none",
                background: isActive(item) ? T.accSoft : "transparent",
                color: isActive(item) ? T.acc : T.ink3,
                fontFamily: F, fontSize: 14, fontWeight: 500,
                cursor: "pointer", textAlign: "left",
                transition: "background .15s",
              }}
              onMouseEnter={e => { if (!isActive(item)) e.currentTarget.style.background = T.s; }}
              onMouseLeave={e => { if (!isActive(item)) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, width: 20, textAlign: "center" }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </div>
        ))}
      </nav>

      {/* Settings + Logout */}
      <div style={{ padding: "8px 12px 16px", borderTop: `1px solid ${T.bdr}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          onClick={() => router.push("/settings")}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 8, border: "none",
            background: pathname.startsWith("/settings") ? T.accSoft : "transparent",
            color: pathname.startsWith("/settings") ? T.acc : T.ink3,
            fontFamily: F, fontSize: 14, fontWeight: 500,
            cursor: "pointer", textAlign: "left",
            transition: "background .15s",
          }}
          onMouseEnter={e => { if (!pathname.startsWith("/settings")) e.currentTarget.style.background = T.s; }}
          onMouseLeave={e => { if (!pathname.startsWith("/settings")) e.currentTarget.style.background = "transparent"; }}
        >
          <span style={{ fontSize: 16, lineHeight: 1, width: 20, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}

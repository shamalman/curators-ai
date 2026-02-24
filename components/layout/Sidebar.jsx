'use client'

import { usePathname, useRouter } from "next/navigation";
import { T, F, S } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useCurator();

  const handle = profile?.handle?.replace("@", "") || "";

  const nav = [
    { id: "ask", icon: "\u25C8", label: "My AI", path: "/myai" },
    { id: "recs", icon: "\u25C6", label: "Recommendations", path: "/recommendations", children: [
      { id: "review", label: "Review", path: "/recommendations/review" },
    ]},
    { id: "fans", icon: "\u2661", label: "Fans", path: "/fans" },
  ];

  const isActive = (item) => {
    if (item.id === "recs") return pathname.startsWith("/recommendations");
    if (item.id === "ask") return pathname.startsWith("/myai");
    if (item.id === "fans") return pathname.startsWith("/fans");
    return false;
  };

  const isChildActive = (child) => pathname === child.path;

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
            {/* Sub-items */}
            {item.children && isActive(item) && (
              <div style={{ paddingLeft: 32, display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                {item.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => router.push(child.path)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 12px", borderRadius: 6, border: "none",
                      background: isChildActive(child) ? T.accSoft : "transparent",
                      color: isChildActive(child) ? T.acc : T.ink3,
                      fontFamily: F, fontSize: 13, fontWeight: 500,
                      cursor: "pointer", textAlign: "left",
                      transition: "background .15s",
                    }}
                    onMouseEnter={e => { if (!isChildActive(child)) e.currentTarget.style.background = T.s; }}
                    onMouseLeave={e => { if (!isChildActive(child)) e.currentTarget.style.background = "transparent"; }}
                  >
                    <span>{child.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Profile link + logout */}
      <div style={{ padding: "16px 20px", borderTop: `1px solid ${T.bdr}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {handle && (
          <button
            onClick={() => router.push(`/${handle}`)}
            style={{
              display: "flex", alignItems: "center", gap: 8, width: "100%",
              background: "none", border: "none", cursor: "pointer",
              fontFamily: F, fontSize: 13, color: T.ink3, textAlign: "left",
              padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = T.ink2; }}
            onMouseLeave={e => { e.currentTarget.style.color = T.ink3; }}
          >
            <span style={{ flex: 1 }}>@{handle}</span>
            <span style={{ fontSize: 12 }}>{"\u2197"}</span>
          </button>
        )}
        <button
          onClick={logout}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            background: "none", border: "none", cursor: "pointer",
            fontFamily: F, fontSize: 13, color: T.ink3, textAlign: "left",
            padding: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = T.ink2; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.ink3; }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

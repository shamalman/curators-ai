'use client'

import { usePathname, useRouter } from "next/navigation";
import { useContext } from "react";
import { T, W, F } from "@/lib/constants";
import { CuratorContext } from "@/context/CuratorContext";

export default function BottomTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useContext(CuratorContext);
  const handle = profile?.handle?.replace("@", "") || "";

  const isAsk = pathname.startsWith("/myai");

  const isShamal = handle === "shamal";

  const tabs = [
    { id: "ask", icon: "\u25C8", label: "My AI", path: "/myai", active: pathname.startsWith("/myai"), activeColor: W.accent },
    { id: "recs", icon: "\u25C9", label: "Recs", path: "/recommendations", active: pathname.startsWith("/recommendations"), activeColor: T.acc },
    { id: "subs", icon: "\u2661", label: "Subs", path: "/subs", active: pathname.startsWith("/subs"), activeColor: T.acc },
    { id: "me", icon: "\u25C7", label: "Me", path: "/me", active: pathname.startsWith("/me"), activeColor: T.acc },
    ...(isShamal ? [{ id: "feedback", icon: "\u25CB", label: "Feedback", path: "/admin/feedback", active: pathname.startsWith("/admin/feedback"), activeColor: T.acc }] : []),
  ];

  return (
    <div style={{
      display: "flex", borderTop: `1px solid ${isAsk ? W.bdr : T.bdr}`,
      background: isAsk ? W.bg : T.bg2,
      paddingBottom: "env(safe-area-inset-bottom, 0px)", flexShrink: 0, transition: "background .3s",
    }}>
      {tabs.map(tab => (
        <button key={tab.id}
          onClick={() => { if (tab.path) router.push(tab.path); }}
          style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            border: "none", background: "transparent", cursor: "pointer", padding: "8px 0 4px",
            color: tab.active ? tab.activeColor : T.ink3,
          }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
          <span style={{ fontSize: 10, fontFamily: F, fontWeight: tab.active ? 700 : 400 }}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

'use client'

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { T, F, S } from "@/lib/constants";
import { useCurator } from "@/context/CuratorContext";
import BottomTabs from "./BottomTabs";
import Sidebar from "./Sidebar";

export default function CuratorShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useCurator();
  const [isDesktop, setIsDesktop] = useState(false);
  const handle = profile?.handle?.replace("@", "") || "";
  const initial = profile?.name?.[0] || "";

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isProfilePage = handle && pathname === `/${handle}`;
  const shouldShowTabs = pathname.startsWith("/myai") || pathname.startsWith("/recommendations") || pathname.startsWith("/fans") || isProfilePage;

  // Desktop layout: fixed sidebar + natural document scroll
  // Exception: chat (/ask) keeps its own scroll container
  if (isDesktop) {
    const isChat = pathname.startsWith("/myai");
    const needsFlexLayout = isChat || pathname.startsWith("/recommendations/") || pathname === "/recommendations" || pathname.startsWith("/fans");
    return (
      <>
        <Sidebar />
        <div
          className={needsFlexLayout ? undefined : "desktop-scroll"}
          style={{
            marginLeft: 220, background: T.bg,
            ...(needsFlexLayout ? {
              height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
            } : {
              minHeight: "100vh",
            }),
          }}
        >
          {children}
        </div>
      </>
    );
  }

  // Mobile layout: content + bottom tabs
  return (
    <div style={{
      width: "100%", maxWidth: 430, margin: "0 auto",
      display: "flex", flexDirection: "column", background: T.bg,
      position: "fixed", inset: 0, overflow: "hidden",
    }}>
      {/* Mobile header with profile link */}
      {handle && (
        <div style={{
          paddingTop: "env(safe-area-inset-top, 0px)", flexShrink: 0,
          borderBottom: `1px solid ${T.bdr}`,
        }}>
          <div style={{
            height: 44, padding: "0 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontFamily: S, fontSize: 17, color: T.acc, fontWeight: 400 }}>curators</span>
            <button onClick={() => router.push(`/${handle}`)} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "none", border: "none", cursor: "pointer", padding: 0,
              minWidth: 0, maxWidth: "60%",
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 7, background: T.accSoft,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ fontFamily: S, fontSize: 12, color: T.acc, fontWeight: 400 }}>{initial}</span>
              </div>
              <span style={{ fontFamily: F, fontSize: 13, color: T.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{handle}</span>
            </button>
          </div>
        </div>
      )}
      {children}
      {shouldShowTabs && <BottomTabs />}
    </div>
  );
}

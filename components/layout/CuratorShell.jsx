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
  const shouldShowTabs = pathname.startsWith("/myai") || pathname.startsWith("/recommendations") || pathname.startsWith("/subs") || pathname.startsWith("/profile") || pathname.startsWith("/settings") || isProfilePage;
  const isMainTab = pathname === "/myai" || pathname === "/recommendations" || pathname === "/subs" || pathname === "/profile" || isProfilePage;
  const isDeepPage = !isMainTab;

  // Desktop layout: fixed sidebar + natural document scroll
  // Exception: chat (/ask) keeps its own scroll container
  if (isDesktop) {
    const isChat = pathname.startsWith("/myai");
    const needsFlexLayout = isChat || pathname.startsWith("/recommendations/") || pathname === "/recommendations" || pathname.startsWith("/subs") || pathname.startsWith("/profile") || pathname.startsWith("/settings");
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
            height: 40, padding: "0 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            {isDeepPage ? (
              <button onClick={() => router.back()} style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                display: "flex", alignItems: "center",
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
            ) : (
              <span style={{ fontFamily: S, fontSize: 15, color: T.acc, fontWeight: 400 }}>curators</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => router.push("/profile")} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "none", border: "none", cursor: "pointer", padding: 0,
                minWidth: 0,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, background: T.accSoft,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <span style={{ fontFamily: S, fontSize: 11, color: T.acc, fontWeight: 400 }}>{initial}</span>
                </div>
                <span style={{ fontFamily: F, fontSize: 12, color: T.ink3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{handle}</span>
              </button>
              <button onClick={() => router.push("/settings")} style={{
                background: "none", border: "none", cursor: "pointer", padding: 4,
                display: "flex", alignItems: "center", flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
      {shouldShowTabs && <BottomTabs />}
    </div>
  );
}

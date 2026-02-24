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

  const tabPaths = ["/myai", "/recommendations", "/fans"];
  const shouldShowTabs = tabPaths.includes(pathname);

  // Desktop layout: fixed sidebar + natural document scroll
  // Exception: chat (/ask) keeps its own scroll container
  if (isDesktop) {
    const isChat = pathname.startsWith("/myai");
    return (
      <>
        <Sidebar />
        <div
          className={isChat ? undefined : "desktop-scroll"}
          style={{
            marginLeft: 220, background: T.bg,
            ...(isChat ? {
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
          padding: "50px 16px 10px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${T.bdr}`,
        }}>
          <span style={{ fontFamily: S, fontSize: 17, color: T.acc, fontWeight: 400 }}>curators</span>
          <button onClick={() => router.push(`/${handle}`)} style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "none", border: "none", cursor: "pointer", padding: 0,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 7, background: T.accSoft,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: S, fontSize: 12, color: T.acc, fontWeight: 400 }}>{initial}</span>
            </div>
            <span style={{ fontFamily: F, fontSize: 13, color: T.ink3 }}>@{handle}</span>
          </button>
        </div>
      )}
      {children}
      {shouldShowTabs && <BottomTabs />}
    </div>
  );
}

'use client'

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { T } from "@/lib/constants";
import BottomTabs from "./BottomTabs";
import Sidebar from "./Sidebar";

export default function CuratorShell({ children }) {
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const tabPaths = ["/ask", "/recommendations"];
  const shouldShowTabs = tabPaths.includes(pathname);

  // Desktop layout: fixed sidebar + natural document scroll
  // Exception: chat (/ask) keeps its own scroll container
  if (isDesktop) {
    const isChat = pathname.startsWith("/ask");
    return (
      <>
        <Sidebar />
        <div style={{
          marginLeft: 220, background: T.bg,
          ...(isChat ? {
            height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
          } : {
            minHeight: "100vh",
          }),
        }}>
          {children}
        </div>
      </>
    );
  }

  // Mobile layout: content + bottom tabs
  return (
    <div style={{
      width: "100%", maxWidth: 430, margin: "0 auto", height: "100dvh",
      display: "flex", flexDirection: "column", background: T.bg,
      position: "relative", overflow: "hidden",
    }}>
      {children}
      {shouldShowTabs && <BottomTabs />}
    </div>
  );
}

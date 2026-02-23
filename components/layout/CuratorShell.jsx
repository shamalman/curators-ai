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

  // Desktop layout: sidebar + content
  if (isDesktop) {
    return (
      <div style={{ display: "flex", height: "100vh", background: T.bg }}>
        <Sidebar />
        <div style={{
          flex: 1, marginLeft: 220, height: "100vh",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {children}
        </div>
      </div>
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

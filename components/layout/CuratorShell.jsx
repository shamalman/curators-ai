'use client'

import { usePathname } from "next/navigation";
import { T } from "@/lib/constants";
import BottomTabs from "./BottomTabs";

export default function CuratorShell({ children }) {
  const pathname = usePathname();

  const tabPaths = ["/ask", "/recommendations"];
  const shouldShowTabs = tabPaths.includes(pathname);

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

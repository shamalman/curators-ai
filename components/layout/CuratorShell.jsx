'use client'

import { usePathname } from "next/navigation";
import { T } from "@/lib/constants";
import BottomTabs from "./BottomTabs";

export default function CuratorShell({ children }) {
  const pathname = usePathname();

  // Show tabs on main pages only
  const showTabs = ["/ask", "/recs", "/taste"].some(p =>
    pathname === p || (p === "/recs" && pathname === "/recs")
  ) && !["/recs/review", "/settings"].some(p => pathname.startsWith(p)) && !/^\/recs\/[^/]+$/.test(pathname.replace("/recs/review", ""));

  // More precise: show tabs only on exact /ask, /recs, /taste
  const tabPaths = ["/ask", "/recs", "/taste"];
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

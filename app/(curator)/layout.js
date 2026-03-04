'use client'

import { CuratorProvider } from '@/context/CuratorContext'
import CuratorShell from '@/components/layout/CuratorShell'

export default function CuratorLayout({ children }) {
  console.log("[CURATOR LAYOUT] rendered")
  return (
    <CuratorProvider>
      <CuratorShell>{children}</CuratorShell>
    </CuratorProvider>
  )
}

'use client'

import { CuratorProvider } from '@/context/CuratorContext'
import CuratorShell from '@/components/layout/CuratorShell'

export default function AdminLayout({ children }) {
  return (
    <CuratorProvider>
      <CuratorShell>{children}</CuratorShell>
    </CuratorProvider>
  )
}

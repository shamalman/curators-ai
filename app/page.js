'use client'

import { CuratorProvider } from '@/context/CuratorContext'
import CuratorsApp from '@/components/CuratorsApp'

export default function Home() {
  return (
    <CuratorProvider>
      <CuratorsApp />
    </CuratorProvider>
  )
}

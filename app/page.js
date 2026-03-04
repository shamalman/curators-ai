'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Only redirect if we're actually on the root path
    // Prevents accidental redirects during route transitions
    if (pathname === '/') {
      router.replace('/myai')
    }
  }, [pathname, router])

  return null
}

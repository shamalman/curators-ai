'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function Home() {
  const router = useRouter()
  const pathname = usePathname()

  console.log("[ROOT PAGE] rendered, pathname:", pathname)

  useEffect(() => {
    console.log("[ROOT PAGE] useEffect, pathname:", pathname)
    // Only redirect if we're actually on the root path
    // Prevents accidental redirects during route transitions
    if (pathname === '/') {
      console.log("[ROOT PAGE] REDIRECTING to /myai")
      router.replace('/myai')
    }
  }, [pathname, router])

  return null
}

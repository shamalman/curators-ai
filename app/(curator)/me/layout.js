'use client'

import { usePathname } from 'next/navigation'
import MeSegmentedControl from '@/components/me/MeSegmentedControl'

export default function MeLayout({ children }) {
  const pathname = usePathname()
  const active = pathname === '/me' ? 'recs' : 'taste'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 20px 0' }}>
      <MeSegmentedControl active={active} />
      {children}
    </div>
  )
}

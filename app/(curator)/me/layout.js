'use client'

import MeSegmentedControl from '@/components/me/MeSegmentedControl'

export default function MeLayout({ children }) {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 20px 0' }}>
      <MeSegmentedControl active="taste" />
      {children}
    </div>
  )
}

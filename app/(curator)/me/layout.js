'use client'

import { usePathname, useRouter } from 'next/navigation'
import { T, F } from '@/lib/constants'

export default function MeLayout({ children }) {
  const pathname = usePathname()
  const router = useRouter()

  const activeTab = pathname.includes('/me/profile') ? 'profile' : 'taste'

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 20px' }}>
      {/* Segmented Control */}
      <div style={{ padding: '16px 0 0' }}>
        <div style={{
          display: 'flex',
          background: T.bg2,
          borderRadius: 10,
          padding: 3,
          border: '1px solid ' + T.s,
        }}>
          <button
            onClick={() => router.push('/me/taste-file')}
            style={{
              flex: 1, textAlign: 'center',
              background: activeTab === 'taste' ? T.s : 'transparent',
              color: activeTab === 'taste' ? T.ink : T.ink3,
              boxShadow: activeTab === 'taste' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 500,
              fontFamily: F, border: 'none', cursor: 'pointer',
            }}
          >
            Taste File
          </button>
          <button
            onClick={() => router.push('/me/profile')}
            style={{
              flex: 1, textAlign: 'center',
              background: activeTab === 'profile' ? T.s : 'transparent',
              color: activeTab === 'profile' ? T.ink : T.ink3,
              boxShadow: activeTab === 'profile' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 500,
              fontFamily: F, border: 'none', cursor: 'pointer',
            }}
          >
            Public Profile
          </button>
        </div>
      </div>

      {children}
    </div>
  )
}

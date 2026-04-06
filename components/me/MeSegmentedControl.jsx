'use client'

import { useRouter } from 'next/navigation'
import { useCurator } from '@/context/CuratorContext'
import { T, F } from '@/lib/constants'

export default function MeSegmentedControl({ active }) {
  const router = useRouter()
  const { profile } = useCurator()

  const handle = profile?.handle?.replace('@', '') || ''

  const goToTaste = () => router.push('/me')
  const goToProfile = () => {
    if (handle) router.push('/' + handle)
  }

  return (
    <div style={{
      display: 'flex',
      background: T.bg2,
      borderRadius: 10,
      padding: 3,
      border: '1px solid ' + T.s,
      marginBottom: 24,
    }}>
      <button
        onClick={goToTaste}
        style={{
          flex: 1, textAlign: 'center',
          background: active === 'taste' ? T.s : 'transparent',
          color: active === 'taste' ? T.ink : T.ink3,
          boxShadow: active === 'taste' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
          borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 500,
          fontFamily: F, border: 'none', cursor: 'pointer',
        }}
      >
        Taste File
      </button>
      <button
        onClick={goToProfile}
        style={{
          flex: 1, textAlign: 'center',
          background: active === 'profile' ? T.s : 'transparent',
          color: active === 'profile' ? T.ink : T.ink3,
          boxShadow: active === 'profile' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
          borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 500,
          fontFamily: F, border: 'none', cursor: 'pointer',
        }}
      >
        Public Profile
      </button>
    </div>
  )
}

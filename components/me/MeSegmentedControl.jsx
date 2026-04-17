'use client'

import { useRouter } from 'next/navigation'
import { useCurator } from '@/context/CuratorContext'
import { T, F } from '@/lib/constants'

export default function MeSegmentedControl({ active }) {
  const router = useRouter()
  const { profile } = useCurator()

  const handle = profile?.handle?.replace('@', '') || ''

  const goToRecs = () => router.push('/me')
  const goToTaste = () => router.push('/me/taste')
  const goToProfile = () => {
    if (handle) router.push('/' + handle)
  }

  const btnStyle = (isActive) => ({
    flex: 1, textAlign: 'center',
    background: isActive ? T.s : 'transparent',
    color: isActive ? T.ink : T.ink3,
    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
    borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 500,
    fontFamily: F, border: 'none', cursor: 'pointer',
  })

  return (
    <div style={{
      display: 'flex',
      background: T.bg2,
      borderRadius: 10,
      padding: 3,
      border: '1px solid ' + T.s,
      marginBottom: 24,
    }}>
      <button onClick={goToRecs} style={btnStyle(active === 'recs')}>
        My Recs
      </button>
      <button onClick={goToTaste} style={btnStyle(active === 'taste')}>
        Personal Record
      </button>
      <button onClick={goToProfile} style={btnStyle(active === 'profile')}>
        Public Profile
      </button>
    </div>
  )
}

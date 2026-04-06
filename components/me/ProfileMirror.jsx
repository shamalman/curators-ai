'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useCurator } from '@/context/CuratorContext'
import { VisitorProvider } from '@/context/VisitorContext'
import VisitorProfile from '@/components/visitor/VisitorProfile'
import { T, F } from '@/lib/constants'

export default function ProfileMirror() {
  const { profile } = useCurator()
  const router = useRouter()

  if (!profile) return null

  const handle = profile.handle?.replace('@', '') || ''

  return (
    <VisitorProvider handle={handle}>
      <div style={{ paddingTop: 16 }}>
        <Suspense fallback={null}>
          <VisitorProfile mode="visitor" />
        </Suspense>
      </div>
    </VisitorProvider>
  )
}

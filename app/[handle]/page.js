'use client'

import { Suspense } from 'react'
import { useCurator } from '@/context/CuratorContext'
import VisitorProfile from '@/components/visitor/VisitorProfile'
import MeSegmentedControl from '@/components/me/MeSegmentedControl'

function HandlePageContent() {
  const { isOwner } = useCurator()

  return (
    <>
      {isOwner && (
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px 20px 0' }}>
          <MeSegmentedControl active="profile" />
        </div>
      )}
      <VisitorProfile mode="visitor" />
    </>
  )
}

export default function VisitorProfilePage() {
  return (
    <Suspense fallback={null}>
      <HandlePageContent />
    </Suspense>
  )
}

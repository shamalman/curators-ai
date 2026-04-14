'use client'

import { useCurator } from '@/context/CuratorContext'
import TasteTimeline from '@/components/me/TasteTimeline'

export default function TimelinePage() {
  const { profile } = useCurator()
  const handle = (profile?.handle || '').replace(/^@/, '')
  return <TasteTimeline handle={handle} />
}

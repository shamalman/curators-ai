'use client'
import { useParams } from 'next/navigation'
import { useCurator } from '@/context/CuratorContext'
import { CuratorRecDetail, NetworkRecDetail } from '@/components/recs/RecDetail'

export default function RecDetailPage() {
  const { slug } = useParams()
  const { tasteItems } = useCurator()

  // If the slug matches one of the user's own recs, show the owner detail view
  const isOwnRec = tasteItems.some(i => i.slug === slug || i.id === slug)

  if (isOwnRec) {
    return <CuratorRecDetail slug={slug} />
  }

  // Otherwise, fetch from DB and show network detail view
  return <NetworkRecDetail slug={slug} />
}

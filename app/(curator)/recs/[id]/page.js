'use client'
import { useParams } from 'next/navigation'
import { CuratorRecDetail } from '@/components/recs/RecDetail'

export default function RecDetailPage() {
  const { id } = useParams()
  return <CuratorRecDetail itemId={id} />
}

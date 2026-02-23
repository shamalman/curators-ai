'use client'
import { useParams } from 'next/navigation'
import { CuratorRecDetail } from '@/components/recs/RecDetail'

export default function RecDetailPage() {
  const { slug } = useParams()
  return <CuratorRecDetail slug={slug} />
}

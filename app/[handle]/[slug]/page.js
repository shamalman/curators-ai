'use client'
import { useParams } from 'next/navigation'
import { VisitorRecDetail } from '@/components/recs/RecDetail'

export default function VisitorRecDetailPage() {
  const { slug } = useParams()
  return <VisitorRecDetail slug={slug} />
}

'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RequestsPanel, RequestThread } from '@/components/screens/RequestScreens'

export default function ReviewPage() {
  const router = useRouter()
  const [activeRequest, setActiveRequest] = useState(null)

  if (activeRequest) {
    return <RequestThread request={activeRequest} onBack={() => setActiveRequest(null)} />
  }

  return (
    <RequestsPanel
      onClose={() => router.back()}
      onOpenThread={(req) => setActiveRequest(req)}
    />
  )
}

'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// import { useState } from 'react'
// import { RequestsPanel, RequestThread } from '@/components/screens/RequestScreens'

/* TODO: Unhide when requests are real */
export default function ReviewPage() {
  const router = useRouter()
  useEffect(() => { router.back() }, [])
  return null

  // Hidden until requests feature uses real data:
  // const [activeRequest, setActiveRequest] = useState(null)
  //
  // if (activeRequest) {
  //   return <RequestThread request={activeRequest} onBack={() => setActiveRequest(null)} />
  // }
  //
  // return (
  //   <RequestsPanel
  //     onClose={() => router.back()}
  //     onOpenThread={(req) => setActiveRequest(req)}
  //   />
  // )
}

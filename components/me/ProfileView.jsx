'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurator } from '@/context/CuratorContext'
import { supabase } from '@/lib/supabase'
import { T, F, MN, CAT } from '@/lib/constants'

export default function ProfileView() {
  const { profile, profileId, tasteItems } = useCurator()
  const router = useRouter()
  const [subscribedToCount, setSubscribedToCount] = useState(0)
  const [subscriberCount, setSubscriberCount] = useState(0)

  useEffect(() => {
    if (!profileId) return

    async function fetchCounts() {
      const [subTo, subBy] = await Promise.all([
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('subscriber_id', profileId).is('unsubscribed_at', null),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('curator_id', profileId).is('unsubscribed_at', null),
      ])
      setSubscribedToCount(subTo.count || 0)
      setSubscriberCount(subBy.count || 0)
    }

    fetchCounts()
  }, [profileId])

  if (!profile) return null

  const handleRaw = profile.handle.replace('@', '')
  const publicRecs = tasteItems.filter(r => r.visibility === 'public')
  const showRecs = profile.showRecs !== false
  const showSubscriptions = profile.showSubscriptions === true
  const showSubscribers = profile.showSubscribers === true

  // Category breakdown for bar graph
  const catCounts = {}
  if (showRecs && publicRecs.length > 0) {
    for (const rec of publicRecs) {
      const cat = rec.category || 'other'
      catCounts[cat] = (catCounts[cat] || 0) + 1
    }
  }
  const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1])
  const totalRecs = publicRecs.length

  // Stats
  const stats = []
  if (showRecs) stats.push({ value: totalRecs, label: 'Recs' })
  if (showSubscriptions) stats.push({ value: subscribedToCount, label: 'Subscribed to' })
  if (showSubscribers) stats.push({ value: subscriberCount, label: 'Subscribers' })

  return (
    <div>
      {/* Avatar + Name + Handle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 20, marginBottom: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: T.s2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 600, color: T.ink2, fontFamily: F, flexShrink: 0,
        }}>
          {profile.name ? profile.name[0].toUpperCase() : '?'}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: T.ink, fontFamily: F }}>
            {profile.name}
          </div>
          <div style={{ fontFamily: MN, fontSize: 12, color: T.ink3 }}>
            {profile.handle}
          </div>
        </div>
      </div>

      {/* Bio */}
      <div style={{
        fontSize: profile.bio ? 14 : 13,
        color: profile.bio ? T.ink2 : T.ink3,
        lineHeight: 1.55,
        marginBottom: 16,
        fontFamily: F,
      }}>
        {profile.bio || 'No bio yet'}
      </div>

      {/* Stats row */}
      {stats.length > 0 && (
        <div style={{
          display: 'flex',
          borderTop: '1px solid ' + T.s,
          borderBottom: '1px solid ' + T.s,
          marginBottom: 18,
        }}>
          {stats.map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1,
              textAlign: 'center',
              padding: '11px 0',
              borderLeft: i > 0 ? '1px solid ' + T.s : 'none',
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, fontFamily: F }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 10, color: T.ink3, marginTop: 2, fontFamily: F }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category bar graph */}
      {showRecs && catEntries.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
            {catEntries.map(([cat, count]) => (
              <div key={cat} style={{
                flex: count,
                background: CAT[cat]?.color || CAT.other.color,
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {catEntries.map(([cat, count]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: T.ink3, fontFamily: F }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: CAT[cat]?.color || CAT.other.color,
                }} />
                {CAT[cat]?.label || cat} ({count})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Profile button */}
      <button
        onClick={() => router.push('/' + handleRaw + '/edit')}
        style={{
          display: 'block',
          width: '100%',
          padding: 10,
          borderRadius: 8,
          border: '1px solid ' + T.bdr,
          background: 'transparent',
          color: T.ink,
          fontSize: 14,
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: F,
          marginBottom: 10,
        }}
      >
        Edit Profile
      </button>

      {/* View public profile link */}
      <div
        onClick={() => router.push('/' + handleRaw)}
        style={{
          display: 'block',
          textAlign: 'center',
          fontSize: 13,
          color: T.ink3,
          cursor: 'pointer',
          fontFamily: F,
        }}
      >
        View public profile &#8599;
      </div>
    </div>
  )
}

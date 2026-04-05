'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCurator } from '@/context/CuratorContext'
import { supabase } from '@/lib/supabase'
import { T, F, S, MN } from '@/lib/constants'

function parseTasteProfile(markdown) {
  if (!markdown) return null

  const sections = {}
  let currentSection = null

  const lines = markdown.split('\n')
  for (const line of lines) {
    if (line.startsWith('# ')) {
      sections.title = line.replace('# ', '').trim()
      continue
    }
    if (line.startsWith('## ')) {
      currentSection = line.replace('## ', '').trim()
      sections[currentSection] = ''
      continue
    }
    if (currentSection && sections[currentSection] !== undefined) {
      sections[currentSection] += line + '\n'
    }
  }

  for (const key of Object.keys(sections)) {
    if (typeof sections[key] === 'string') {
      sections[key] = sections[key].trim()
    }
  }

  return sections
}

function parseDomains(domainsText) {
  if (!domainsText) return []

  const domains = []
  const blocks = domainsText.split(/\n(?=\*\*)/).filter(Boolean)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    const headerLine = lines[0] || ''

    const nameMatch = headerLine.match(/\*\*([^(*]+)/)
    const name = nameMatch ? nameMatch[1].trim() : headerLine

    const descLines = lines.slice(1).join(' ').trim()
    const afterBold = headerLine.replace(/\*\*[^*]+\*\*/, '').trim()

    domains.push({
      name,
      headerRaw: headerLine.replace(/\*\*/g, '').trim(),
      description: descLines || afterBold,
    })
  }

  return domains
}

function parseSubscriptions(subsText) {
  if (!subsText) return []
  return subsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('- @'))
    .map(line => line.replace('- ', '').trim())
}

export default function TasteFileView() {
  const { profileId } = useCurator()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profileData, setProfileData] = useState(null)

  useEffect(() => {
    if (!profileId) return

    async function fetchTasteProfile() {
      const { data, error } = await supabase
        .from('taste_profiles')
        .select('content, version, generated_at')
        .eq('profile_id', profileId)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (error || !data) {
        setProfileData(null)
      } else {
        setProfileData(data)
      }
      setLoading(false)
    }

    fetchTasteProfile()
  }, [profileId])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', color: T.ink3, fontSize: 13, padding: '80px 24px' }}>
        Loading...
      </div>
    )
  }

  if (!profileData) {
    return (
      <div style={{ textAlign: 'center', color: T.ink3, fontSize: 14, lineHeight: 1.7, padding: '80px 24px' }}>
        <p>Your AI is still getting to know you. Keep capturing recs and your Taste File will take shape.</p>
        <p
          style={{ color: T.acc, fontWeight: 500, cursor: 'pointer', marginTop: 16 }}
          onClick={() => router.push('/myai')}
        >
          Start a conversation &rarr;
        </p>
      </div>
    )
  }

  const sections = parseTasteProfile(profileData.content)
  if (!sections) return null

  const formattedDate = profileData.generated_at
    ? new Date(profileData.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Title */}
      {sections.title && (
        <div style={{ fontFamily: S, fontSize: 22, fontWeight: 500, color: T.ink, marginBottom: 4 }}>
          {sections.title}
        </div>
      )}

      {/* Meta */}
      {(profileData.version || formattedDate) && (
        <div style={{ fontFamily: MN, fontSize: 11, color: T.ink3, marginBottom: 24 }}>
          {profileData.version ? `v${profileData.version}` : ''}
          {profileData.version && formattedDate ? ' \u00B7 ' : ''}
          {formattedDate ? `updated ${formattedDate}` : ''}
        </div>
      )}

      {/* Thesis */}
      {sections['Thesis'] && (
        <>
          <SectionHeader>Thesis</SectionHeader>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: T.ink, fontFamily: F, margin: 0 }}>
            {sections['Thesis']}
          </p>
        </>
      )}

      {/* Domains */}
      {sections['Domains'] && (
        <>
          <SectionHeader>Domains</SectionHeader>
          {parseDomains(sections['Domains']).map((domain, i, arr) => (
            <div key={i} style={{
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: i < arr.length - 1 ? '1px solid ' + T.bg2 : 'none',
            }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: T.ink, fontFamily: F }}>
                {domain.name}
              </div>
              {domain.headerRaw !== domain.name && (
                <div style={{ fontSize: 11, color: T.acc, fontFamily: F, marginTop: 2 }}>
                  {domain.headerRaw}
                </div>
              )}
              {domain.description && (
                <div style={{ fontSize: 13, color: T.ink2, lineHeight: 1.5, fontFamily: F, marginTop: 4 }}>
                  {domain.description}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* Patterns */}
      {sections['Patterns'] && (
        <>
          <SectionHeader>Patterns</SectionHeader>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, fontFamily: F, margin: 0 }}>
            {sections['Patterns']}
          </p>
        </>
      )}

      {/* Voice & Style */}
      {sections['Voice & Style'] && (
        <>
          <SectionHeader>Voice & Style</SectionHeader>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, fontFamily: F, margin: 0 }}>
            {sections['Voice & Style']}
          </p>
        </>
      )}

      {/* Curators They Subscribe To */}
      {sections['Curators They Subscribe To'] && (
        <>
          <SectionHeader>Curators They Subscribe To</SectionHeader>
          {parseSubscriptions(sections['Curators They Subscribe To']).map((handle, i) => (
            <div key={i} style={{
              fontFamily: MN,
              fontSize: 12,
              color: T.acc,
              padding: '8px 0',
              borderTop: i > 0 ? '1px solid ' + T.bg2 : 'none',
            }}>
              {handle}
            </div>
          ))}
        </>
      )}

      {/* Confirmed Observations */}
      {sections['Confirmed Observations'] && (
        <>
          <SectionHeader>Confirmed Observations</SectionHeader>
          {sections['Confirmed Observations'].split('\n').filter(l => l.trim()).map((line, i) => (
            <div key={i} style={{
              paddingLeft: 12,
              borderLeft: '2px solid ' + T.acc,
              marginBottom: 6,
            }}>
              <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.45, fontFamily: F }}>
                {line.replace(/^[>-]\s*/, '').replace(/\*\*/g, '')}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Anti-Taste */}
      {sections['Anti-Taste'] && (
        <>
          <SectionHeader>Anti-Taste</SectionHeader>
          {sections['Anti-Taste'].split('\n').filter(l => l.trim()).map((line, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', background: '#E24B4A',
                flexShrink: 0, marginTop: 6,
              }} />
              <div style={{ fontSize: 13, color: T.ink2, fontFamily: F }}>
                {line.replace(/^[>-]\s*/, '').replace(/\*\*/g, '')}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Stats */}
      {sections['Stats'] && (
        <>
          <SectionHeader>Stats</SectionHeader>
          <div style={{ fontFamily: MN, fontSize: 11, color: T.ink3, lineHeight: 1.8 }}>
            {sections['Stats'].split('\n').filter(l => l.trim()).map((line, i) => (
              <div key={i}>{line.replace(/^-\s*/, '')}</div>
            ))}
          </div>
        </>
      )}

      {/* CTA */}
      <button
        onClick={() => router.push('/myai')}
        style={{
          display: 'block',
          width: '100%',
          background: T.accSoft,
          border: '1px solid rgba(212,149,107,0.18)',
          color: T.acc,
          borderRadius: 8,
          padding: 11,
          fontSize: 13,
          fontWeight: 500,
          fontFamily: F,
          textAlign: 'center',
          cursor: 'pointer',
          marginTop: 24,
        }}
      >
        Want to refine this? Talk to your AI &rarr;
      </button>
    </div>
  )
}

function SectionHeader({ children }) {
  return (
    <div style={{
      fontFamily: S,
      fontSize: 16,
      fontWeight: 500,
      color: T.ink,
      marginTop: 24,
      marginBottom: 10,
      paddingBottom: 6,
      borderBottom: '1px solid ' + T.s,
    }}>
      {children}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

const DOT_COLOR = {
  confirmed: '#1D9E75',
  corrected: '#BA7517',
  ignored: '#888780',
  rec_saved: '#378ADD',
}

const LABEL_TEXT = {
  confirmed: 'Taste read · confirmed',
  corrected: 'Taste read · corrected',
  ignored: 'Taste read · ignored',
  rec_saved: 'Saved rec',
}

const LABEL_COLOR = {
  confirmed: '#0F6E56',
  corrected: '#854F0B',
  ignored: '#888780',
  rec_saved: '#185FA5',
}

function formatTime(iso) {
  const d = new Date(iso)
  let h = d.getHours()
  const m = d.getMinutes()
  const suffix = h >= 12 ? 'p' : 'a'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m.toString().padStart(2, '0')}${suffix}`
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function dateGroupLabel(iso) {
  const d = new Date(iso)
  const today = startOfLocalDay(new Date())
  const that = startOfLocalDay(d)
  const diffDays = Math.round((today - that) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

function groupByDate(events) {
  const groups = []
  let current = null
  for (const ev of events) {
    const label = dateGroupLabel(ev.created_at)
    if (!current || current.label !== label) {
      current = { label, events: [] }
      groups.push(current)
    }
    current.events.push(ev)
  }
  return groups
}

function DomainChip({ domain, url }) {
  if (!domain) return null
  const style = {
    fontSize: 11,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 4,
    padding: '1px 6px',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    display: 'inline-block',
  }
  if (!url) {
    return <span style={style}>{domain}</span>
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ ...style, cursor: 'pointer' }}
    >
      {domain} ↗
    </a>
  )
}

const truncate2 = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
}

function PrimaryText({ ev }) {
  const base = { fontSize: 14, lineHeight: 1.4, marginBottom: 4 }
  if (ev.type === 'corrected') {
    return (
      <div style={{ marginBottom: 4 }}>
        {ev.original_text && (
          <div style={{
            fontSize: 13,
            color: 'var(--color-text-tertiary)',
            textDecoration: 'line-through',
            lineHeight: 1.4,
          }}>
            {ev.original_text}
          </div>
        )}
        <div style={{
          fontSize: 11,
          color: 'var(--color-text-tertiary)',
          margin: '2px 0',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          corrected to
        </div>
        <div style={{
          fontSize: 14,
          lineHeight: 1.4,
          color: 'var(--color-text-primary)',
        }}>
          {ev.inference_text}
        </div>
      </div>
    )
  }
  if (ev.type === 'ignored') {
    return (
      <div style={{ ...base, color: 'var(--color-text-tertiary)', ...truncate2 }}>
        {ev.inference_text}
      </div>
    )
  }
  if (ev.type === 'confirmed') {
    return (
      <div style={{ ...base, color: 'var(--color-text-primary)', ...truncate2 }}>
        {ev.inference_text}
      </div>
    )
  }
  if (ev.type === 'rec_saved') {
    const text = (ev.rec_why && ev.rec_why.trim()) ? ev.rec_why : ev.rec_title
    return (
      <div style={{ ...base, color: 'var(--color-text-primary)', ...truncate2 }}>
        {text}
      </div>
    )
  }
  return null
}

function SecondaryLine({ ev }) {
  const wrapStyle = {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    display: 'flex',
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    flexWrap: 'wrap',
  }
  if (ev.type === 'rec_saved') {
    const whyShown = !!(ev.rec_why && ev.rec_why.trim())
    const cat = ev.rec_category || ''
    return (
      <div style={wrapStyle}>
        <span>{cat}</span>
        {whyShown && ev.rec_title && (
          <>
            <span>·</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {ev.rec_title}
            </span>
          </>
        )}
      </div>
    )
  }
  // Taste read events
  const title = ev.article_title
  return (
    <div style={wrapStyle}>
      {title && <span>{title}</span>}
      {title && (ev.article_domain || ev.article_url) && <span>·</span>}
      <DomainChip domain={ev.article_domain} url={ev.article_url} />
    </div>
  )
}

function EventRow({ ev, handle }) {
  const isRec = ev.type === 'rec_saved'
  const [hover, setHover] = useState(false)
  const rowStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    background: isRec && hover
      ? 'var(--color-background-secondary)'
      : 'var(--color-background-primary)',
    color: 'inherit',
    textDecoration: 'none',
    cursor: isRec ? 'pointer' : 'default',
  }

  const inner = (
    <>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: DOT_COLOR[ev.type],
        flexShrink: 0,
        marginTop: 4,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: 3,
          color: LABEL_COLOR[ev.type],
        }}>
          {LABEL_TEXT[ev.type]}
        </div>
        <PrimaryText ev={ev} />
        <SecondaryLine ev={ev} />
      </div>
      <div style={{
        fontSize: 11,
        color: 'var(--color-text-tertiary)',
        flexShrink: 0,
        paddingTop: 3,
        textAlign: 'right',
      }}>
        {isRec ? '›' : formatTime(ev.created_at)}
      </div>
    </>
  )

  if (isRec && handle && ev.rec_slug) {
    return (
      <a
        href={`/${handle}/${ev.rec_slug}`}
        style={rowStyle}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {inner}
      </a>
    )
  }
  return <div style={rowStyle}>{inner}</div>
}

export default function TasteTimeline({ handle }) {
  const [events, setEvents] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/timeline')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setEvents(data.events || [])
        setNextCursor(data.next_cursor || null)
      } catch (err) {
        console.error('[TasteTimeline] load failed:', err?.message || err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/timeline?cursor=${encodeURIComponent(nextCursor)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setEvents(prev => [...prev, ...(data.events || [])])
      setNextCursor(data.next_cursor || null)
    } catch (err) {
      console.error('[TasteTimeline] load more failed:', err?.message || err)
    } finally {
      setLoadingMore(false)
    }
  }

  const header = (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
      padding: 16,
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      background: 'var(--color-background-primary)',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      <a
        href="/me"
        style={{
          fontSize: 18,
          color: 'var(--color-text-secondary)',
          textDecoration: 'none',
          lineHeight: 1,
        }}
      >
        ←
      </a>
      <div style={{
        fontSize: 16,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
      }}>
        How your taste was built
      </div>
    </div>
  )

  if (loading) {
    return (
      <div>
        {header}
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, padding: '80px 24px' }}>
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        {header}
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, padding: '80px 24px' }}>
          Something went wrong
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div>
        {header}
        <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 14, lineHeight: 1.6, padding: '80px 24px' }}>
          No taste signals yet. Start by sharing a link in your AI chat and tapping Taste read.
        </div>
      </div>
    )
  }

  const groups = groupByDate(events)

  return (
    <div>
      {header}
      {groups.map((g) => (
        <div key={g.label}>
          <div style={{
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--color-text-tertiary)',
            padding: '10px 16px 6px',
            background: 'var(--color-background-tertiary)',
          }}>
            {g.label}
          </div>
          {g.events.map((ev) => (
            <EventRow key={`${ev.type}:${ev.id}`} ev={ev} handle={handle} />
          ))}
        </div>
      ))}
      {nextCursor && (
        loadingMore ? (
          <div style={{ textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 13, padding: '20px' }}>
            Loading...
          </div>
        ) : (
          <button
            onClick={loadMore}
            style={{
              display: 'block',
              margin: '20px auto',
              padding: '8px 20px',
              fontSize: 13,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-secondary)',
              borderRadius: 'var(--border-radius-md)',
              cursor: 'pointer',
            }}
          >
            Load more
          </button>
        )
      )}
    </div>
  )
}

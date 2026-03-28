'use client'

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { T, F, S } from '@/lib/constants';

const DATE_FILTERS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'All time', days: null },
];

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

function formatShortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TranscriptsAdmin() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [selectedCurator, setSelectedCurator] = useState(null);
  const [filterDays, setFilterDays] = useState(30);

  // Auth check + fetch data via server API (bypasses RLS)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      // Client-side auth check for fast redirect
      const { data: prof } = await supabase
        .from('profiles')
        .select('handle')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!prof || prof.handle !== 'shamal') {
        router.push('/myai');
        return;
      }

      setAuthorized(true);
      setLoading(true);

      // Fetch all transcripts via server route (service role, no RLS)
      const res = await fetch('/api/admin/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authToken: session.access_token, filterDays }),
      });

      const body = await res.json();
      console.log('[TRANSCRIPTS_DEBUG] status:', res.status, 'body keys:', Object.keys(body), 'messages count:', body.messages?.length, 'profiles count:', body.profiles?.length, 'error:', body.error);

      if (!res.ok) {
        console.error('Failed to load transcripts:', res.status, body);
        setLoading(false);
        return;
      }

      const { profiles: profList, messages: msgList } = body;

      const profMap = {};
      for (const p of (profList || [])) {
        profMap[p.id] = p;
      }
      setProfiles(profMap);
      setMessages(msgList || []);
      setLoading(false);
    })();
  }, [router, filterDays]);

  // Build curator list: { profileId: { handle, name, count, lastDate } }
  const curatorList = useMemo(() => {
    const map = {};
    for (const msg of messages) {
      if (!map[msg.profile_id]) {
        const prof = profiles[msg.profile_id];
        map[msg.profile_id] = {
          profileId: msg.profile_id,
          handle: prof?.handle || 'unknown',
          name: prof?.name || '',
          count: 0,
          lastDate: msg.created_at,
        };
      }
      map[msg.profile_id].count++;
      if (msg.created_at > map[msg.profile_id].lastDate) {
        map[msg.profile_id].lastDate = msg.created_at;
      }
    }
    return Object.values(map).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
  }, [messages, profiles]);

  // Selected curator's messages (chronological)
  const transcript = useMemo(() => {
    if (!selectedCurator) return [];
    return messages
      .filter(m => m.profile_id === selectedCurator)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [messages, selectedCurator]);

  // Export as .txt
  function exportTranscript() {
    if (!transcript.length) return;
    const prof = profiles[selectedCurator];
    const handle = prof?.handle || 'unknown';
    const lines = transcript.map(m => {
      const role = m.role === 'user' ? handle : 'AI';
      const ts = formatDate(m.created_at);
      return `[${ts}] ${role}:\n${m.message || '(no content)'}\n`;
    });
    const text = `Transcript for @${handle}\nExported ${new Date().toISOString()}\n${'='.repeat(50)}\n\n${lines.join('\n')}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${handle}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authorized || loading) {
    return (
      <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: T.ink3, fontFamily: F, fontSize: 14 }}>
          {loading ? 'Loading...' : 'Redirecting...'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: `1px solid ${T.bdr}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h1 style={{ fontFamily: S, fontSize: 22, color: T.ink, fontWeight: 400, margin: 0 }}>
          Transcripts
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {DATE_FILTERS.map(f => (
            <button
              key={f.label}
              onClick={() => { setFilterDays(f.days); setSelectedCurator(null); }}
              style={{
                fontFamily: F, fontSize: 12, fontWeight: 600,
                padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${filterDays === f.days ? T.acc : T.bdr}`,
                background: filterDays === f.days ? T.accSoft : 'transparent',
                color: filterDays === f.days ? T.acc : T.ink3,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Sidebar */}
        <div style={{
          width: 280, borderRight: `1px solid ${T.bdr}`,
          overflowY: 'auto', flexShrink: 0,
        }}>
          {curatorList.length === 0 ? (
            <div style={{ padding: 24, color: T.ink3, fontFamily: F, fontSize: 13, textAlign: 'center' }}>
              No messages in this period.
            </div>
          ) : (
            curatorList.map(c => (
              <button
                key={c.profileId}
                onClick={() => setSelectedCurator(c.profileId)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '14px 16px', cursor: 'pointer',
                  border: 'none', borderBottom: `1px solid ${T.bdr}`,
                  background: selectedCurator === c.profileId ? T.s2 : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>
                    @{c.handle}
                  </span>
                  <span style={{ fontFamily: F, fontSize: 11, color: T.ink3 }}>
                    {formatShortDate(c.lastDate)}
                  </span>
                </div>
                <div style={{ fontFamily: F, fontSize: 11, color: T.ink3, marginTop: 4 }}>
                  {c.count} message{c.count !== 1 ? 's' : ''}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Transcript area */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {!selectedCurator ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.ink3, fontFamily: F, fontSize: 14,
            }}>
              Select a curator to view their transcript.
            </div>
          ) : (
            <>
              {/* Transcript header */}
              <div style={{
                padding: '14px 24px', borderBottom: `1px solid ${T.bdr}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: F, fontSize: 14, fontWeight: 600, color: T.ink }}>
                  @{profiles[selectedCurator]?.handle || 'unknown'}
                  <span style={{ fontWeight: 400, color: T.ink3, marginLeft: 8 }}>
                    {transcript.length} message{transcript.length !== 1 ? 's' : ''}
                  </span>
                </span>
                <button
                  onClick={exportTranscript}
                  style={{
                    fontFamily: F, fontSize: 12, fontWeight: 600,
                    padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${T.bdr}`, background: 'transparent', color: T.ink3,
                  }}
                >
                  Export .txt
                </button>
              </div>

              {/* Messages */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {transcript.map(msg => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={msg.id} style={{
                      display: 'flex', flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                    }}>
                      <div style={{
                        padding: '12px 16px', borderRadius: 14,
                        background: isUser ? T.acc : T.bg2,
                        border: isUser ? 'none' : `1px solid ${T.bdr}`,
                        color: isUser ? T.accText : T.ink,
                        fontFamily: F, fontSize: 14, lineHeight: 1.55,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {msg.message || '(no content)'}
                      </div>
                      <span style={{
                        fontFamily: F, fontSize: 10, color: T.ink3,
                        marginTop: 4, paddingLeft: 4, paddingRight: 4,
                      }}>
                        {isUser ? 'curator' : 'ai'} &middot; {formatDate(msg.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

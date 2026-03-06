'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const F = "'Manrope',sans-serif";
const S = "'Newsreader',serif";

export default function FeedbackAdmin() {
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data: prof } = await supabase
        .from('profiles')
        .select('handle')
        .eq('auth_user_id', user.id)
        .single();

      if (!prof || prof.handle !== 'shamal') {
        router.push('/myai');
        return;
      }

      setAuthorized(true);

      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load feedback:', error);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    })();
  }, [router]);

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
  };

  if (!authorized || loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#131210', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6B6258', fontFamily: F, fontSize: 14 }}>
          {loading ? 'Loading...' : 'Redirecting...'}
        </span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#131210', padding: '40px 20px' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <h1 style={{ fontFamily: S, fontSize: 24, color: '#E8E2D6', fontWeight: 400, margin: 0 }}>Feedback</h1>
          <span style={{ fontFamily: F, fontSize: 13, color: '#6B6258' }}>{rows.length} total</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6B6258', fontFamily: F, fontSize: 14 }}>
            No feedback yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {rows.map(row => (
              <div key={row.id} style={{
                padding: 20, borderRadius: 14, border: '1px solid #302B25',
                background: '#1A1714',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: F, fontSize: 14, fontWeight: 700, color: '#E8E2D6' }}>
                      @{row.handle}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, fontFamily: F,
                      background: row.status === 'reviewed' ? '#6BAA8E20' : '#D4956B20',
                      color: row.status === 'reviewed' ? '#6BAA8E' : '#D4956B',
                    }}>
                      {row.status}
                    </span>
                  </div>
                  <span style={{ fontFamily: F, fontSize: 11, color: '#6B6258' }}>
                    {formatDate(row.created_at)}
                  </span>
                </div>

                {row.summary && (
                  <div style={{ fontFamily: F, fontSize: 15, color: '#E8E2D6', lineHeight: 1.5, marginBottom: 10 }}>
                    {row.summary}
                  </div>
                )}

                {row.original_message && (
                  <div style={{ fontFamily: F, fontSize: 13, color: '#6B6258', lineHeight: 1.5, marginBottom: row.elaboration ? 6 : 0 }}>
                    {row.original_message}
                  </div>
                )}

                {row.elaboration && (
                  <div style={{ fontFamily: F, fontSize: 13, color: '#6B6258', lineHeight: 1.5 }}>
                    {row.elaboration}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

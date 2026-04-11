'use client'

import { useState } from "react";
import { T, F } from "@/lib/constants";

export default function FeedbackSheet({ isOpen, onClose, profileId, handle, isDesktop }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  function handleClose() {
    if (saving) return;
    if (text.trim() && !done) {
      if (!window.confirm('Discard feedback?')) return;
    }
    setText('');
    setError(null);
    setDone(false);
    onClose();
  }

  async function handleSubmit() {
    if (!text.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          handle,
          originalMessage: text.trim(),
          elaboration: null,
          summary: null,
        }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setDone(true);
      setTimeout(() => {
        setText('');
        setDone(false);
        onClose();
      }, 1200);
    } catch (e) {
      setError('Something went wrong. Try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const sheetStyle = isDesktop ? {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 480, maxHeight: '80vh',
    background: T.bg2, borderRadius: 16,
    padding: 24, zIndex: 1000,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    display: 'flex', flexDirection: 'column', gap: 16,
    fontFamily: F,
  } : {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: T.bg2, borderRadius: '16px 16px 0 0',
    padding: '20px 16px 32px',
    zIndex: 1000,
    display: 'flex', flexDirection: 'column', gap: 16,
    fontFamily: F,
    boxSizing: 'border-box',
    width: '100%',
  };

  return (
    <>
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 999,
        }}
      />
      <div style={sheetStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: T.ink, fontSize: 15, fontWeight: 600 }}>Share feedback</span>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: T.ink3, cursor: 'pointer', fontSize: 20, padding: 0, fontFamily: F }}
          >×</button>
        </div>

        {done ? (
          <div style={{ color: T.acc, fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
            Thanks — got it.
          </div>
        ) : (
          <>
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="What's on your mind? Bug, idea, reaction — anything."
              style={{
                background: T.bg,
                border: `1px solid ${T.bdr}`,
                borderRadius: 10,
                padding: '12px 14px',
                color: T.ink,
                fontSize: 14,
                fontFamily: F,
                resize: 'none',
                minHeight: 120,
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{ color: '#e05c5c', fontSize: 12 }}>{error}</div>
            )}
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || saving}
              style={{
                background: text.trim() && !saving ? T.acc : T.s2,
                color: text.trim() && !saving ? '#fff' : T.ink3,
                border: 'none',
                borderRadius: 10,
                padding: '12px 0',
                fontSize: 14,
                fontWeight: 600,
                cursor: text.trim() && !saving ? 'pointer' : 'not-allowed',
                fontFamily: F,
                transition: 'background 150ms ease',
              }}
            >
              {saving ? 'Sending...' : 'Send feedback'}
            </button>
          </>
        )}
      </div>
    </>
  );
}

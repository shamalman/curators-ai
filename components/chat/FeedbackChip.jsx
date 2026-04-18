'use client'

import { T, F } from "@/lib/constants";

export default function FeedbackChip({ visible, onTap }) {
  return (
    <button
      onClick={onTap}
      style={{
        background: 'transparent',
        border: `0.5px solid ${T.ink2}`,
        borderRadius: 999,
        padding: '6px 10px',
        color: T.ink2,
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: F,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 150ms ease',
        margin: 0,
        flexShrink: 0,
        boxSizing: 'border-box',
        WebkitAppearance: 'none',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={T.ink2} strokeWidth="2"
        style={{ width: 12, height: 12, flexShrink: 0 }}
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      Give Feedback
    </button>
  );
}

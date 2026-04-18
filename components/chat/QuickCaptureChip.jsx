'use client'

import { T, F } from "@/lib/constants";

export default function QuickCaptureChip({ visible, onTap }) {
  return (
    <button
      onClick={onTap}
      style={{
        background: 'transparent',
        border: `0.5px solid ${T.acc}`,
        borderRadius: 999,
        padding: '6px 10px',
        color: T.acc,
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
        maxWidth: '100%',
        boxSizing: 'border-box',
        WebkitAppearance: 'none',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke={T.acc}
        strokeWidth="2"
        style={{ width: 12, height: 12, flexShrink: 0 }}
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Recommend
    </button>
  );
}

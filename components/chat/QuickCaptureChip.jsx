'use client'

import { T, F } from "@/lib/constants";

export default function QuickCaptureChip({ visible, onTap }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap?.();
    }
  };

  return (
    <div
      role="button"
      tabIndex={visible ? 0 : -1}
      onClick={visible ? onTap : undefined}
      onKeyDown={visible ? handleKeyDown : undefined}
      aria-label="Recommend something great"
      aria-hidden={!visible}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'transparent',
        border: `0.5px solid ${T.acc}`,
        borderRadius: 999,
        padding: '6px 12px',
        color: T.acc,
        fontSize: 12,
        fontWeight: 500,
        cursor: visible ? 'pointer' : 'default',
        fontFamily: F,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 150ms ease',
        margin: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        WebkitAppearance: 'none',
        flexShrink: 0,
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
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
        aria-hidden="true"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      Recommend something great
    </div>
  );
}

"use client";

import { useState } from "react";
import { T } from "@/lib/constants";

// Renders up/down rating buttons for a single AI message. Staging-only —
// the parent decides whether to mount this at all.
//
// Props:
//   messageId: string (UUID of the chat_messages row)
//   initialRating: 'up' | 'down' | null
export default function AIResponseThumbs({ messageId, initialRating = null }) {
  const [rating, setRating] = useState(initialRating);
  const [pending, setPending] = useState(false);

  async function handleClick(next) {
    if (pending) return;
    const previous = rating;
    const toggled = rating === next ? null : next;
    setRating(toggled);
    setPending(true);

    try {
      if (toggled === null) {
        const res = await fetch("/api/ai-response-ratings", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId }),
        });
        if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      } else {
        const res = await fetch("/api/ai-response-ratings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message_id: messageId, rating: toggled }),
        });
        if (!res.ok) throw new Error(`Write failed: ${res.status}`);
      }
    } catch (err) {
      console.error("[AI_THUMBS_CLICK_ERROR]", err?.message || err);
      setRating(previous);
    } finally {
      setPending(false);
    }
  }

  const baseStyle = {
    background: "transparent",
    border: "none",
    cursor: pending ? "default" : "pointer",
    padding: "4px 6px",
    fontSize: "14px",
    lineHeight: 1,
    color: T.ink,
    opacity: pending ? 0.4 : 0.5,
    transition: "opacity 120ms ease",
  };

  const activeStyle = { opacity: 1 };

  return (
    <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>
      <button
        type="button"
        onClick={() => handleClick("up")}
        style={{ ...baseStyle, ...(rating === "up" ? activeStyle : {}) }}
        aria-label="Good response"
        aria-pressed={rating === "up"}
      >
        ▲
      </button>
      <button
        type="button"
        onClick={() => handleClick("down")}
        style={{ ...baseStyle, ...(rating === "down" ? activeStyle : {}) }}
        aria-label="Bad response"
        aria-pressed={rating === "down"}
      >
        ▼
      </button>
    </div>
  );
}

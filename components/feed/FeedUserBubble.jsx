'use client'

import { W, F } from "@/lib/constants";

export default function FeedUserBubble({ text, imagePreview }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
      <div style={{
        maxWidth: "75%",
        padding: "12px 16px",
        borderRadius: "20px 20px 6px 20px",
        background: W.userBub,
        color: W.userTxt,
        fontSize: 14.5,
        fontFamily: F,
        fontWeight: 500,
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}>
        {imagePreview && (
          <img src={imagePreview} alt="" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 12, marginBottom: text ? 8 : 0, display: "block" }} />
        )}
        {text}
      </div>
    </div>
  );
}

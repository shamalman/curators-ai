'use client'

import FeedUserBubble from "./FeedUserBubble";
import FeedBlockGroup from "./FeedBlockGroup";
import FeedLegacyBubble from "./FeedLegacyBubble";

export default function FeedRenderer({ messages, onSendMessage, onInteraction, renderCaptureUI }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {messages.map((msg, i) => {
        if (msg.role === 'user') {
          return (
            <div key={i} className="fu" style={{ animationDelay: `${i * .03}s` }}>
              <FeedUserBubble text={msg.text} imagePreview={msg.imagePreview} />
            </div>
          );
        }

        // Assistant message with blocks → render via block components
        if (msg.role === 'ai' && msg.blocks && msg.blocks.length > 0) {
          return (
            <div key={i} className="fu" style={{ animationDelay: `${i * .03}s` }}>
              <FeedBlockGroup
                blocks={msg.blocks}
                interactions={msg.interactions || []}
                messageId={msg.id}
                onSendMessage={onSendMessage}
                onInteraction={onInteraction}
              />
              {renderCaptureUI && renderCaptureUI(msg, i)}
            </div>
          );
        }

        // Legacy fallback — no blocks, render old-style bubble
        if (msg.role === 'ai') {
          return (
            <div key={i} className="fu" style={{ animationDelay: `${i * .03}s` }}>
              <FeedLegacyBubble text={msg.text} imagePreview={msg.imagePreview} />
              {renderCaptureUI && renderCaptureUI(msg, i)}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

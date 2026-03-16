'use client'

import FeedTextBlock from "./FeedTextBlock";
import FeedMediaEmbed from "./FeedMediaEmbed";
import FeedActionButtons from "./FeedActionButtons";

export default function FeedBlockGroup({ blocks, interactions, messageId, tapped, onSendMessage, onInteraction }) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <div style={{ padding: "4px 0", display: "flex", flexDirection: "column" }}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'text':
            return <FeedTextBlock key={i} data={block.data} />;
          case 'media_embed':
            return <FeedMediaEmbed key={i} data={block.data} />;
          case 'action_buttons': {
            const isUsed = tapped || (interactions || []).some(x => x.block_index === i);
            return (
              <FeedActionButtons
                key={i}
                data={block.data}
                used={isUsed}
                onUse={(option) => {
                  if (onInteraction) onInteraction(messageId, i, option.action);
                  if (onSendMessage) onSendMessage(option.action);
                }}
              />
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
}

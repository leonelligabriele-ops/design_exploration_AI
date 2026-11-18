import { useEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/tree.js';
import { renderInline } from './RichText.jsx';

// Reflective conversation about an idea and the person's data.
// Both sides question each other's thinking; the AI does not design.
export function Discussion({ node }) {
  const sendDiscussion = useTreeStore(s => s.sendDiscussion);
  const clearDiscussion = useTreeStore(s => s.clearDiscussion);
  const setUseDiscussion = useTreeStore(s => s.setUseDiscussion);
  const prototypeFromDiscussion = useTreeStore(s => s.prototypeFromDiscussion);
  const csvLoaded = useTreeStore(s => s.csvColumns.length > 0);

  const [draft, setDraft] = useState('');
  const threadRef = useRef(null);
  const inputRef = useRef(null);
  const messages = node.discussion || [];

  // Keep the newest message in view while the reply streams in.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, [node.id]);

  const send = () => {
    if (!draft.trim() || node.discussing) return;
    sendDiscussion(node.id, draft);
    setDraft('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="discuss">
      <div className="discuss-thread" ref={threadRef}>
        {messages.length === 0 ? (
          <div className="discuss-intro">
            <p>
              Talk about this card's idea and your data with the AI. It will explain how it reads them and
              question your assumptions — and you can question its thinking in return.
            </p>
            <p className="discuss-intro-note">
              {csvLoaded
                ? 'The AI can see your uploaded CSV: every row (very large files are thinned to evenly spaced rows).'
                : 'No CSV is loaded, so the AI can only discuss the idea itself. Upload a CSV to discuss your data too.'}
            </p>
          </div>
        ) : (
          messages.map((m, i) => {
            const streaming = node.discussing && i === messages.length - 1;
            const isError = m.role === 'assistant' && m.content.startsWith('Error:');
            return (
              <div key={i} className={`discuss-msg ${m.role === 'user' ? 'from-user' : 'from-ai'}${isError ? ' is-error' : ''}`}>
                <div className="discuss-who">{m.role === 'user' ? 'You' : 'AI'}</div>
                <div className="discuss-bubble">
                  {m.content ? renderInline(m.content) : (streaming ? <span className="discuss-typing"><i /><i /><i /></span> : '')}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="discuss-compose">
        <textarea
          ref={inputRef}
          className="discuss-input"
          rows={2}
          value={draft}
          placeholder="Share a thought, or respond to the AI…"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="discuss-actions">
          <button className="ne-send" onClick={send} disabled={!draft.trim() || node.discussing}>
            {node.discussing ? '…' : 'Send'}
          </button>
          <button
            className="discuss-proto-btn"
            onClick={() => prototypeFromDiscussion(node.id)}
            disabled={!messages.length || node.discussing || node.loading}
            title={node.code
              ? 'Build a new prototype from this discussion, as a new card. The current one stays as it is.'
              : 'Build this card’s prototype from the discussion.'}
          >
            {node.loading ? 'Building…' : 'Prototype it'}
          </button>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="discuss-footer">
          <label className="discuss-use" title="When on, this conversation is given to the AI as background when you press Generate">
            <input
              type="checkbox"
              checked={node.useDiscussion !== false}
              onChange={e => setUseDiscussion(node.id, e.target.checked)}
            />
            Use this discussion when generating
          </label>
          <button
            className="discuss-clear"
            disabled={node.discussing}
            onClick={() => { if (window.confirm('Clear this discussion?')) clearDiscussion(node.id); }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}

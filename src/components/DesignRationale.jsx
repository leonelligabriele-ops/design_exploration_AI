import { useEffect } from 'react';
import { useTreeStore, builtStageOf } from '../store/tree.js';
import { renderInline } from './RichText.jsx';

// Renders the AI's free-form explanation: paragraphs and **bold**, with simple
// markdown headings or bullets shown without their symbols.
function renderText(text) {
  return text.split('\n').filter(l => l.trim()).map((line, i) => {
    // Strip a heading marker or a list bullet ("- ", "• ", "* "), keep bold and italic.
    const clean = line.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*(?:[-•]|\*(?=\s))\s*/, '');
    return <p key={i}>{renderInline(clean)}</p>;
  });
}

// "Why this design?" — the AI explains the decisions behind this card's prototype.
export function DesignRationale({ node }) {
  const explainDesign = useTreeStore(s => s.explainDesign);
  const r = node.rationale;
  // Sketches get back-talk: what the sketch shows, not why it was made so.
  const kind = builtStageOf(node) === 'sketch' ? 'backtalk' : 'why';
  const stale = r && !r.loading && (r.kind || 'why') !== kind;

  // Ask the first time the card is opened for a prototype (or when the card
  // still holds the other kind of text).
  useEffect(() => {
    if (node.code && (!r || stale) && !node.loading) explainDesign(node.id);
  }, [node.id, node.code, r, stale, node.loading, explainDesign]);

  return (
    <div className="why">
      <div className="why-body">
        {!node.code ? (
          <p className="why-empty">Generate a prototype first. The AI will then {kind === 'backtalk' ? 'say what it shows' : 'explain its thinking behind it'} here.</p>
        ) : node.loading ? (
          <p className="why-empty">A new version is being made. {kind === 'backtalk' ? 'What it shows' : 'Its explanation'} will follow.</p>
        ) : r?.error ? (
          <p className="why-error">Could not get a reply: {r.error}</p>
        ) : r?.text ? (
          renderText(r.text)
        ) : (
          <span className="discuss-typing"><i /><i /><i /></span>
        )}
      </div>
      {node.code && !node.loading && (
        <div className="why-footer">
          <span />
          <button className="discuss-clear" disabled={r?.loading} onClick={() => explainDesign(node.id)}>
            {kind === 'backtalk' ? 'Look again' : 'Explain again'}
          </button>
        </div>
      )}
    </div>
  );
}

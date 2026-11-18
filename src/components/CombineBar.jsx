import { useEffect, useState } from 'react';
import { useTreeStore } from '../store/tree.js';

// Shown while choosing cards to combine. Cards are picked on the canvas.
export function CombineBar() {
  const selection = useTreeStore(s => s.combineSelection);
  const nodes = useTreeStore(s => s.nodes);
  const cancelCombine = useTreeStore(s => s.cancelCombine);
  const combineNodes = useTreeStore(s => s.combineNodes);
  const [focus, setFocus] = useState('');

  const picked = selection.map(id => nodes.find(n => n.id === id)).filter(Boolean);
  const canCombine = picked.length >= 2;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancelCombine(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelCombine]);

  return (
    <div className="combine-bar" onPointerDown={e => e.stopPropagation()}>
      <div className="combine-bar-top">
        <span className="combine-bar-title">Combine prototypes</span>
        <span className="combine-bar-hint">
          {picked.length === 0
            ? 'Click the cards you want to combine (cards with a preview).'
            : `${picked.length} selected: ${picked.map(n => n.title || 'Untitled idea').join(', ')}`}
        </span>
      </div>
      <div className="combine-bar-row">
        <input
          className="combine-focus"
          value={focus}
          placeholder="Anything to focus on? (optional)"
          onChange={e => setFocus(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && canCombine) combineNodes(focus); }}
        />
        <button className="combine-cancel" onClick={cancelCombine}>Cancel</button>
        <button className="ne-send" disabled={!canCombine} onClick={() => combineNodes(focus)}>
          {canCombine ? `Combine ${picked.length} cards` : 'Select at least 2'}
        </button>
      </div>
    </div>
  );
}

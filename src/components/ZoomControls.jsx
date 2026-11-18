import { useTreeStore } from '../store/tree.js';
import { zoomAt, fitView } from '../store/view.js';

// Floating tools on the right edge of the canvas: Combine, then zoom.
export function ZoomControls() {
  const view = useTreeStore(s => s.view);
  const viewport = useTreeStore(s => s.viewport);
  const nodes = useTreeStore(s => s.nodes);
  const setView = useTreeStore(s => s.setView);
  const combineMode = useTreeStore(s => s.combineMode);
  const startCombine = useTreeStore(s => s.startCombine);
  const cancelCombine = useTreeStore(s => s.cancelCombine);
  const prototypeCount = nodes.filter(n => n.code).length;

  const zoomBy = (factor) => setView(v => zoomAt(v, v.scale * factor, viewport.w / 2, viewport.h / 2));
  const reset = () => setView(v => zoomAt(v, 1, viewport.w / 2, viewport.h / 2));

  return (
    <div className="canvas-tools" data-tour="tools" onPointerDown={e => e.stopPropagation()}>
      <button
        className={`combine-btn${combineMode ? ' active' : ''}`}
        data-tour="combine"
        onClick={combineMode ? cancelCombine : startCombine}
        disabled={!combineMode && prototypeCount < 2}
        title={prototypeCount < 2 ? 'Combine: needs at least 2 cards with a preview' : 'Combine prototypes into a new card'}
        aria-label="Combine prototypes"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 4v4a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4v4M19 4v4a4 4 0 0 1-4 4M12 12v8" />
          <path d="M9 17l3 3 3-3" />
        </svg>
        <span>Combine</span>
      </button>

      <div className="zoom-controls">
        <button onClick={() => zoomBy(1.2)} title="Zoom in (+)" aria-label="Zoom in">+</button>
        <button className="zoom-level" onClick={reset} title="Reset to 100%">
          {Math.round(view.scale * 100)}%
        </button>
        <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out (−)" aria-label="Zoom out">−</button>
        <button
          className="zoom-fit"
          onClick={() => setView(fitView(nodes, viewport))}
          disabled={!nodes.length}
          title="Show all ideas (0)"
          aria-label="Fit all ideas on screen"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

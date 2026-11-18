import { useEffect, useRef, useState } from 'react';
import { STAGES, STAGE_LIST } from '../store/tree.js';

export const STAGE_DESCRIPTIONS = {
  sketch: 'A rough, greyscale first version of the idea',
  explore: 'Tries new ways to show and use the data',
  refine: 'A polished, near-final app',
};

// The stage badge. Clicking it opens a menu to switch stage.
export function StagePicker({ stage, onChange, onOpenChange, tourId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const info = STAGES[stage] || STAGES.sketch;

  const toggle = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) toggle(false); };
    const onKey = (e) => { if (e.key === 'Escape') toggle(false); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className="stage-picker" ref={ref}>
      <button
        className={`stage-badge stage-${stage}${open ? ' open' : ''}`}
        data-tour={tourId}
        onClick={(e) => { e.stopPropagation(); toggle(!open); }}
        title="Click to change the stage"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {info.label}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="stage-menu" role="menu" onClick={e => e.stopPropagation()}>
          <div className="stage-menu-title">Change stage</div>
          {STAGE_LIST.map(s => (
            <button
              key={s}
              role="menuitemradio"
              aria-checked={s === stage}
              className={`stage-option${s === stage ? ' current' : ''}`}
              onClick={() => { onChange(s); toggle(false); }}
            >
              <span className="stage-option-dot" style={{ background: STAGES[s].border }} />
              <span className="stage-option-text">
                <span className="stage-option-name">{STAGES[s].label}</span>
                <span className="stage-option-desc">{STAGE_DESCRIPTIONS[s]}</span>
              </span>
              {s === stage && <span className="stage-option-check">✓</span>}
            </button>
          ))}
          <div className="stage-menu-note">The new stage is used the next time you press Generate.</div>
        </div>
      )}
    </span>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/tree.js';
import { ModelToggle } from './ModelToggle.jsx';

// Settings: things people making prototypes do not need in front of them,
// such as which AI is used. Demo mode stays visible, because its results are
// placeholders rather than real prototypes.
export function SettingsMenu() {
  const provider = useTreeStore(s => s.provider);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="settings" ref={ref}>
      {provider === 'demo' && (
        <span className="settings-demo" title="Results are placeholders, not made by AI. Change this in Settings.">
          Demo mode · no AI
        </span>
      )}
      <button
        className={`settings-btn${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        Settings
      </button>
      {open && (
        <div className="settings-menu" role="dialog" aria-label="Settings">
          <div className="settings-title">AI that makes the prototypes</div>
          <ModelToggle />
          <p className="settings-note">
            Claude makes real prototypes. Demo gives instant placeholders with no AI, for trying out the tool.
            Ollama uses an AI model on your own computer.
          </p>
        </div>
      )}
    </div>
  );
}

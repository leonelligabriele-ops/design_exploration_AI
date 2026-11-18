import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTreeStore } from '../store/tree.js';

// Two-part guided tour. Part 1 runs on the first visit and leads up to the
// first Generate; part 2 runs once the first prototype is ready. Each step
// highlights an element marked with data-tour="…". Skip ends the whole tour;
// the Tutorial button in the toolbar replays it.

const START = [
  {
    title: 'Welcome',
    body: 'This tool helps you explore ideas for apps that use your own biodata. You describe an idea, and the AI turns it into a working prototype you can test with your data. This short tour shows you how to get started.',
  },
  {
    target: 'data', title: 'Upload your data',
    body: 'Upload your biodata as a CSV file. Every prototype gets your whole dataset and decides how to show it. You can replace or remove the file here at any time, and uploading is optional.',
  },
  {
    target: 'tools', title: 'Moving around',
    body: 'Drag the empty background to move around, and scroll to zoom. These buttons zoom in and out and fit all your ideas on screen. Combine merges prototypes — more about that later.',
  },
  {
    target: 'new-idea', title: 'Start a new idea', waitFor: 'card',
    body: 'Each idea is a card on the canvas. Click New idea to create your first one.',
  },
  {
    target: 'stage', needsCard: true, title: 'Stages: how finished the prototype is',
    body: 'Every card has a stage, shown by the coloured badge at the top of the card. The stage decides what kind of prototype the AI makes:',
    list: [
      ['Sketch', 'a rough, hand-drawn first version that shows your idea in the form it takes: a screen, a scene, an object, a sequence…'],
      ['Explore', 'tries new ways to show and use the data'],
      ['Refine', 'a polished, near-final app'],
    ],
    after: 'To change the stage, click the badge (it says “Sketch ▾”) and pick another stage from the menu. You can do the same at the top of the open card. New ideas start as Sketch, and the new stage is used the next time you press Generate.',
  },
  {
    target: 'prompt', needsCard: true, title: 'Describe your idea',
    body: 'Write what the app should do, in your own words: what it should show or do, and for whom.',
  },
  {
    target: 'discuss', needsCard: true, title: 'Discuss it',
    body: 'Want to think the idea through first? Discuss opens a conversation with the AI on the right. It shares how it reads your idea and your data, and questions your assumptions — and you can question it back. Prototype it turns the discussion into a prototype.',
  },
  {
    target: 'generate', needsCard: true, title: 'Generate',
    body: 'When you are ready, press Generate. Your prototype appears right here, running on your data. The tour continues when your first prototype is ready.',
    last: 'Got it',
  },
];

const NEXT = [
  {
    target: 'preview', needsCard: true, title: 'Your first prototype',
    body: 'This is a working prototype built from your idea and your data. You can click and try things inside it. Restart starts it again from the beginning, and Full screen shows it on the whole screen. Your description and the next steps are in the bar underneath.',
  },
  {
    target: 'why', needsCard: true, title: 'What does it show? / Why this design?',
    body: 'For a sketch, the AI tells you what the sketch reveals about your idea and your data, and what it leaves open. This opens by itself when a sketch is ready. In later stages the same button is “Why this design?”, where the AI explains its own thinking.',
  },
  {
    target: 'discuss', needsCard: true, title: 'Discuss',
    body: 'Talk about this prototype and your data with the AI. Prototype it turns the discussion into a new version, as a new card.',
  },
  {
    target: 'variations', needsCard: true, title: 'Explore variations',
    body: 'Makes three new versions of this idea at once, as new cards below this one. In the Explore stage they rethink how the data is shown, how it is used, and what it means.',
  },
  {
    target: 'develop', needsCard: true, title: 'Develop in the next stage',
    body: 'Takes this prototype to the next stage — Sketch, then Explore, then Refine — as a new card. Nothing is overwritten.',
  },
  {
    target: 'branch', needsCard: true, title: 'Branch by hand',
    body: 'The + under a card starts a new version of it that you write yourself.',
  },
  {
    target: 'combine', title: 'Combine',
    body: 'Once you have two or more prototypes, Combine lets you select them on the canvas and merge them into one new card. You can add something to focus on.',
  },
  {
    target: 'file', title: 'Save and open',
    body: 'Save gives you one file with all your work. Open it in a web browser to read it and try every prototype, or open it here with Open to keep working where you left off.',
    last: 'Finish',
  },
];

const PARTS = { start: START, next: NEXT };
const DONE_KEY = { start: 'biosketch.tour.start.done', next: 'biosketch.tour.next.done' };

function isDone(part) {
  try { return localStorage.getItem(DONE_KEY[part]) === '1'; } catch { return false; }
}
function setDone(part, done) {
  try {
    if (done) localStorage.setItem(DONE_KEY[part], '1');
    else localStorage.removeItem(DONE_KEY[part]);
  } catch { /* storage unavailable: the tour simply shows again next time */ }
}

const TIP_W = 440;
const GAP = 14;

export function Tour() {
  const nodes = useTreeStore(s => s.nodes);
  const selectedId = useTreeStore(s => s.selectedId);
  const select = useTreeStore(s => s.select);
  const addRoot = useTreeStore(s => s.addRoot);
  const tourRun = useTreeStore(s => s.tourRun);

  const [part, setPart] = useState(null);   // 'start' | 'next' | null
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [tipH, setTipH] = useState(200);
  const tipRef = useRef(null);

  const steps = part ? PARTS[part] : [];
  const step = steps[index];
  const readyNode = nodes.find(n => n.code && !n.loading);

  // First visit: part 1.
  useEffect(() => { if (!isDone('start')) setPart('start'); }, []);

  // Tutorial button: replay from the beginning.
  useEffect(() => {
    if (!tourRun) return;
    setDone('start', false);
    setDone('next', false);
    setIndex(0);
    setPart('start');
  }, [tourRun]);

  // Part 2 starts once part 1 is over and a prototype is ready.
  useEffect(() => {
    if (!readyNode) return;
    if (part === 'start' && index === START.length - 1) finish();
    if (part === null && isDone('start') && !isDone('next')) {
      select(readyNode.id);
      const t = setTimeout(() => { setIndex(0); setPart('next'); }, 800);
      return () => clearTimeout(t);
    }
  }, [!!readyNode, part]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Start a new idea" moves on by itself once a card is open.
  useEffect(() => {
    if (step?.waitFor === 'card' && selectedId) setIndex(i => i + 1);
  }, [step, selectedId]);

  // Steps inside a card need that card open.
  useEffect(() => {
    if (!step?.needsCard || selectedId || !nodes.length) return;
    const card = part === 'next' ? (readyNode || nodes[nodes.length - 1]) : nodes[nodes.length - 1];
    select(card.id);
  }, [step, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the highlighted element as the canvas moves.
  useEffect(() => {
    if (!step) return;
    const measure = () => {
      const el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setRect(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    const id = setInterval(measure, 200);
    return () => clearInterval(id);
  }, [step]);

  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  });

  useEffect(() => {
    if (!part) return;
    const onKey = (e) => { if (e.key === 'Escape') skip(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function finish() {
    setDone(part, true);
    setPart(null);
    setIndex(0);
  }
  function skip() {
    setDone('start', true);
    setDone('next', true);
    setPart(null);
    setIndex(0);
  }

  if (!step) return null;

  const isLast = index === steps.length - 1;
  const waiting = step.waitFor === 'card' && !selectedId;
  const pad = 6;
  const hl = rect && {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  };
  const tipStyle = placeTip(hl, tipH);

  return (
    <div className="tour" role="dialog" aria-label="Tutorial">
      {hl ? <div className="tour-spot" style={hl} /> : <div className="tour-dim" />}
      <div className="tour-tip" ref={tipRef} style={tipStyle}>
        <div className="tour-progress">
          {part === 'start' ? 'Getting started' : 'Next steps'} · {index + 1} of {steps.length}
        </div>
        <div className="tour-title">{step.title}</div>
        <p className="tour-body">{step.body}</p>
        {step.list && (
          <ul className="tour-list">
            {step.list.map(([name, text]) => (
              <li key={name}><strong>{name}</strong> — {text}</li>
            ))}
          </ul>
        )}
        {step.after && <p className="tour-body">{step.after}</p>}
        <div className="tour-actions">
          <button className="tour-skip" onClick={skip}>Skip tutorial</button>
          <div className="tour-nav">
            {index > 0 && !waiting && (
              <button className="tour-back" onClick={() => setIndex(index - 1)}>Back</button>
            )}
            {waiting ? (
              <button className="tour-next" onClick={addRoot}>Create one for me</button>
            ) : (
              <button className="tour-next" onClick={() => (isLast ? finish() : setIndex(index + 1))}>
                {isLast ? step.last || 'Done' : 'Next'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Put the tooltip beside the highlighted element: right, left, below, above,
// or centred when nothing is highlighted or nothing fits.
function placeTip(hl, h) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (t) => Math.max(12, Math.min(t, vh - h - 12));
  const clampLeft = (l) => Math.max(12, Math.min(l, vw - TIP_W - 12));
  if (!hl) return { top: clampTop((vh - h) / 2), left: clampLeft((vw - TIP_W) / 2) };
  if (hl.left + hl.width + GAP + TIP_W < vw - 12) return { top: clampTop(hl.top), left: hl.left + hl.width + GAP };
  if (hl.left - GAP - TIP_W > 12) return { top: clampTop(hl.top), left: hl.left - GAP - TIP_W };
  if (hl.top + hl.height + GAP + h < vh - 12) return { top: hl.top + hl.height + GAP, left: clampLeft(hl.left) };
  if (hl.top - GAP - h > 12) return { top: hl.top - GAP - h, left: clampLeft(hl.left) };
  return { top: vh - h - 24, left: clampLeft((vw - TIP_W) / 2) };
}

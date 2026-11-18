import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTreeStore, STAGES, STAGE_LIST, builtStageOf, extractCode } from '../store/tree.js';
import { withSketchLook } from '../sketchLook.js';
import { Discussion } from './Discussion.jsx';
import { DesignRationale } from './DesignRationale.jsx';
import { SideCard } from './SideCard.jsx';
import { StagePicker } from './StagePicker.jsx';
import { DataMode } from './DataMode.jsx';
import { deliverTo } from '../datalayer/playback.js';

// Error handler — injected FIRST so it catches all script errors.
// Reports errors to parent via postMessage.
const ERROR_SCRIPT = `<script>
window.onerror=function(msg,src,line){
window.parent.postMessage({type:'__iframe_error',msg:msg,line:line},'*');
};
<\/script>`;

// Bridge — injected LAST so user's onBioframe is already defined.
const BRIDGE_SCRIPT = `<script>
window.latestBioframe=null;
window.addEventListener('message',function(e){
if(e.data&&e.data.type==='bioframe'){
window.latestBioframe=e.data;
if(typeof window.onBioframe==='function')window.onBioframe(e.data);
}
});
<\/script>`;

function injectScripts(code) {
  let html = code;
  // Error handler goes right after <head> or at the very start
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>' + ERROR_SCRIPT);
  } else if (html.includes('<html>')) {
    html = html.replace('<html>', '<html>' + ERROR_SCRIPT);
  } else {
    html = ERROR_SCRIPT + html;
  }
  // Bridge goes right before </body> or at the very end
  if (html.includes('</body>')) {
    html = html.replace('</body>', BRIDGE_SCRIPT + '</body>');
  } else if (html.includes('</html>')) {
    html = html.replace('</html>', BRIDGE_SCRIPT + '</html>');
  } else {
    html = html + BRIDGE_SCRIPT;
  }
  return html;
}

// A reply counts as code when a prototype can be taken out of it.
const responseHasCode = (response) => !!extractCode(response);

const NODE_CARD_W = 240;
const GAP = 16;
const MIN_PREVIEW_H = 380;   // a prototype always gets a generous area
const PROTO_PANEL_W = 720;   // panel width once there is a prototype (if the screen allows)
const MIN_PANEL_W = 420;
const SIDE_W = 380;
const FILL_MIN_H = 360;
const MIN_FIT = 0.7;           // a compromise: never shrink below this (still readable); scroll the rest
const FIT_WATCH_MS = 8000;   // keep fitting while the prototype builds its layout

// How much room a prototype needs. Elements stretched to the frame's height
// (100vh layouts, full-window canvases) take whatever size they are given,
// so they are skipped; the rest give the content's natural size. To tell a
// stretched element from one that just happens to be as tall as the frame,
// the frame is made taller for a moment: stretched elements grow with it.
// A prototype "fills" when it adapts to whatever frame it gets: nothing but
// stretched content, or a layout whose content moves down when the frame is
// made taller (a full-screen app). It is shown at full size, filling the room.
const PROBE_PX = 150;
function measureContent(doc, iframe) {
  const vw = iframe.clientWidth, vh = iframe.clientHeight;
  const sx = doc.defaultView.scrollX, sy = doc.defaultView.scrollY;
  let top = Infinity, bottom = 0, right = 0, fills = false, lastMargin = 0;
  const counted = [];
  const count = (r, el) => {
    counted.push(el);
    top = Math.min(top, r.top + sy);
    if (r.bottom + sy >= bottom) {
      lastMargin = r.bottom + sy > bottom ? 0 : lastMargin;
      lastMargin = Math.max(lastMargin, parseFloat(doc.defaultView.getComputedStyle(el).marginBottom) || 0);
    }
    bottom = Math.max(bottom, r.bottom + sy);
    right = Math.max(right, r.right + sx);
  };
  const tall = [];
  const els = doc.body.getElementsByTagName('*');
  for (let i = 0; i < els.length && i < 3000; i++) {
    const el = els[i];
    const tag = el.tagName.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || el.ownerSVGElement) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    if (r.height >= vh - 1) tall.push({ el, r, tag });
    else count(r, el);
  }
  {
    const before = iframe.style.cssText;
    const bottomBefore = bottom;
    iframe.style.flex = 'none';
    iframe.style.height = vh + PROBE_PX + 'px';
    // Does the content follow the frame? Then the layout fits any size.
    let bottomTaller = 0;
    for (const el of counted) bottomTaller = Math.max(bottomTaller, el.getBoundingClientRect().bottom + sy);
    if (bottomBefore && bottomTaller - bottomBefore > PROBE_PX * 0.5) {
      iframe.style.cssText = before;
      return { fills: true };
    }
    for (const { el, r, tag } of tall) {
      // Grows with the frame (CSS), or is exactly the frame's size (a script
      // sizing it to the window, e.g. canvas.height = innerHeight).
      const toWindow = Math.abs(r.height - vh) <= 1 && r.width >= vw * 0.9;
      if (toWindow || el.getBoundingClientRect().height > r.height + 1) {
        if (/^(CANVAS|SVG|VIDEO|IMG|IFRAME)$/.test(tag) && r.width >= vw * 0.5) fills = true;
      } else {
        count(r, el);
      }
    }
    iframe.style.cssText = before;
  }
  if (!bottom) return { fills: true };
  // Space under the content: the page's own bottom padding and margins, so
  // the prototype is shown to its real end.
  const cs = (el) => doc.defaultView.getComputedStyle(el);
  const below = parseFloat(cs(doc.body).paddingBottom) + parseFloat(cs(doc.body).marginBottom)
    + parseFloat(cs(doc.documentElement).paddingBottom) + lastMargin;
  // Content that starts near the top keeps its top space; content centred
  // in a tall page gets an even margin around it.
  const height = top <= 64 ? bottom + Math.max(8, below) : bottom - top + 64;
  return {
    fills,
    height: Math.ceil(height),
    width: right > vw + 2 ? Math.ceil(right + 16) : 0,
  };
}

// Shown while the AI is working, with the time passed so far.
function Waiting({ again }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="ne-wait" role="status">
      <div className="ne-wait-bar"><span /></div>
      <div className="ne-wait-title">{again ? 'Making the new version…' : 'Making your prototype…'}</div>
      <div className="ne-wait-text">This usually takes up to a minute. {seconds} s</div>
    </div>
  );
}

export function NodeExpanded({ node }) {
  const select = useTreeStore(s => s.select);
  const sendMsg = useTreeStore(s => s.sendMessage);
  const updatePrompt = useTreeStore(s => s.updatePrompt);
  const updateSketch = useTreeStore(s => s.updateSketch);
  const multiGenerate = useTreeStore(s => s.multiGenerate);
  const setNodeShape = useTreeStore(s => s.setNodeShape);
  const csvFileName = useTreeStore(s => s.csvFileName);
  const renameNode = useTreeStore(s => s.renameNode);
  const developNode = useTreeStore(s => s.developNode);
  const setStage = useTreeStore(s => s.setStage);


  const textareaRef = useRef(null);
  const iframeRef = useRef(null);
  const [iframeError, setIframeError] = useState(null);
  const [maximized, setMaximized] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);     // Restart: load the prototype again
  // A prototype taller than the space is scaled down so all of it is visible.
  // fit.h is its natural height; actualSize shows it at 100% with scrolling.
  const [fit, setFit] = useState({ scale: 1, h: null });
  const [actualSize, setActualSize] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false); // the slim description grows while typing
  // Card opened to the right of the panel: 'discuss' | 'why' | null
  const [side, setSide] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [size, setSize] = useState({ w: node.code ? 720 : 460, h: 580 });
  const panelRef = useRef(null);
  // Once the user drags the resize corner, stop auto-fitting to the preview.
  const userResized = useRef(false);
  const resizing = useRef(null);

  const stageInfo = STAGES[node.stage] || STAGES.sketch;
  const isSketchStage = (node.stage || 'sketch') === 'sketch';
  // A drawing alone is enough to generate from, and so is a card developed
  // from the previous stage (it builds on that stage's result).
  const canGenerate = !!(node.prompt.trim() || node.sketch || node.developedFrom || node.fromDiscussion || node.combinedFrom?.length);
  const nextStage = STAGE_LIST[STAGE_LIST.indexOf(node.stage || 'sketch') + 1];
  const discussionCount = (node.discussion || []).filter(m => m.role === 'user').length;
  // A sketch talks back ("What does it show?"); later stages explain themselves.
  const builtSketch = !!node.code && builtStageOf(node) === 'sketch';
  const sideTitle = builtSketch ? 'What does it show?' : 'Why this design?';

  // Build the full HTML with injected scripts.
  // useMemo so it only recomputes when code changes.
  const iframeHtml = useMemo(() => {
    if (!node.code) return null;
    const html = injectScripts(node.code);
    return builtSketch ? withSketchLook(html) : html;
  }, [node.code, builtSketch]);

  // When a sketch is ready, open its back-talk straight away: the sketch
  // talks back while the person is looking at it.
  const wasLoading = useRef(node.loading);
  useEffect(() => {
    if (wasLoading.current && !node.loading && builtSketch) setSide('why');
    wasLoading.current = node.loading;
  }, [node.loading, builtSketch]);

  // Focus prompt on open
  useEffect(() => {
    // preventScroll: the canvas moves by panning; scrolling it would push the panel off screen.
    if (textareaRef.current) textareaRef.current.focus({ preventScroll: true });
  }, [node.id]);

  // Listen for error messages from the iframe
  useEffect(() => {
    function onMessage(e) {
      if (e.data && e.data.type === '__iframe_error') {
        setIframeError(`Line ${e.data.line}: ${e.data.msg}`);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Esc leaves full screen
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e) => { if (e.key === 'Escape') setMaximized(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized]);

  // Clear error when code changes
  useEffect(() => {
    setIframeError(null);
  }, [node.code]);

  // Pan the canvas so the panel (and the side card, if open) is on screen.
  // The zoom controls sit on the right edge.
  const panIntoView = useCallback((w, h) => {
    const { view, viewport } = useTreeStore.getState();
    const left = node.x + NODE_CARD_W + GAP;
    const totalW = w + (side ? GAP + SIDE_W : 0);
    const sx = view.x + left * view.scale;
    const sy = view.y + node.y * view.scale;
    const right = sx + totalW * view.scale;
    const bottom = sy + h * view.scale;
    let dx = 0, dy = 0;
    if (right > viewport.w - 90) dx = viewport.w - 90 - right;
    if (sx + dx < 16) dx = 16 - sx;
    if (bottom > viewport.h - 16) dy = viewport.h - 16 - bottom;
    if (sy + dy < 16) dy = 16 - sy;
    if (dx || dy) useTreeStore.getState().setView(v => ({ ...v, x: v.x + dx, y: v.y + dy }));
  }, [node.x, node.y, side]);

  // Opening a side card: bring it into view (a prototype is fitted again below).
  useEffect(() => {
    if (side && !maximized && !node.code) panIntoView(size.w, size.h);
  }, [side]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new prototype gets fitted again, even if an earlier one was resized by hand.
  const zoomed = useRef(false);
  useEffect(() => {
    userResized.current = false;
    zoomed.current = false;
  }, [node.code]);

  // Resize the panel so the preview shows the whole prototype, limited to what
  // fits on screen, then pan the canvas so it is visible. While a prototype is
  // still building its layout only growing is allowed, so animations cannot
  // make the panel jitter.
  const fitToPreview = useCallback((allowShrink = true) => {
    if (userResized.current && !maximized) return;
    const iframe = iframeRef.current;
    const panel = panelRef.current;
    let doc;
    try { doc = iframe?.contentDocument; } catch { return; }
    if (!doc?.body || !panel) return;

    const state = useTreeStore.getState();
    const { viewport } = state;
    let { view } = state;
    // Height of everything in the panel except the preview. Measured on
    // screen, so undo the zoom it was measured at.
    const pr = panel.getBoundingClientRect();
    const ir = iframe.getBoundingClientRect();
    // Full screen sits outside the zoomable canvas, so it is never scaled.
    const k = maximized ? 1 : view.scale;
    const chromeH = ((ir.top - pr.top) + Math.max(0, pr.bottom - ir.bottom)) / k;
    const chromeW = panel.offsetWidth - iframe.clientWidth;

    // Scale to fit: the prototype keeps its own layout and is shown smaller
    // when it is taller than the room it has (it stays fully interactive).
    const fitInto = (avail, naturalH, fills) => {
      const scale = fills || actualSize || naturalH <= avail ? 1 : Math.max(MIN_FIT, avail / naturalH);
      setFit(f => (Math.abs(f.scale - scale) < 0.02 && Math.abs((f.h || 0) - (scale < 1 ? naturalH : 0)) < 8 && (f.h === null) === (scale === 1)
        ? f : { scale, h: scale < 1 ? naturalH : null }));
      return scale;
    };

    if (maximized) {
      const m = measureContent(doc, iframe);
      if (!m.fills) fitInto(window.innerHeight - chromeH, m.height, false);
      return;
    }

    // Zoomed out, a prototype is too small to read: zoom to 100% once,
    // keeping the panel's corner where it is on screen.
    if (!zoomed.current && view.scale < 0.95) {
      zoomed.current = true;
      const left = node.x + NODE_CARD_W + GAP;
      view = { x: view.x + left * view.scale - left, y: view.y + node.y * view.scale - node.y, scale: 1 };
      state.setView(view);
    }

    const sideW = side ? (GAP + SIDE_W) * view.scale : 0;
    const maxW = Math.max(360, (viewport.w - 140 - sideW) / view.scale);
    const maxH = Math.max(320, (viewport.h - 32) / view.scale);

    const m = measureContent(doc, iframe);
    const w = Math.min(maxW, Math.max(MIN_PANEL_W, PROTO_PANEL_W, m.width ? m.width + chromeW : panel.offsetWidth));
    // A prototype that adapts to its frame gets all the height there is.
    const previewH = m.fills ? Math.max(FILL_MIN_H, Math.round(maxH - chromeH)) : m.height;
    const scale = fitInto(maxH - chromeH, previewH, m.fills);
    const shown = scale < 1 ? previewH * scale : Math.max(previewH, MIN_PREVIEW_H);
    const next = { w, h: Math.min(maxH, Math.ceil(chromeH + shown)) };

    setSize(s => {
      const grow = next.w > s.w + 4 || next.h > s.h + 4;
      const shrink = allowShrink && (next.w < s.w - 12 || next.h < s.h - 12);
      if (!grow && !shrink) return s;
      return allowShrink ? next : { w: Math.max(s.w, next.w), h: Math.max(s.h, next.h) };
    });
    panIntoView(next.w, next.h);
  }, [maximized, panIntoView, side, node.x, node.y, actualSize]);

  // The watchers below outlive a render: they call the latest fitToPreview,
  // so a later switch (actual size, full screen) is not undone.
  const fitRef = useRef(fitToPreview);
  fitRef.current = fitToPreview;

  // Fit again when switching full screen or between fitted and actual size.
  useEffect(() => {
    if (!node.code) return;
    const t = setTimeout(() => fitToPreview(true), 60);
    return () => clearTimeout(t);
  }, [maximized, actualSize]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new prototype starts fitted again.
  useEffect(() => { setFit({ scale: 1, h: null }); setActualSize(false); }, [node.code]);

  // Prototypes build their layout over time (after the data arrives, after a
  // font loads), so keep measuring for a few seconds after loading.
  const stopWatching = useRef(null);
  useEffect(() => () => stopWatching.current?.(), []);
  const handleIframeLoad = useCallback(() => {
    stopWatching.current?.();
    deliverTo(iframeRef.current);
    fitRef.current(true);
    let doc, win;
    try { doc = iframeRef.current?.contentDocument; win = doc?.defaultView; } catch { return; }
    if (!doc?.body || !win) return;
    let pendingFit = null;
    const soon = () => { if (!pendingFit) pendingFit = setTimeout(() => { pendingFit = null; fitRef.current(false); }, 200); };
    const ro = new win.ResizeObserver(soon);
    ro.observe(doc.documentElement);
    ro.observe(doc.body);
    const mo = new win.MutationObserver(soon);
    mo.observe(doc.body, { childList: true, subtree: true, attributes: true, characterData: true });
    doc.fonts?.ready.then(soon);
    // Settled checks may also shrink the panel.
    const timers = [400, 1200, 3000].map(ms => setTimeout(() => fitRef.current(true), ms));
    const stop = () => {
      ro.disconnect();
      mo.disconnect();
      clearTimeout(pendingFit);
      timers.forEach(clearTimeout);
      clearTimeout(end);
      stopWatching.current = null;
    };
    const end = setTimeout(stop, FIT_WATCH_MS);
    stopWatching.current = stop;
  }, [fitToPreview]);

  // The side card takes room on screen: fit again when it opens or closes.
  useEffect(() => {
    if (node.code && iframeRef.current) fitToPreview(true);
  }, [side]); // eslint-disable-line react-hooks/exhaustive-deps

  const onResizeDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    userResized.current = true;
    resizing.current = { startX: e.clientX, startY: e.clientY, startW: size.w, startH: size.h };
    const onMove = (ev) => {
      if (!resizing.current) return;
      setSize({
        w: Math.max(320, resizing.current.startW + (ev.clientX - resizing.current.startX)),
        h: Math.max(300, resizing.current.startH + (ev.clientY - resizing.current.startY)),
      });
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [size]);


  const handleSend = () => {
    if (canGenerate) {
      sendMsg(node.id);
    }
  };

  const handleExplore = () => {
    if (canGenerate) {
      multiGenerate(node.id);
    }
  };

  const commitTitle = () => {
    renameNode(node.id, titleDraft);
    setEditingTitle(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const panelStyle = maximized
    ? { borderLeftColor: stageInfo.border, right: side ? SIDE_W : 0 }
    : {
        position: 'absolute',
        left: node.x + NODE_CARD_W + GAP,
        top: node.y,
        width: size.w,
        height: size.h,
        borderLeftColor: stageInfo.border,
      };

  // Should we show the response as text (no code was generated)?
  const showResponseText = node.response && !node.loading && !responseHasCode(node.response);

  const sideStyle = maximized
    ? undefined
    : {
        left: node.x + NODE_CARD_W + GAP + size.w + GAP,
        top: node.y,
        width: SIDE_W,
        height: Math.max(size.h, 460),
      };

  const hasProto = !!node.code;
  const failed = !node.loading && (node.response || '').startsWith('Error:');
  const promptPlaceholder = node.combinedFrom?.length ? 'Anything to focus on when combining? (optional)'
    : node.developedFrom ? 'Anything to focus on in this stage? (optional)'
    : 'Describe your idea: what should it show or do, and for whom?';

  // The data bar owns the CSV file picker.
  const uploadCsv = () => document.querySelector('.data-bar input[type=file]')?.click();

  // A drawing attached in an earlier session still goes to the AI; it can be
  // removed here. New drawings can no longer be made.
  const sketchBar = node.sketch ? (
    <div className="ne-sketch-preview">
      <img src={node.sketch} alt="sketch" className="ne-sketch-thumb" />
      <span className="ne-sketch-label">drawing attached</span>
      <button className="ne-sketch-btn" onClick={() => updateSketch(node.id, null)}>remove</button>
    </div>
  ) : null;

  const variationsBtn = (
    <button
      className="ne-explore"
      data-tour="variations"
      onClick={handleExplore}
      disabled={node.loading || !canGenerate}
      title="Three new versions of this idea, side by side"
    >
      Explore variations
    </button>
  );
  const generateBtn = (
    <button
      className="ne-send"
      data-tour="generate"
      onClick={handleSend}
      disabled={node.loading || !canGenerate}
    >
      {node.loading ? 'Working…' : 'Generate'}
    </button>
  );

  const content = (
    <>
    <div
      ref={panelRef}
      className={`node-expanded${maximized ? ' ne-maximized' : ''}`}
      style={panelStyle}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="ne-header">
        <StagePicker stage={node.stage || 'sketch'} onChange={(s) => setStage(node.id, s)} />
        {editingTitle ? (
          <input
            className="ne-title-input"
            value={titleDraft}
            autoFocus
            placeholder="Name this idea"
            onChange={e => setTitleDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <span
            className={`ne-title${node.title ? '' : ' placeholder'}`}
            onClick={() => { setTitleDraft(node.title); setEditingTitle(true); }}
            title="Click to rename"
          >
            {node.title || 'Untitled idea'}
            <svg className="ne-title-edit" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" />
            </svg>
          </span>
        )}
        <button
          className={`ne-side-btn${side === 'discuss' ? ' active' : ''}`}
          data-tour="discuss"
          onClick={() => setSide(side === 'discuss' ? null : 'discuss')}
          title="Discuss this card's idea and your data with the AI"
        >
          Discuss
          {discussionCount > 0 && <span className="ne-tab-count">{discussionCount}</span>}
        </button>
        {node.code && (
          <button
            className={`ne-side-btn${side === 'why' ? ' active' : ''}`}
            data-tour="why"
            onClick={() => setSide(side === 'why' ? null : 'why')}
            title={builtSketch
              ? 'The AI says what this sketch makes visible about your idea and data, and what it leaves open'
              : 'The AI explains why it designed this prototype the way it did'}
          >
            {sideTitle}
          </button>
        )}
        <button className="close-btn" onClick={() => select(null)}>×</button>
      </div>

      {/* Main content area. Before the first prototype: describe the idea.
          Once there is a prototype, it comes first and gets most of the room;
          the description and the actions sit in one slim bar under it. */}
      <div className="ne-main">
        {!hasProto && (
          <>
            {sketchBar && <div className="ne-sketch-bar">{sketchBar}</div>}
            <div className="ne-prompt-bar">
              <div className="ne-prompt-row">
                <textarea
                  ref={textareaRef}
                  className="ne-prompt"
                  data-tour="prompt"
                  placeholder={promptPlaceholder}
                  value={node.prompt}
                  onChange={e => updatePrompt(node.id, e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                />
                {variationsBtn}
                {generateBtn}
              </div>
            </div>
          </>
        )}

        {/* Play / pause for cards built for live replay (older sessions) */}
        <DataMode node={node} />

        {/* Above the prototype: what data it runs on, restart, full screen */}
        {hasProto && (
          <div className="ne-previewbar">
            <span className="ne-previewbar-status">
              {csvFileName
                ? <>Running on <b>{csvFileName}</b></>
                : <>No data yet. <button className="ne-link" onClick={uploadCsv}>Upload a CSV</button> to see it with your data.</>}
            </span>
            {(fit.scale < 1 || actualSize) && (
              <button
                className="ne-previewbar-btn ne-zoom-btn"
                onClick={() => setActualSize(!actualSize)}
                title={actualSize ? 'Shrink the prototype so all of it is visible' : 'Show the prototype at its real size (you will need to scroll)'}
              >
                {actualSize ? 'Fit to view' : `Shown at ${Math.round(fit.scale * 100)}% · Actual size`}
              </button>
            )}
            <button className="ne-previewbar-btn" onClick={() => setReloadKey(k => k + 1)} title="Start the prototype again from the beginning">
              Restart
            </button>
            <button className="ne-previewbar-btn" onClick={() => setMaximized(!maximized)} title={maximized ? 'Back to the canvas (Esc)' : 'Show the prototype on the whole screen'}>
              {maximized ? 'Exit full screen' : 'Full screen'}
            </button>
          </div>
        )}

        {/* The prototype */}
        {/* Scrolls only when a prototype is too tall to shrink enough */}
        <div className={`ne-output${fit.scale <= MIN_FIT + 0.001 ? ' ne-output-scroll' : ''}`} data-tour="preview">
          {failed && (
            <div className="ne-fail" role="alert">
              <div className="ne-fail-title">That didn’t work</div>
              <div className="ne-fail-text">
                The AI could not make this version{hasProto ? '. Your previous version is still here below' : ''}.
              </div>
              <button className="ne-send" onClick={handleSend} disabled={!canGenerate}>Try again</button>
              <details className="ne-fail-details"><summary>Technical details</summary>{node.response.replace(/^Error:\s*/, '')}</details>
            </div>
          )}
          {iframeError && !failed && (
            <div className="ne-error">Something inside this prototype is not working ({iframeError}). Press Generate to make it again.</div>
          )}
          {showResponseText && !failed && (
            <div className="ne-response-text">
              {node.response}
            </div>
          )}
          {iframeHtml ? (
            <div
              className={`ne-fitbox${fit.scale < 1 ? ' scaled' : ''}`}
              style={fit.scale < 1 ? { height: Math.ceil(fit.h * fit.scale) } : undefined}
            >
              <iframe
                key={reloadKey}
                ref={iframeRef}
                className="node-iframe"
                sandbox="allow-scripts allow-same-origin"
                srcDoc={iframeHtml}
                data-mode={(node.builtShape || node.shape) === 'timeseries' ? 'live' : 'dataset'}
                title="prototype"
                onLoad={handleIframeLoad}
                style={fit.scale < 1 ? { height: fit.h, transform: `translateX(-50%) scale(${fit.scale})` } : undefined}
              />
            </div>
          ) : node.loading ? (
            <Waiting />
          ) : !showResponseText && !failed ? (
            <div className="ne-empty">
              <svg className="ne-empty-icon" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="5" y="8" width="30" height="24" rx="4" />
                <path d="M5 14h30M10 11h.01M14 11h.01" />
              </svg>
              <div className="ne-empty-title">No prototype yet</div>
              <div className="ne-empty-text">
                {node.developedFrom
                  ? <>Press <b>Generate</b> to develop the previous {STAGES[STAGE_LIST[STAGE_LIST.indexOf(node.stage) - 1]]?.label.toLowerCase() || 'version'} in this stage. You can add a focus above first.</>
                  : <>Describe your idea above, then press <b>Generate</b> to see it working here.</>}
              </div>
            </div>
          ) : null}
          {/* A new version is being made: the current one stays visible underneath */}
          {hasProto && node.loading && <div className="ne-wait-over"><Waiting again /></div>}
        </div>

        {/* Under the prototype: the description and what to do next */}
        {hasProto && (
          <div className="ne-actionbar">
            <textarea
              ref={textareaRef}
              className="ne-prompt ne-prompt-slim"
              data-tour="prompt"
              placeholder="Describe your idea, or what to change, then press Generate"
              value={node.prompt}
              onChange={e => updatePrompt(node.id, e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setPromptOpen(true)}
              onBlur={() => setPromptOpen(false)}
              rows={promptOpen ? 3 : 1}
            />
            <div className="ne-actionbar-btns">
              {/* "What else?" is hidden; the store keeps whatElse so saved
                  sessions that used it still show and label those cards. */}
              {variationsBtn}
              {generateBtn}
              {nextStage && !node.loading && (
                <button
                  className={`ne-develop-btn stage-${nextStage}`}
                  data-tour="develop"
                  onClick={() => developNode(node.id)}
                  title={`Takes this ${stageInfo.label.toLowerCase()} to the next stage as a new card. This one stays as it is.`}
                >
                  Develop in {STAGES[nextStage].label} →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle — bottom-right corner */}
      {!maximized && (
        <div className="ne-resize-handle" onPointerDown={onResizeDown} />
      )}

    </div>

    {/* Side card to the right of the panel */}
    {side && (
      <SideCard
        title={side === 'discuss' ? 'Discuss' : sideTitle}
        onClose={() => setSide(null)}
        style={sideStyle}
        className={maximized ? 'side-card-max' : ''}
      >
        {side === 'discuss' ? <Discussion node={node} /> : <DesignRationale node={node} />}
      </SideCard>
    )}
    </>
  );

  // Maximized: render on the page itself. Inside the zoomable canvas,
  // "fixed" would be measured against the canvas instead of the window.
  return maximized ? createPortal(content, document.body) : content;
}

import { useRef, useCallback, useEffect, useState } from 'react';
import { useTreeStore } from '../store/tree.js';
import { zoomAt, fitView } from '../store/view.js';
import { NodeCard } from './NodeCard.jsx';
import { NodeExpanded } from './NodeExpanded.jsx';
import { Connectors } from './Connectors.jsx';
import { ZoomControls } from './ZoomControls.jsx';
import { CombineBar } from './CombineBar.jsx';

export function Canvas() {
  const nodes = useTreeStore(s => s.nodes);
  const selectedId = useTreeStore(s => s.selectedId);
  const select = useTreeStore(s => s.select);
  const addRoot = useTreeStore(s => s.addRoot);
  const view = useTreeStore(s => s.view);
  const setView = useTreeStore(s => s.setView);
  const setViewport = useTreeStore(s => s.setViewport);
  const combineMode = useTreeStore(s => s.combineMode);
  const containerRef = useRef(null);
  const innerRef = useRef(null);

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const selectedNode = nodes.find(n => n.id === selectedId);
  // The arrow label whose details are open, if any.
  const [openMove, setOpenMove] = useState(null);

  // Track the visible canvas size (used for fit-to-view and placing new cards).
  useEffect(() => {
    const el = containerRef.current;
    const ro = new ResizeObserver(() => setViewport({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [setViewport]);

  // Scroll wheel / trackpad pinch zooms toward the cursor. Registered natively
  // with passive:false so the browser page zoom can be prevented.
  useEffect(() => {
    const el = containerRef.current;
    const onWheel = (e) => {
      // Let the open editor panel scroll normally.
      if (e.target.closest('.node-expanded')) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setView(v => zoomAt(v, v.scale * factor, e.clientX - rect.left, e.clientY - rect.top));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setView]);

  // Keyboard: + / - to zoom, 0 to fit — ignored while typing.
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
      const { view: v, viewport, nodes: ns } = useTreeStore.getState();
      if (e.key === '+' || e.key === '=') setView(zoomAt(v, v.scale * 1.2, viewport.w / 2, viewport.h / 2));
      else if (e.key === '-') setView(zoomAt(v, v.scale / 1.2, viewport.w / 2, viewport.h / 2));
      else if (e.key === '0') setView(fitView(ns, viewport));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView]);

  const isBackground = (target) =>
    target === containerRef.current || target === innerRef.current;

  const handlePointerDown = useCallback((e) => {
    if (!isBackground(e.target)) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, px: view.x, py: view.y, moved: false };
    containerRef.current.classList.add('panning');
    containerRef.current.setPointerCapture(e.pointerId);
  }, [view.x, view.y]);

  const handlePointerMove = useCallback((e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) panStart.current.moved = true;
    setView(v => ({ ...v, x: panStart.current.px + dx, y: panStart.current.py + dy }));
  }, [setView]);

  const handlePointerUp = useCallback(() => {
    if (!isPanning.current) return;
    isPanning.current = false;
    containerRef.current.classList.remove('panning');
    // A click (not a drag) on empty canvas closes the open card and step details.
    if (!panStart.current.moved) {
      if (selectedId) select(null);
      setOpenMove(null);
    }
  }, [selectedId, select]);

  return (
    <div
      className={`canvas-area${combineMode ? ' combining' : ''}`}
      ref={containerRef}
      // The canvas moves by panning, never by scrolling. Browsers still
      // scroll it to reveal a focused field, which would offset everything.
      onScroll={e => { e.currentTarget.scrollTop = 0; e.currentTarget.scrollLeft = 0; }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="canvas-inner"
        ref={innerRef}
        style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}
      >
        <Connectors nodes={nodes} openKey={openMove} onOpen={setOpenMove} onSelect={select} />
        {nodes.map(node => (
          <NodeCard key={node.id} node={node} selected={node.id === selectedId} scale={view.scale} />
        ))}
        {selectedNode && (
          <NodeExpanded key={'exp-' + selectedNode.id} node={selectedNode} scale={view.scale} />
        )}
      </div>

      {nodes.length === 0 && (
        <div className="canvas-empty" onPointerDown={e => e.stopPropagation()}>
          <div className="canvas-empty-title">Start exploring</div>
          <div className="canvas-empty-text">
            Each card is one idea. Describe what your app should do, and a working preview is created for you.
          </div>
          <button className="canvas-empty-btn" onClick={addRoot}>+ New idea</button>
        </div>
      )}

      {combineMode && <CombineBar />}
      <ZoomControls />
    </div>
  );
}

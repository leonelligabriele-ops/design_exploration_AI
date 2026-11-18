import { useRef, useCallback, useState } from 'react';
import { useTreeStore, STAGES } from '../store/tree.js';
import { StagePicker } from './StagePicker.jsx';

export function NodeCard({ node, selected, scale }) {
  const select = useTreeStore(s => s.select);
  const combineMode = useTreeStore(s => s.combineMode);
  const combinePicked = useTreeStore(s => s.combineSelection.includes(node.id));
  const toggleCombineSelect = useTreeStore(s => s.toggleCombineSelect);
  const fork = useTreeStore(s => s.fork);
  const deleteNode = useTreeStore(s => s.deleteNode);
  const renameNode = useTreeStore(s => s.renameNode);
  const updateNodePosition = useTreeStore(s => s.updateNodePosition);
  const setStage = useTreeStore(s => s.setStage);
  const childCount = useTreeStore(s => s.nodes.filter(n => n.parentId === node.id).length);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [stageMenuOpen, setStageMenuOpen] = useState(false);


  const dragRef = useRef(null);
  const movedRef = useRef(false);
  const stage = node.stage || 'sketch';
  const stageInfo = STAGES[stage] || STAGES.sketch;

  const onPointerDown = useCallback((e) => {
    if (e.target.closest('button, input, .stage-picker, .node-add-handle')) return;
    e.stopPropagation();
    movedRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, nodeX: node.x, nodeY: node.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [node.x, node.y]);

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / scale;
    const dy = (e.clientY - dragRef.current.startY) / scale;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
    updateNodePosition(node.id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy);
  }, [node.id, scale, updateNodePosition]);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    const wasDrag = movedRef.current;
    dragRef.current = null;
    if (wasDrag) return;
    // While combining, a click picks the card (only cards with a preview).
    if (combineMode) { if (node.code) toggleCombineSelect(node.id); return; }
    select(node.id);
  }, [node.id, select, combineMode, node.code, toggleCombineSelect]);

  const startRename = (e) => {
    e.stopPropagation();
    setTitleDraft(node.title);
    setEditingTitle(true);
  };

  const commitRename = () => {
    renameNode(node.id, titleDraft);
    setEditingTitle(false);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    const what = childCount
      ? `Delete "${node.title || 'Untitled idea'}" and its ${childCount} branch${childCount > 1 ? 'es' : ''}?`
      : `Delete "${node.title || 'Untitled idea'}"?`;
    if ((node.code || childCount) && !window.confirm(what)) return;
    deleteNode(node.id);
  };

  const status = node.loading
    ? { cls: 'busy', text: 'Creating preview…' }
    : node.code
      ? { cls: 'ready', text: 'Preview ready' }
      : (node.prompt.trim() || node.sketch || node.developedFrom || node.fromDiscussion || node.combinedFrom?.length)
        ? { cls: 'draft', text: 'Ready to generate' }
        : { cls: 'empty', text: 'Not started' };

  return (
    <div
      className={`node-card${selected ? ' selected' : ''}${node.loading ? ' loading' : ''}${
        combineMode ? (node.code ? ' combine-pickable' : ' combine-disabled') : ''}${combinePicked ? ' combine-picked' : ''}`}
      style={{ left: node.x, top: node.y, borderTopColor: stageInfo.border, zIndex: stageMenuOpen ? 30 : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {combinePicked && <span className="combine-check" aria-label="Selected">✓</span>}
      <div className="node-top">
        <StagePicker
          stage={stage}
          onChange={(s) => setStage(node.id, s)}
          onOpenChange={setStageMenuOpen}
          tourId={selected ? 'stage' : undefined}
        />
        <button className="node-delete" onClick={handleDelete} title="Delete idea" aria-label="Delete idea">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4" />
          </svg>
        </button>
      </div>

      {editingTitle ? (
        <input
          className="node-title-input"
          value={titleDraft}
          autoFocus
          placeholder="Name this idea"
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') setEditingTitle(false);
          }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <div
          className={`node-title${node.title ? '' : ' placeholder'}`}
          onDoubleClick={startRename}
          title="Double-click to rename"
        >
          {node.title || 'Untitled idea'}
        </div>
      )}

      <div className={`node-preview${node.prompt.trim() ? '' : ' placeholder'}`}>
        {node.prompt.trim()
          || (node.combinedFrom?.length ? `Combined from ${node.combinedFrom.length} cards`
          : node.fromDiscussion ? 'Built from a discussion'
          : node.developedFrom ? 'Developed from the previous stage'
          : node.sketch ? 'Idea given as a drawing'
          : 'Click to describe what this app should do')}
      </div>

      <div className={`node-status ${status.cls}`}>
        <span className="node-status-dot" />
        {status.text}
      </div>

      <div
        data-tour={selected ? 'branch' : undefined}
        className="node-add-handle"
        onClick={e => { e.stopPropagation(); fork(node.id); }}
        title="Branch: try a new version of this idea"
      >
        <svg className="node-add-stem" width="2" height="16" viewBox="0 0 2 16">
          <line x1="1" y1="0" x2="1" y2="16" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
        <div className="node-add-circle">+</div>
      </div>
    </div>
  );
}

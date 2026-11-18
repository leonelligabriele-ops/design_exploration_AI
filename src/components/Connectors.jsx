import { STAGES } from '../store/tree.js';
import { moveOf, whenMade } from '../canvas/moves.js';

const NODE_W = 240;
const NODE_H = 160;

// The arrows between cards, each labelled with the move that made the next
// card (Develop, What else?, Keep / Change, a variation…). Clicking a label
// shows what the person asked for in that move, and when.
export function Connectors({ nodes, openKey, onOpen, onSelect }) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  // One arrow from a card to each branch, and one from every source card
  // into a combined card.
  const connectorData = nodes
    .flatMap(node => [node.parentId, ...(node.combinedFrom || [])]
      .filter(pid => pid && byId.has(pid))
      .map(pid => {
        const parent = byId.get(pid);
        const color = STAGES[node.stage]?.border || '#A89F96';
        const x1 = parent.x + NODE_W / 2, y1 = parent.y + NODE_H;
        const x2 = node.x + NODE_W / 2, y2 = node.y;
        return { key: `${pid}-${node.id}`, parent, node, color, x1, y1, x2, y2, move: moveOf(node, pid, byId) };
      }));

  const uniqueColors = [...new Set(connectorData.map(c => c.color))];
  const open = connectorData.find(c => c.key === openKey);

  return (
    <>
      <svg className="connectors-svg">
        <defs>
          {uniqueColors.map(color => (
            <marker
              key={color}
              id={`arrow-${color.replace('#', '')}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 8 5 L 0 8" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            </marker>
          ))}
        </defs>
        {connectorData.map(({ key, color, x1, y1, x2, y2 }) => {
          const my = (y1 + y2) / 2;
          return (
            <path
              key={key}
              d={`M${x1} ${y1} C${x1} ${my},${x2} ${my},${x2} ${y2}`}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
              opacity={0.6}
              markerEnd={`url(#arrow-${color.replace('#', '')})`}
            />
          );
        })}
      </svg>

      {/* The curve is symmetric, so its middle is the midpoint of its ends. */}
      {connectorData.map(({ key, color, x1, y1, x2, y2, move }) => (
        <button
          key={key}
          className={`move-label${openKey === key ? ' open' : ''}`}
          style={{ left: (x1 + x2) / 2, top: (y1 + y2) / 2, borderColor: color, color }}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onOpen(openKey === key ? null : key); }}
          title="What happened in this step"
        >
          {move.label}
        </button>
      ))}

      {open && (
        <div
          className="move-details"
          style={{ left: (open.x1 + open.x2) / 2 + 14, top: (open.y1 + open.y2) / 2 + 16, borderColor: open.color }}
          onPointerDown={e => e.stopPropagation()}
          role="dialog"
          aria-label={`Step: ${open.move.label}`}
        >
          <div className="move-details-head">
            <b style={{ color: open.color }}>{open.move.label}</b>
            <button className="move-details-close" onClick={() => onOpen(null)} aria-label="Close">×</button>
          </div>
          <div className="move-details-row"><span>From</span>{open.parent.title || 'Untitled idea'}</div>
          <div className="move-details-row"><span>To</span>{open.node.title || 'Untitled idea'}</div>
          <div className="move-details-row"><span>Asked</span>{open.move.asked}</div>
          <div className="move-details-row"><span>When</span>{whenMade(open.node)}</div>
          <button className="move-details-open" onClick={() => { onOpen(null); onSelect(open.node.id); }}>
            Open "{open.node.title || 'Untitled idea'}"
          </button>
        </div>
      )}
    </>
  );
}

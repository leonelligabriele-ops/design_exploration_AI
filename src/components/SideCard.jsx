// A card that opens to the right of the open idea panel (Discuss, Why this design?).
export function SideCard({ title, onClose, style, className = '', children }) {
  return (
    <div className={`side-card ${className}`} style={style} onClick={e => e.stopPropagation()}>
      <div className="side-card-header">
        <span className="side-card-title">{title}</span>
        <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="side-card-body">{children}</div>
    </div>
  );
}

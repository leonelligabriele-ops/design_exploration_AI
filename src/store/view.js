// Pure helpers for the canvas pan/zoom view: { x, y, scale }.
import { NODE_W } from './tree.js';

const MIN_SCALE = 0.2;
const MAX_SCALE = 2.5;
const NODE_H = 190;

export function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

// Zoom so that the point (cx, cy) in screen space stays fixed.
export function zoomAt(view, nextScale, cx, cy) {
  const scale = clampScale(nextScale);
  const k = scale / view.scale;
  return { scale, x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k };
}

// View that fits every card on screen, capped at 100% zoom.
export function fitView(nodes, viewport) {
  if (!nodes.length) return { x: 0, y: 0, scale: 1 };
  const pad = 80;
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const maxX = Math.max(...nodes.map(n => n.x + NODE_W));
  const maxY = Math.max(...nodes.map(n => n.y + NODE_H));
  const scale = clampScale(Math.min(
    1,
    (viewport.w - pad * 2) / (maxX - minX),
    (viewport.h - pad * 2) / (maxY - minY),
  ));
  return {
    scale,
    x: (viewport.w - (maxX - minX) * scale) / 2 - minX * scale,
    y: (viewport.h - (maxY - minY) * scale) / 2 - minY * scale,
  };
}

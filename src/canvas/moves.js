// What the canvas shows about the process: the move that made each card
// (labels on the arrows).
import { STAGES } from '../store/tree.js';

const KNOWN_VARIATIONS = ['Simpler', 'Richer', 'Unconventional', 'In use', 'Up close', 'Over time',
  'New representation', 'New interaction', 'New interpretation'];

const clean = (s) => s.replace(/^\[|\]$/g, '').replace(/^(Design variation|Sketch variation|Variation focus):\s*/, '');

// The move that made `node` from `fromId` (its parent, or one of the cards it
// was combined from): a short label for the arrow, and the details behind it.
export function moveOf(node, fromId, byId) {
  const from = byId.get(fromId);
  const focus = (empty) => (node.prompt.trim() ? `"${node.prompt.trim()}"` : empty);

  if (node.combinedFrom?.includes(fromId)) {
    return { label: 'Combine', asked: focus('No focus given: combine the selected cards.') };
  }
  if (node.origin === 'whatElse') {
    return { label: 'What else?', asked: 'A completely different approach to the same idea.' };
  }
  if (node.origin === 'keepChange') {
    return { label: 'Keep / Change', asked: node.prompt.replace(/\s*Generate an updated version of the current prototype\.?$/, '') };
  }
  if (node.origin === 'variation' || node.variation) {
    const named = KNOWN_VARIATIONS.includes(node.title) ? `: ${node.title}` : '';
    return { label: `Variation${named}`, asked: node.variation ? clean(node.variation) : 'One of three versions made at once.' };
  }
  if (node.developedFrom) {
    return { label: `Develop in ${STAGES[node.stage]?.label || 'next stage'}`, asked: focus('No focus given.') };
  }
  if (node.fromDiscussion && node.fromDiscussion === fromId) {
    const turns = (from?.discussion || []).filter(m => m.role === 'user').length;
    return { label: 'Prototype it', asked: `Built from the discussion on "${from?.title || 'Untitled idea'}" (${turns} message${turns === 1 ? '' : 's'} from the person).` };
  }
  return { label: 'Branch', asked: focus('Not described yet.') };
}

export function whenMade(node) {
  if (!node.promptLog?.at) return node.code ? 'Time not recorded' : 'Not generated yet';
  return new Date(node.promptLog.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

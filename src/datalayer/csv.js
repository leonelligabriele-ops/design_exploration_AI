import { setFrame } from './broadcast.js';

let rows = [];
let columnNames = [];
let index = 0;
let loopId = null;

// Every frame carries BOTH the walking row (for timeseries-mode iframes)
// and the full dataset (for dataset-mode iframes). The AI prompt at each
// node determines which half the generated code reads.
function buildFrame() {
  const row = rows.length ? rows[index % rows.length] : null;
  return {
    type: 'bioframe',
    source: 'csv',
    timestamp: Date.now(),
    // timeseries payload
    rowIndex: index,
    columns: columnNames,
    row,
    // dataset payload (stable across ticks)
    data: { rows, columns: columnNames, rowCount: rows.length },
  };
}

function clearLoop() {
  if (loopId) { clearInterval(loopId); loopId = null; }
}

export function startCSV(parsedRows, columns) {
  clearLoop();
  rows = parsedRows;
  columnNames = columns;
  index = 0;
  // Emit one frame immediately so dataset-mode iframes don't wait a tick.
  setFrame(buildFrame());
  loopId = setInterval(() => {
    if (rows.length === 0) return;
    setFrame(buildFrame());
    index++;
  }, 100);
}

export function stopCSV() {
  clearLoop();
  rows = [];
  columnNames = [];
  index = 0;
}

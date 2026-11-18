// The uploaded CSV and how prototypes receive it.
//
// Whole dataset (default): a prototype gets all rows once, when it loads, and
// again only if the CSV is replaced.
// Live replay (per card): rows are sent one at a time, at the pace of the
// CSV's time column, with play / pause / jump / speed controls.
//
// Prototypes are the iframes with class "node-iframe"; data-mode="live" marks
// the ones built for live replay.

const DEFAULT_STEP_MS = 100;  // no usable time column: 10 rows per second
const MIN_STEP_MS = 20;
const MAX_STEP_MS = 1000;     // long gaps (e.g. daily logs) still play watchably
const END_PAUSE_MS = 800;     // short pause before looping back to the start

let rows = [];
let columns = [];
let timeCol = null;
let times = null;             // per-row time in ms, or null
let index = 0;
let playing = true;
let speed = 1;
let timer = null;
let lastNotify = 0;
const listeners = new Set();

export function getCSVRows() {
  return { rows, columns };
}

export function getPlayback() {
  return { index, playing, speed, rowCount: rows.length, timeCol, label: positionLabel() };
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(force = true) {
  const now = Date.now();
  if (!force && now - lastNotify < 100) return;
  lastNotify = now;
  const state = getPlayback();
  listeners.forEach(fn => fn(state));
}

// ── Delivery ──

function post(iframe, frame) {
  try { iframe.contentWindow?.postMessage(frame, '*'); } catch { /* iframe gone */ }
}

const allPrototypes = () => document.querySelectorAll('.node-iframe');
const livePrototypes = () => document.querySelectorAll('.node-iframe[data-mode="live"]');

function datasetFrame() {
  return {
    type: 'bioframe', source: 'csv', mode: 'dataset', timestamp: Date.now(),
    data: { rows, columns, rowCount: rows.length },
  };
}

function rowFrame(withData) {
  const frame = {
    type: 'bioframe', source: 'csv', mode: 'live', timestamp: Date.now(),
    row: rows[index] ?? null, rowIndex: index, rowCount: rows.length, columns,
  };
  if (withData) frame.data = { rows, columns, rowCount: rows.length };
  return frame;
}

// Call when a prototype has loaded.
export function deliverTo(iframe) {
  if (!rows.length || !iframe) return;
  post(iframe, iframe.dataset.mode === 'live' ? rowFrame(true) : datasetFrame());
}

// ── Dataset ──

export function loadDataset(newRows, newColumns) {
  rows = newRows;
  columns = newColumns;
  index = 0;
  detectTime();
  allPrototypes().forEach(deliverTo);
  schedule();
  notify();
}

export function clearDataset() {
  clearTimer();
  rows = [];
  columns = [];
  index = 0;
  timeCol = null;
  times = null;
  notify();
}

// ── Playback controls (live replay) ──

export function play() { playing = true; schedule(); notify(); }
export function pause() { playing = false; clearTimer(); notify(); }
export function setSpeed(s) { speed = s; schedule(); notify(); }

export function seek(i) {
  if (!rows.length) return;
  index = Math.max(0, Math.min(rows.length - 1, Math.round(i)));
  livePrototypes().forEach(f => post(f, rowFrame(false)));
  schedule();
  notify();
}

function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null; }
}

function schedule() {
  clearTimer();
  if (!playing || !rows.length) return;
  timer = setTimeout(() => {
    index = (index + 1) % rows.length;
    livePrototypes().forEach(f => post(f, rowFrame(false)));
    notify(false);
    schedule();
  }, stepDelay(index) / speed);
}

// ── Timing from the CSV's own time column ──

function detectTime() {
  timeCol = null;
  times = null;
  const exact = columns.find(c => /^(t|time|timestamp|datetime|date|seconds?|secs?|ms|millis(econds)?)$/i.test(c.trim()));
  const loose = columns.find(c => /time|date|stamp/i.test(c));
  const col = exact || loose;
  if (!col) return;

  const values = rows.map(r => r[col]);
  let parsed;
  if (values.filter(v => typeof v === 'number').length >= values.length * 0.8) {
    const max = Math.max(...values.filter(v => typeof v === 'number'));
    // Epoch milliseconds, epoch seconds, a column named in ms, or plain seconds.
    const toMs = max > 1e11 ? 1 : max > 1e9 ? 1000 : /ms|milli/i.test(col) ? 1 : 1000;
    parsed = values.map(v => (typeof v === 'number' ? v * toMs : NaN));
  } else {
    parsed = values.map(v => Date.parse(v));
  }
  if (parsed.filter(Number.isFinite).length < parsed.length * 0.8) return;
  timeCol = col;
  times = parsed;
}

function stepDelay(i) {
  if (i + 1 >= rows.length) return END_PAUSE_MS;
  if (!times) return DEFAULT_STEP_MS;
  const gap = times[i + 1] - times[i];
  if (!Number.isFinite(gap) || gap <= 0) return DEFAULT_STEP_MS;
  return Math.max(MIN_STEP_MS, Math.min(MAX_STEP_MS, gap));
}

function positionLabel() {
  if (!rows.length) return '';
  if (times && Number.isFinite(times[index]) && Number.isFinite(times[0])) {
    return formatDuration(times[index] - times[0]);
  }
  return `Row ${index + 1} of ${rows.length}`;
}

function formatDuration(ms) {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')} min`;
  if (s < 86400 * 2) return `${(s / 3600).toFixed(1)} h`;
  return `day ${Math.floor(s / 86400) + 1}`;
}

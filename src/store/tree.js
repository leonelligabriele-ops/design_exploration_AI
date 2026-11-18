import { create } from 'zustand';
import { sendMessage } from '../providers/index.js';
import { getCSVRows } from '../datalayer/playback.js';
import { DEFAULT_GEMINI_MODEL } from '../providers/gemini.js';
import { ANTHROPIC_MODEL } from '../providers/anthropic.js';

// The model name for the active provider (Ollama and Gemini have one).
const modelFor = (state) => (state.provider === 'gemini' ? state.geminiModel : state.ollamaModel);

// Base technical context shared across all depths
const DATA_HOOK = `Your app receives the person's biodata from an uploaded CSV file. You MUST define this global function — it is the only way your app receives data:

window.onBioframe = function(frame) { /* ... */ };

frame.source is always 'csv'. How the data arrives depends on the DATA MODE described in the context of the request. If no CSV is loaded yet, show a short message asking the person to upload a CSV file, and handle the data whenever it arrives.
Keep all code in a single HTML file. Keep code concise to avoid truncation.
Output format: reply with the complete app inside one \`\`\`html code block, from <!DOCTYPE html> to </html>. Put nothing before or after the block.
Explain your decisions in comments inside the code. They are never shown on screen, but people read them later in the saved code. Start the code with a short comment block in three parts:
1. CONTEXT: who the app is for, where and when they use it (situation, device), what the person asked for, and what the data can and cannot show. Mark anything you assumed rather than read from the request with "(assumed)".
2. DATA: which columns you use and how.
3. DESIGN DECISIONS: for each main decision (form, layout, sizes, colours, words, interaction), say what you chose and why it is right for this context: name the user, situation, request or data it answers to (e.g. "large numbers, because older users read at a glance"). Never give a generic reason such as "for clarity" or "looks clean". If something was not decided by the request, say so.
Add a one-line comment above each main part of the code saying why it is built that way for this context. Write in plain language for a non-programmer, and keep it short.
Language: write all text in the language the person wrote in, and set it on the page (<html lang="…">). Format numbers and dates explicitly in that language (e.g. toLocaleString('en-GB')), never with the browser's default, which may be another language. If the app speaks (speech synthesis), set the utterance's lang to that language and choose a matching voice.`;

// ── Library toolbox ── Each stage offers a few libraries the AI may use when
// the idea calls for it. Versions are pinned on one CDN so prototypes keep
// working. Every library pulls designs toward its own typical look, so these
// lists are a design decision of the tool, not just a technical one.
const CDN = 'https://cdn.jsdelivr.net/npm/';
const LIBS = {
  rough: { tag: `<script src="${CDN}roughjs@4.6.6/bundled/rough.js"></script>`,
    use: 'Rough.js: hand-drawn shapes (sketchy rectangles, circles, lines, hatched fills). Use rough.svg(svgElement) or rough.canvas(canvasElement).' },
  p5: { tag: `<script src="${CDN}p5@1.11.3/lib/p5.min.js"></script>`,
    use: 'p5.js: motion, generative and organic visuals, playful mouse/touch interaction. Keep the data from onBioframe in a global variable and read it in draw(); size the canvas to the window (createCanvas(windowWidth, windowHeight) and windowResized). Not for ordinary interface (buttons, forms, text).' },
  p5sound: { tag: `<script src="${CDN}p5@1.11.3/lib/addons/p5.sound.min.js"></script>`,
    use: 'p5.sound (with p5.js only), only when the idea calls for sound: simple sound. Start audio from a click on a visible Start button (userStartAudio()).' },
  tone: { tag: `<script src="${CDN}tone@15.0.4/build/Tone.js"></script>`,
    use: 'Tone.js, only when the idea calls for sound: sonification with notes, rhythm, timing and instruments. Start audio with await Tone.start() inside a click on a visible Start button.' },
  d3: { tag: `<script src="${CDN}d3@7.9.0/dist/d3.min.js"></script>`,
    use: 'D3: custom data visuals that are not stock charts (timelines, radial views, comparison with a baseline). Keep the code compact.' },
  chart: { tag: `<script src="${CDN}chart.js@4.4.7/dist/chart.umd.min.js"></script>`,
    use: 'Chart.js: clean standard charts. Only when the person asked for a chart, or the idea is about reading exact values.' },
  matter: { tag: `<script src="${CDN}matter-js@0.20.0/build/matter.min.js"></script>`,
    use: 'Matter.js: physics, for things that fall, pile up, balance or bounce, when that metaphor carries the meaning of the data.' },
  three: { tag: `<script src="${CDN}three@0.158.0/build/three.min.js"></script>`,
    use: 'three.js: 3D. Only for ideas about space, depth or the body; it is heavy.' },
  gsap: { tag: `<script src="${CDN}gsap@3.12.7/dist/gsap.min.js"></script>`,
    use: 'GSAP: smooth, polished transitions and animation. Motion only where it helps understanding.' },
  stats: { tag: `<script src="${CDN}simple-statistics@7.8.8/dist/simple-statistics.min.js"></script>`,
    use: 'simple-statistics (global ss): mean, spread, trend, deviation from a personal baseline.' },
  dayjs: { tag: `<script src="${CDN}dayjs@1.11.13/dayjs.min.js"></script>`,
    use: 'Day.js: reading and formatting dates and times from CSV columns.' },
  pico: { tag: `<link rel="stylesheet" href="${CDN}@picocss/pico@2.0.6/css/pico.min.css">`,
    use: 'Pico.css: clean, readable default styling for text, buttons and forms with no extra code.' },
};
const libList = (keys) => keys.map(k => `- ${LIBS[k].use}\n  ${LIBS[k].tag}`).join('\n');
const LIB_RULES = 'Use a library only when the idea needs what it does: plain HTML, CSS, SVG or canvas is often best, and no library is better than an unnecessary one. Use at most two, with exactly these tags. Do not load any other library.';
const BUILT_INS = 'Also available without any library: speech synthesis (speak values or feedback aloud), vibration on phones, the Web Animations API and Web Audio.';

const SKETCH_TOOLBOX = `Toolbox (optional):
${libList(['rough'])}
No other libraries in a sketch.`;

const EXPLORE_TOOLBOX = `Toolbox (optional). ${LIB_RULES}
${libList(['p5', 'p5sound', 'tone', 'd3', 'matter', 'three', 'stats', 'dayjs'])}
${BUILT_INS}`;

const REFINE_TOOLBOX = `Toolbox (optional). ${LIB_RULES}
${libList(['d3', 'chart', 'gsap', 'pico', 'stats', 'dayjs'])}
Only if an earlier version of this idea used it (keep the technique of the branch, unless the person asked for a change):
${libList(['p5', 'p5sound', 'tone', 'matter', 'three'])}
${BUILT_INS}`;

// Progressive fidelity prompts. Each stage sets HOW FINISHED the result
// looks, never WHAT to design: the person's description and drawing decide
// the content, so the AI must not add features or design ideas of its own.
const NO_LEGEND = `Do not show a "Data used" legend, a list of CSV columns or any other explanation of the data mapping inside the app.`;

const NO_INVENTION = `Build only what the person described or drew. Do not add features, screens, feedback messages, advice or decoration they did not ask for. Where something is unspecified, use the plainest neutral placeholder (e.g. a labelled grey box) rather than inventing a design.`;

// Sound is a possible output, not a default: it is used only when the idea
// calls for it.
const SOUND_RULE = `Sound is optional and silent is the default. Use sound (Web Audio) only when there is a reason for it: the person asks for sound or listening, or the situation of use needs it — for example when the user's eyes are busy (during movement, exercise or a clinical task), when they cannot easily look at a screen, or when an alert must reach them without looking. If you use sound, include a visible Start button that creates the AudioContext inside its click handler.`;

const STAGE_PROMPTS = {
  sketch: `You help clinicians and researchers sketch ideas for applications that use their own biodata. This is the SKETCHING stage. A sketch is quick, rough and disposable. Its job is to make the person's idea easy to see, so they can look at it, think about it and change their mind. It shows the structure of an idea, not a finished design.

${DATA_HOOK}

Represent the idea the way the person thinks of it:
- First work out what kind of thing the idea is, from their words and drawing: a screen someone looks at, a moment or situation of use, a sequence of steps over time, an object or place in the physical world (a wearable, a wall display, a room), a conversation or message, a sound, or a way of looking at data. Sketch THAT. A chart is only right when the idea is a way of looking at data.
- Choose the simplest form that makes that idea readable, for example: a phone or screen frame showing what they describe; a storyboard of 3–4 panels for something that happens in a situation or unfolds over time; a simple drawing of an object or room with what it shows or does; a message thread; a timeline of steps.
- Label things with the person's own words.
- Use the real data where the idea uses data, in the simplest way that shows how the idea responds to it. When data is not the point of the idea, keep it in the background.

Look:
- Hand-drawn and unfinished: black and grey on white, a handwriting font (load "Patrick Hand" from Google Fonts, fall back to cursive), thin pencil-like strokes, light grey hatching or fills at most. No colour, shadows, gradients, icons or images. The tool makes every line wobble like a pencil line, so draw lines straight.
- Leave open what the person has not decided: draw it as a dashed outline with a handwritten "?" and a short question, instead of filling it in.
- ${NO_INVENTION}
- ${NO_LEGEND}
- No status counters, timestamps or debug output.
- Keep the code short (under ~120 lines, not counting comments).

${SKETCH_TOOLBOX}`,

  explore: `You help clinicians and researchers explore the design space for applications that use their own biodata. This is the EXPLORATION stage. The goal is not the obvious solution: it is to open up possibilities the person may not have considered.

${DATA_HOOK}

The person's intent is fixed; the form is open. Keep what the app is for, and who it serves, exactly as the person described. HOW it achieves that is yours to rethink.

Explore boldly, choosing the directions that fit the person's request:
- Representation: question the default chart. Look beyond line charts, bar charts, gauges and dashboards — consider shape, size, rhythm, motion, spatial position, physical or bodily metaphors, typography, colour fields, sound (only when the situation calls for it, see below), or comparisons with the person's own earlier data. Choose the form that makes the meaning of the data easiest to feel, not just to read.
- Interaction: question screen-and-button conventions. Consider glanceable, ambient, playful, gestural, conversational or reflective (looking back afterwards rather than live) interaction, and who is interacting — the patient, the clinician, or both together.
- Interpretation: question what the numbers mean. Consider relative instead of absolute values, change and trend over time, deviation from a personal baseline, ranges and uncertainty, or what the data does not show.
Challenge current conventions in health apps and data visualisation when you have a reason to, but stay understandable and grounded in the actual CSV columns.

Rules for this stage:
- Be inventive in form, not in scope: do not add unrelated features or content the person did not ask for.
- Medium fidelity: it must work with the live data and communicate the concept clearly; polish is not the goal. Colour and motion are welcome when they carry meaning.
- ${SOUND_RULE}
- ${NO_LEGEND}

${EXPLORE_TOOLBOX}`,

  refine: `You help clinicians and researchers polish ideas for applications that use their own biodata. This is the REFINEMENT stage: the idea becomes a near-final app.

${DATA_HOOK}

Rules for this stage:
- High fidelity: considered visual design, typography hierarchy, spacing, and smooth transitions where they help understanding. Base visual choices on the person's descriptions, their drawing and earlier versions in this branch.
- ${NO_INVENTION}
- The app should be understandable by its end user without explanation.
- ${NO_LEGEND}
- Handle edge cases gracefully: missing values, empty cells, no CSV loaded yet.

${REFINE_TOOLBOX}`,
};

// "Explore variations" in the Explore stage: one variation per direction.
const DEFAULT_VARIATIONS = [
  { title: 'Simpler', instruction: '[Design variation: Focus on simplicity — minimal UI, fewest visual elements possible.]' },
  { title: 'Richer', instruction: '[Design variation: Focus on richness — use color, animation, and graphical elements generously.]' },
  { title: 'Unconventional', instruction: '[Design variation: Try an unconventional approach — unexpected metaphor, interaction pattern, or visualization.]' },
];

// Sketch stage: three ways of looking at the same idea, not three new ideas.
const SKETCH_VARIATIONS = [
  { title: 'In use', instruction: '[Sketch variation: show the idea in the situation where it is used (who, where, when), for example as a short storyboard. Keep to what the person described.]' },
  { title: 'Up close', instruction: '[Sketch variation: show the idea up close: the screen, object or output itself, with its parts labelled. Keep to what the person described.]' },
  { title: 'Over time', instruction: '[Sketch variation: show how the idea unfolds over time: what changes during a session, a day or a week. Keep to what the person described.]' },
];

const EXPLORE_VARIATIONS = [
  { title: 'New representation', instruction: '[Variation focus: rethink how the data is REPRESENTED. Avoid conventional charts entirely.]' },
  { title: 'New interaction', instruction: '[Variation focus: rethink the INTERACTION — how, when and by whom the app is used.]' },
  { title: 'New interpretation', instruction: '[Variation focus: rethink how the data is INTERPRETED — what the numbers mean and what they are compared with.]' },
];

// How the person's drawing should be read at each stage.
const DRAWING_NOTES = {
  sketch: "[The attached image is the person's own drawing of the idea. Work out what it shows (a screen, a scene, an object, a sequence…) and sketch that, keeping which elements exist and roughly where they are. Read any handwritten labels.]",
  explore: "[The attached image is the person's drawing of the idea. Follow its structure and placement; refine the layout.]",
  refine: "[The attached image is the person's drawing of the idea. Match its structure, placement and visual direction closely.]",
};

// ── "Why this design?" — the AI thinks aloud about its own design. Open by
// design: it decides what is worth explaining. It only gets told the stage and
// the function that produced the prototype, because those shaped the request.
const RATIONALE_PROMPT = `You made the prototype below. The person wants to understand your thinking behind it.

Explain yourself in your own words. Think it through out loud, in the first person: how you understood what was asked, what you noticed in the description, the drawing, the discussion or the data, what you weighed up, where you were unsure, and why you ended up with the design you made. Follow your reasoning wherever it goes.

You are free to decide what is worth explaining, but keep it short: at most about 100 words, in two or three short paragraphs. Pick the few decisions that matter most rather than covering everything. Keep in mind the stage of the design process and the function that produced this prototype (both given below), because they shaped what you were asked to do.

Match your language to the kind of design you made:
- If the design is a creative one — built on a metaphor, an image, an unusual form, or a new way of reading the data — tell the story behind it: where the idea came from, the picture or metaphor it grew out of, and what it is meant to make the person feel or notice. Use more vivid, narrative language that carries that story. You may use up to about 150 words for this.
- If the design is straightforward, keep the explanation plain and practical.

Do not include code.`;

// ── Sketch stage: back-talk instead of "Why this design?" ── In design, a
// sketch "talks back" (Schön): once an idea is drawn, the drawing shows things
// that were not visible before. The AI voices that, to feed the person's
// reflection, rather than explaining or defending its own choices.
const BACKTALK_PROMPT = `You made the rough sketch below from the person's idea. In design, a sketch "talks back": once an idea is drawn, the drawing shows things that were not visible before. Your job is to voice that back-talk so the person can reflect on their idea. You are not explaining or defending your sketch.

Look at the sketch together with the person's description, drawing and data, and point out in plain language:
- what the sketch makes visible about the idea that was not obvious from the description alone;
- tensions: where the idea, the sketch and the data do not quite fit (for example what the data can and cannot show, gaps, ranges, timing, who sees it and when);
- what the sketch leaves open: decisions the person still has to make.

Rules:
- Ground what you say about the data in the person's data below. Say plainly when the data cannot answer something.
- Do not propose designs, features or solutions. The ideas are the person's.
- At most about 120 words, in two or three short paragraphs. No headings, no code.
- End with one or two open questions for the person.`;

// ── Reflective discussion ──
const REFLECT_PROMPT = `You are a reflective thinking partner for a clinician (for example a physiotherapist or occupational therapist) who is exploring an idea for an application that uses their own biodata from a CSV file. This is a conversation to think together — not a design service.

How to take part:
- Engage critically with what the person says. Name assumptions you notice, ask what they mean, and point out tensions or gaps — always with your reasons.
- Make your own thinking open to critique. When you interpret their idea or their data, say how you read it and why, say what you are unsure about, and invite them to correct you.
- When they challenge you, take it seriously. Say plainly where they changed your mind and where you still disagree, and why. Do not agree just to be agreeable.
- Ground what you say about the data in the person's data below. Say clearly when the data cannot answer a question.
- Do not propose designs, features, visualisations or solutions unless the person explicitly asks for them. The ideas are theirs; your role is to help them think more clearly about them.
- Keep replies short (under about 150 words), conversational and in plain language. No code, no headings. End with at most one question, and only when it helps the reflection.`;

// The uploaded CSV as the model sees it: every row, as CSV text. Very large
// files are thinned to evenly spaced rows so the prompt stays within the
// model's context window.
const MAX_DATA_CHARS = 150000;

function csvForModel() {
  const { rows, columns } = getCSVRows();
  if (!rows.length) return 'No CSV file is loaded yet, so there is no data — only the idea.';
  const toText = (rs) => window.Papa.unparse({ fields: columns, data: rs.map(r => columns.map(c => r[c])) });
  let text = toText(rows);
  let note = '';
  if (text.length > MAX_DATA_CHARS) {
    const keep = Math.max(2, Math.floor(rows.length * MAX_DATA_CHARS / text.length));
    const step = rows.length / keep;
    text = toText(Array.from({ length: keep }, (_, i) => rows[Math.floor(i * step)]));
    note = ` The file is too large to include in full: below are ${keep} evenly spaced rows (every ${step.toFixed(1)}th row), in their original order.`;
  }
  return `The CSV has ${rows.length} rows and ${columns.length} columns.${note}
\`\`\`csv
${text}
\`\`\``;
}

function discussionTranscript(discussion, maxChars = 4000) {
  const text = discussion
    .filter(m => m.content && !m.content.startsWith('Error:'))
    .map(m => `${m.role === 'user' ? 'Person' : 'AI'}: ${m.content}`)
    .join('\n\n');
  return text.length > maxChars ? '…' + text.slice(-maxChars) : text;
}

// General design inspiration, added to the Explore and Refine stages. It
// inspires; it does not override the person's request or the stage rules.
const DESIGN_INSPIRATION = `── Design inspiration ──
Use this as inspiration, not as a checklist. The person's own description, drawing and discussion always come first, and the stage rules above decide how finished and how free the result is.

You decide how to present the data. Options include but are NOT limited to:
- Static overviews: charts, heatmaps, calendar views, small multiples
- Animated unfolding: walk through rows over time with setInterval or requestAnimationFrame to show a slow progression
- Sonification, when the situation calls for sound: map values to pitch, rhythm and timbre with the Web Audio API
- Interactive exploration: scrubbing, filtering, zooming, drill-down, hover-to-reveal
- Ambient / generative: data as a seed for visual texture
- Physical metaphors: something that breathes, grows, decays, accumulates, erodes

Do NOT default to a bar chart or a dashboard. The person wants a novel interaction with their data. Be imaginative about output form — visual, motion, or a combination. ${SOUND_RULE} If the person explicitly asks for a particular form, such as a bar chart, give them that form.`;

// The inspiration pushes for new forms of data presentation, which would pull
// a sketch away from the person's own idea, so the Sketch stage goes without it.
function getSystemPrompt(stage) {
  if (stage === 'sketch' || !STAGE_PROMPTS[stage]) return STAGE_PROMPTS.sketch;
  return `${STAGE_PROMPTS[stage]}\n\n${DESIGN_INSPIRATION}`;
}

// How long Claude thinks before building a prototype. At its default ("high")
// an Explore prototype took about 80 s, 46 s of it silent thinking; at
// "medium" about 25 s. Sketches are quick and rough, so "low" is enough.
const STAGE_EFFORT = { sketch: 'low', explore: 'medium', refine: 'medium' };

export const STAGES = {
  sketch:  { bg: '#FEF3C7', border: '#E0A030', label: 'Sketch' },
  explore: { bg: '#EDE5FF', border: '#7C5CFC', label: 'Explore' },
  refine:  { bg: '#D1FAE5', border: '#059669', label: 'Refine' },
};

export const STAGE_LIST = ['sketch', 'explore', 'refine'];

// What the AI is told about the data. "dataset" (default): the whole CSV at
// once. "timeseries": replayed row by row as if live.
function getDataSourceContext(source, csvColumns, nodeShape, csvRowCount) {
  const colsLine = csvColumns.length
    ? `The CSV columns are: ${csvColumns.join(', ')}. Use these names exactly.`
    : 'No CSV is loaded yet, so the column names are not known: read them from the data when it arrives.';
  const rowsLine = csvRowCount ? ` It has ${csvRowCount} rows.` : '';

  if (nodeShape === 'timeseries') {
    return `DATA MODE: LIVE REPLAY. The person's recording is played back row by row, as if it were happening now. ${colsLine}${rowsLine}
- The first call includes frame.data = { rows, columns, rowCount } — the whole dataset, e.g. for ranges. Keep a copy if you need it; later calls do not include it.
- Every call includes frame.row (the current row as an object, e.g. frame.row["Column name"]), frame.rowIndex, frame.rowCount and frame.columns.
- Rows arrive at the pace of the recording's time column. The person can pause, jump to another moment or change the speed, so rowIndex can jump forwards or backwards.
- Values are auto-typed: numbers are numbers, text is text.`;
  }
  return `DATA MODE: WHOLE DATASET. ${colsLine}${rowsLine}
- onBioframe is called once with the whole dataset: frame.data.rows (an array of all rows as objects, e.g. frame.data.rows[0]["Column name"]), frame.data.columns and frame.data.rowCount.
- It is called again only if the person replaces the CSV; rebuild everything when that happens.
- Values are auto-typed: numbers are numbers, text is text.`;
}

export const NODE_W = 240;

// The frame a prototype is shown in on this screen, roughly: the open card's
// preview area (panel width, screen height minus the panel's own controls).
export function previewFrame(viewport) {
  return {
    w: Math.round(Math.min(1000, Math.max(560, viewport.w * 0.55))),
    h: Math.round(Math.max(360, viewport.h - 260)),
  };
}

// Asks for prototypes that fit their frame like one app screen, so they can be
// shown at full size instead of shrunk to fit.
function screenBrief(viewport) {
  const { w, h } = previewFrame(viewport);
  return `[Screen: the prototype is shown in a frame of about ${w} × ${h} pixels (wide, not tall), and can also be opened full screen. Design it as one immersive app screen that fits that frame without scrolling: fill the full width and height (html and body at 100% height, a flexible layout, no narrow fixed max-width column), and scale with the frame. If there is more to show than fits, use tabs, steps or screens the person moves between, not a long page. Keep text readable: body text at least 15px.]`;
}

// The stage a card's current prototype was made in (the card's stage badge can
// be changed afterwards).
export function builtStageOf(node) {
  return node.builtStage || node.promptLog?.stage || node.stage || 'sketch';
}

// How a prototype came about, in words — given to "Why this design?".
function describeFunction(node, options, stage) {
  if (options.fromDiscussionOf) return '"Prototype it": the person asked for a prototype built from their discussion with the AI.';
  if (node.combinedFrom?.length) return `"Combine": the person selected ${node.combinedFrom.length} prototypes and asked for them to be combined into one${node.prompt.trim() ? ', with a focus they gave' : ''}.`;
  const variation = options.extraInstruction || node.variation;
  if (variation) return `"Explore variations": this is one of three versions of the previous card's idea, made at once. This version's instruction was: ${variation}`;
  if (node.origin === 'whatElse') return '"What else?": the person asked for a completely different approach to the same idea as the previous version.';
  if (node.origin === 'keepChange') return '"Keep / Change": the person said what to keep and what to change from the previous version.';
  if (node.developedFrom) return `"Develop in ${stage}": the previous stage's version was taken further into this stage.`;
  return `"Generate": made from the person's ${node.prompt.trim() ? 'description' : ''}${node.prompt.trim() && node.sketch ? ' and ' : ''}${node.sketch ? 'drawing' : ''}.`;
}

let counter = 0;
function uid() { return 'n' + (++counter) + '_' + Date.now().toString(36); }

// Extract the first HTML code block from a response string.
// Uses manual string search instead of regex to handle very long responses reliably.
export function extractCode(text) {
  if (!text) return null;

  // Look for opening code fence: ```html or ```HTML or just ```
  let fenceStart = -1;
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf('```', searchFrom);
    if (idx === -1) break;
    fenceStart = idx;
    break;
  }

  if (fenceStart !== -1) {
    // Find end of the opening fence line
    let contentStart = text.indexOf('\n', fenceStart);
    if (contentStart === -1) contentStart = fenceStart + 3;
    else contentStart += 1;

    // Find closing fence
    const fenceEnd = text.indexOf('```', contentStart);
    let content;
    if (fenceEnd !== -1) {
      content = text.slice(contentStart, fenceEnd).trim();
    } else {
      // No closing fence (response may have been truncated) — take everything after opening
      content = text.slice(contentStart).trim();
    }

    if (content.length > 20) return content;
  }

  // No code block: find a bare HTML document anywhere in the reply (some
  // models skip the block or add a sentence first).
  const lower = text.toLowerCase();
  const start = [lower.indexOf('<!doctype'), lower.indexOf('<html')].filter(i => i !== -1);
  if (start.length) {
    const from = Math.min(...start);
    const end = lower.lastIndexOf('</html>');
    return (end > from ? text.slice(from, end + 7) : text.slice(from)).trim();
  }
  return null;
}

// The AI chosen in Settings is remembered between visits.
const PROVIDER_KEY = 'biosketch.provider';
function storedProvider() {
  try {
    const p = localStorage.getItem(PROVIDER_KEY);
    const allowed = ['anthropic', 'ollama', 'demo', ...(import.meta.env.DEV ? ['gemini'] : [])];
    return allowed.includes(p) ? p : null;
  } catch { return null; }
}

export const useTreeStore = create((set, get) => ({
  // Tree
  nodes: [],
  selectedId: null,

  // Provider
  // Local development defaults to Demo (no API key needed); the deployed site uses Claude.
  provider: storedProvider() || (import.meta.env.DEV ? 'demo' : 'anthropic'),
  ollamaModel: 'qwen3-coder:latest',
  geminiModel: DEFAULT_GEMINI_MODEL,
  ollamaUrl: '/api/ollama',

  // Canvas viewport: pan offset + zoom, and the visible area size.
  // Shared so toolbar actions can place new cards where the user is looking.
  view: { x: 0, y: 0, scale: 1 },
  viewport: { w: 1200, h: 800 },
  setView: (view) => set(s => ({ view: typeof view === 'function' ? view(s.view) : view })),
  setViewport: (viewport) => set({ viewport }),

  // Data layer
  dataSource: 'none',  // 'none' | 'csv'
  dataFlowing: false,
  frameCount: 0,  // internal only, not shown in the UI
  csvColumns: [],
  csvRowCount: 0,
  csvFileName: '',

  // Data layer actions
  setDataSource: (source) => set({ dataSource: source, dataFlowing: false, frameCount: 0, csvColumns: [], csvRowCount: 0, csvFileName: '' }),
  setDataFlowing: (flowing) => set({ dataFlowing: flowing }),
  incrementFrame: () => set(s => ({ frameCount: s.frameCount + 1 })),
  setCsvColumns: (cols) => set({ csvColumns: cols }),
  setCsvRowCount: (n) => set({ csvRowCount: n }),
  setCsvFileName: (name) => set({ csvFileName: name }),

  // Tutorial: bumping this number replays the tour from the start.
  tourRun: 0,
  restartTour: () => set(s => ({ tourRun: s.tourRun + 1, selectedId: null, combineMode: false })),

  // Combine mode: pick prototype cards on the canvas, then make one new card.
  combineMode: false,
  combineSelection: [],
  startCombine: () => set({ combineMode: true, combineSelection: [], selectedId: null }),
  cancelCombine: () => set({ combineMode: false, combineSelection: [] }),
  toggleCombineSelect: (id) => set(s => ({
    combineSelection: s.combineSelection.includes(id)
      ? s.combineSelection.filter(x => x !== id)
      : [...s.combineSelection, id],
  })),
  combineNodes: async (focus) => {
    const { nodes, combineSelection } = get();
    const sources = combineSelection.map(id => nodes.find(n => n.id === id)).filter(n => n?.code);
    if (sources.length < 2) return;
    const id = uid();
    // The combined card takes the most developed stage among its sources.
    const stage = STAGE_LIST[Math.max(...sources.map(n => STAGE_LIST.indexOf(n.stage || 'sketch')))];
    const x = sources.reduce((a, n) => a + n.x, 0) / sources.length;
    const y = Math.max(...sources.map(n => n.y)) + 300;
    set(s => ({
      nodes: [...s.nodes, {
        id, parentId: null, combinedFrom: sources.map(n => n.id),
        x, y,
        title: 'Combined: ' + sources.map(n => n.title || 'Untitled').join(' + ').slice(0, 60),
        titleEdited: true, prompt: focus.trim(), response: '', code: '', sketch: null,
        loading: false, stage, shape: sources[0].shape || 'dataset',
        source: sources[0].source || null, discussion: [], useDiscussion: true, origin: 'combine',
      }],
      combineMode: false, combineSelection: [], selectedId: id,
    }));
    await get().sendMessage(id);
  },

  // Tree actions
  addRoot: () => {
    const id = uid();
    const { view, viewport, nodes } = get();
    // Place the card in the left third of the visible area so the editor
    // panel (which opens to its right) is also on screen.
    let x = (viewport.w * 0.25 - view.x) / view.scale - NODE_W / 2;
    let y = (viewport.h * 0.2 - view.y) / view.scale;
    // Step right if another card already sits there.
    while (nodes.some(n => Math.abs(n.x - x) < NODE_W && Math.abs(n.y - y) < 200)) x += NODE_W + 40;
    set(s => ({
      nodes: [...s.nodes, {
        id, parentId: null,
        x, y,
        title: '', titleEdited: false, prompt: '', response: '', code: '', sketch: null,
        loading: false, stage: 'sketch', shape: 'dataset',
        discussion: [], useDiscussion: true,
      }],
      selectedId: id,
    }));
  },

  fork: (parentId) => {
    const parent = get().nodes.find(n => n.id === parentId);
    if (!parent) return;
    const id = uid();
    const siblings = get().nodes.filter(n => n.parentId === parentId);
    const offset = (siblings.length - siblings.length / 2) * 240;
    set(s => ({
      nodes: [...s.nodes, {
        id, parentId,
        x: parent.x + offset, y: parent.y + 240,
        title: '', titleEdited: false, prompt: '', response: '', code: parent.code || '', sketch: parent.sketch || null,
        loading: false, stage: parent.stage || 'sketch', shape: parent.shape || 'dataset',
        source: parent.source || null,
      }],
      selectedId: id,
    }));
  },

  developNode: (parentId) => {
    const parent = get().nodes.find(n => n.id === parentId);
    if (!parent) return;
    const next = STAGE_LIST[STAGE_LIST.indexOf(parent.stage || 'sketch') + 1];
    if (!next) return;
    const id = uid();
    const siblings = get().nodes.filter(n => n.parentId === parentId);
    set(s => ({
      nodes: [...s.nodes, {
        id, parentId, developedFrom: parentId,
        x: parent.x + siblings.length * (NODE_W + 40), y: parent.y + 260,
        title: parent.title || '', titleEdited: !!parent.title,
        prompt: '', response: '', code: '', sketch: parent.sketch || null,
        loading: false, stage: next, shape: parent.shape || 'dataset',
        source: parent.source || null, discussion: [], useDiscussion: true,
      }],
      selectedId: id,
    }));
  },

  setNodeShape: (id, shape) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, shape } : n),
  })),

  select: (id) => set({ selectedId: id }),

  deleteNode: (id) => {
    // Collect this node and all descendants
    const { nodes, selectedId } = get();
    const toDelete = new Set();
    function collect(nid) {
      toDelete.add(nid);
      nodes.filter(n => n.parentId === nid).forEach(n => collect(n.id));
    }
    collect(id);
    set({
      nodes: nodes.filter(n => !toDelete.has(n.id)),
      selectedId: toDelete.has(selectedId) ? null : selectedId,
    });
  },

  renameNode: (id, title) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, title: title.trim(), titleEdited: !!title.trim() } : n),
  })),

  updatePrompt: (id, prompt) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, prompt } : n),
  })),

  updateCode: (id, code) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, code } : n),
  })),

  updateSketch: (id, sketch) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, sketch } : n),
  })),

  updateNodePosition: (id, x, y) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, x, y } : n),
  })),

  setStage: (id, stage) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, stage } : n),
  })),

  getAncestors: (id) => {
    const { nodes } = get();
    const result = [];
    let cur = nodes.find(n => n.id === id);
    while (cur?.parentId) {
      const p = nodes.find(n => n.id === cur.parentId);
      if (p) result.unshift(p);
      cur = p;
    }
    return result;
  },

  sendMessage: async (nodeId, options = {}) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    // Discussion that this generation is built from (a card's own, or its parent's).
    // A card made from a discussion keeps building from it until it gets its own description.
    const discussionSource = options.fromDiscussionOf
      || (node && !node.prompt.trim() ? node.fromDiscussion : null);
    if (discussionSource) options = { ...options, fromDiscussionOf: discussionSource };
    const sourceDiscussion = discussionSource
      ? get().nodes.find(n => n.id === discussionSource)?.discussion || []
      : [];
    if (!node || (!node.prompt.trim() && !node.sketch && !node.developedFrom && !sourceDiscussion.length && !node.combinedFrom?.length)) return;

    // The previous result, so a regeneration builds on it.
    const previousResponse = node.response && !node.response.startsWith('Error:') ? node.response : '';

    // Auto-title from the prompt unless the user named the card themselves.
    const title = node.titleEdited
      ? node.title
      : node.prompt.trim()
        ? node.prompt.slice(0, 32) + (node.prompt.length > 32 ? '…' : '')
        : node.developedFrom ? (node.title || 'Developed idea')
        : sourceDiscussion.length ? (node.title || 'From discussion')
        : node.combinedFrom?.length ? (node.title || 'Combined idea')
        : 'Drawn idea';
    // Snapshot what data source this generation is being built against.
    // The node's iframe will receive live data of this type, and the AI was
    // prompted to read that shape. Useful for showing a source chip later.
    const snapshotSource = state.dataSource !== 'none' ? state.dataSource : null;
    set(s => ({
      nodes: s.nodes.map(n => n.id === nodeId ? {
        ...n,
        loading: true, title, response: '',
        source: snapshotSource,
        rationale: null,  // a new design needs a new explanation
        madeWith: describeFunction(node, options, node.stage || 'sketch'),
        builtShape: node.shape || 'dataset',
        builtStage: node.stage || 'sketch',
      } : n),
    }));

    const ancestors = get().getAncestors(nodeId);
    const stage = node.stage || 'sketch';
    const systemPrompt = getSystemPrompt(stage);

    const messages = ancestors.flatMap(a => {
      const m = [];
      if (a.prompt || a.response) {
        m.push({ role: 'user', content: a.prompt || (a.developedFrom ? '(Develop the idea in the next stage.)' : '(Idea given as a drawing.)') });
      }
      if (a.response) m.push({ role: 'assistant', content: a.response });
      return m;
    });

    if (previousResponse) {
      messages.push({ role: 'assistant', content: previousResponse });
    }
    // Tell the AI which data source is active so it generates relevant code
    const dataContext = getDataSourceContext(state.dataSource, state.csvColumns, node.shape || 'dataset', state.csvRowCount);
    const contextParts = [`[Stage: ${stage.toUpperCase()}]`];
    if (dataContext) contextParts.push(dataContext);
    const combined = (node.combinedFrom || [])
      .map(id => get().nodes.find(n => n.id === id))
      .filter(Boolean);
    const description = node.prompt.trim()
      || (combined.length
        ? '(No extra focus given — combine the prototypes below into one.)'
        : sourceDiscussion.length
        ? '(Build the prototype from the discussion below.)'
        : node.developedFrom
        ? `(No new description — develop the idea from the previous stage into the ${stage.toUpperCase()} stage, keeping the person's intent.)`
        : '(No written description — build it from the attached drawing.)');
    let userText = `${description}\n\n[${contextParts.join(' | ')}]\n\n${screenBrief(state.viewport)}`;

    // Show the AI the data itself, so the design fits its actual values.
    if (state.dataSource === 'csv') {
      userText += `\n\n[The person's data, so you can design for its actual values, ranges and patterns. The prototype must still read the data from onBioframe at runtime, not copy values from here.]\n${csvForModel()}`;
    }

    // Combine: show the AI every selected prototype.
    if (combined.length) {
      const per = Math.floor(30000 / combined.length);
      const parts = combined.map((c, i) => `### Prototype ${i + 1}: ${c.title || 'Untitled idea'} (${c.stage || 'sketch'} stage)
Description: ${c.prompt.trim() || '(none written)'}
\`\`\`html
${(c.code || '').slice(0, per)}
\`\`\``);
      userText += `\n\n[Combine the ${combined.length} prototypes below into ONE new prototype. Bring together what the person would want from each of them; the person's focus above, if any, guides what matters most. Build only from what is in these prototypes and the person's focus.]\n\n${parts.join('\n\n')}`;
    }

    // Carry the reflective discussion into the generation as background.
    if (sourceDiscussion.length) {
      userText += `\n\n[The person asked for a prototype based on this discussion. Build what the person expressed in it. Their own statements take priority; use the AI's points only where the person agreed with them.]\n${discussionTranscript(sourceDiscussion, 6000)}`;
    }
    const discussed = [...ancestors, node].filter(n =>
      n.discussion?.length && n.useDiscussion !== false && n.id !== options.fromDiscussionOf);
    if (discussed.length) {
      const transcript = discussionTranscript(discussed.flatMap(n => n.discussion));
      if (transcript) {
        userText += `\n\n[Background — the person's reflective discussion about this idea. Use it to understand what they mean; their own statements take priority over the AI's. Do not add features that were only mentioned by the AI.]\n${transcript}`;
      }
    }

    // Variation instruction: kept on the card so regenerating it stays a variation.
    const variationInstruction = options.extraInstruction || node.variation;
    if (variationInstruction) {
      userText += '\n\n' + variationInstruction;
    }

    // Build the user message — include sketch image if present
    const imageMatch = node.sketch && state.provider === 'anthropic'
      ? node.sketch.match(/^data:(image\/\w+);base64,(.+)$/)
      : null;
    if (imageMatch) {
      userText += '\n\n' + (DRAWING_NOTES[stage] || DRAWING_NOTES.sketch);
      messages.push({
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: imageMatch[1], data: imageMatch[2] } },
          { type: 'text', text: userText },
        ],
      });
    } else {
      messages.push({ role: 'user', content: userText });
    }

    // Keep exactly what was sent, so the export can show how this card was prompted.
    const promptLog = {
      at: new Date().toISOString(),
      stage,
      provider: state.provider,
      model: state.provider === 'anthropic' ? ANTHROPIC_MODEL : state.provider === 'demo' ? 'demo' : modelFor(state),
      ...(state.provider === 'anthropic' && { effort: STAGE_EFFORT[stage] }),
      system: systemPrompt,
      user: userText,
      drawingAttached: !!imageMatch,
      earlierTurns: messages.length - 1,
      csvFileName: state.csvFileName || '',
    };
    set(s => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, promptLog } : n) }));

    await sendMessage(state.provider, modelFor(state), state.ollamaUrl, messages, systemPrompt, {
      onToken: (token) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId ? { ...n, response: n.response + token } : n
          ),
        }));
      },
      onDone: () => {
        const currentNode = get().nodes.find(n => n.id === nodeId);
        const extracted = extractCode(currentNode?.response || '');
        set(s => ({
          nodes: s.nodes.map(n => n.id === nodeId ? { ...n, loading: false, code: extracted || n.code } : n),
        }));
      },
      onError: (error) => {
        set(s => ({
          nodes: s.nodes.map(n =>
            n.id === nodeId ? { ...n, loading: false, response: `Error: ${error}` } : n
          ),
        }));
      },
    }, { effort: STAGE_EFFORT[stage] });
  },

  // "What else?" — fork with a reframe prompt and send immediately
  whatElse: async (nodeId) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const id = uid();
    const siblings = state.nodes.filter(n => n.parentId === nodeId);
    const offset = (siblings.length - siblings.length / 2) * 240;

    const reframePrompt = 'The current prototype works, but I want to explore a completely different approach to the same problem. Try a different visualization, different interaction pattern, or different metaphor. Surprise me with something I would not have thought of.';

    set(s => ({
      nodes: [...s.nodes, {
        id, parentId: nodeId,
        x: node.x + offset, y: node.y + 240,
        title: 'What else?', titleEdited: true, origin: 'whatElse',
        prompt: reframePrompt, response: '', code: '', sketch: null,
        loading: false, stage: node.stage || 'sketch', shape: node.shape || 'dataset',
        source: node.source || null,
      }],
      selectedId: id,
    }));

    await get().sendMessage(id);
  },

  // "Keep/Change" — structured prompt to refine a prototype
  sendKeepChange: async (nodeId, keepText, changeText) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const id = uid();
    const siblings = state.nodes.filter(n => n.parentId === nodeId);
    const offset = (siblings.length - siblings.length / 2) * 240;

    const parts = [];
    if (keepText.trim()) parts.push(`KEEP these aspects exactly as they are: ${keepText.trim()}`);
    if (changeText.trim()) parts.push(`CHANGE these aspects: ${changeText.trim()}`);
    const prompt = parts.join('. ') + '. Generate an updated version of the current prototype.';

    set(s => ({
      nodes: [...s.nodes, {
        id, parentId: nodeId,
        x: node.x + offset, y: node.y + 240,
        title: (changeText.trim() ? 'Change: ' + changeText.trim() : 'Keep: ' + keepText.trim()).slice(0, 32), titleEdited: true, origin: 'keepChange',
        prompt, response: '', code: '', sketch: null,
        loading: false, stage: node.stage || 'sketch', shape: node.shape || 'dataset',
        source: node.source || null,
      }],
      selectedId: id,
    }));

    await get().sendMessage(id);
  },

  // Multi-generate — create 3 variations simultaneously
  multiGenerate: async (nodeId) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node || (!node.prompt.trim() && !node.sketch && !node.developedFrom && !node.fromDiscussion && !node.combinedFrom?.length)) return;

    const variations = node.stage === 'explore' ? EXPLORE_VARIATIONS
      : (node.stage || 'sketch') === 'sketch' ? SKETCH_VARIATIONS
      : DEFAULT_VARIATIONS;
    // Three new branches below this card; the card itself stays as it is.
    const existing = get().nodes.filter(n => n.parentId === nodeId).length;
    const newNodes = variations.map((v, i) => ({
      id: uid(), parentId: nodeId,
      x: node.x + (existing + i - 1) * (NODE_W + 40), y: node.y + 260,
      title: v.title, titleEdited: true, prompt: node.prompt,
      response: '', code: '', origin: 'variation', variation: v.instruction,
      sketch: node.sketch || null, developedFrom: node.developedFrom || null, fromDiscussion: node.fromDiscussion || null,
      loading: false, stage: node.stage || 'sketch', shape: node.shape || 'dataset',
      source: node.source || null, discussion: [], useDiscussion: true,
    }));
    set(s => ({ nodes: [...s.nodes, ...newNodes] }));

    const send = get().sendMessage;
    await Promise.all(newNodes.map(n => send(n.id)));
  },

  // Reflective discussion about the idea and the data (Sketch stage).
  sendDiscussion: async (nodeId, text) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node || !text.trim() || node.discussing) return;

    const history = [...(node.discussion || []), { role: 'user', content: text.trim() }];
    const patch = (fn) => set(s => ({ nodes: s.nodes.map(n => n.id === nodeId ? fn(n) : n) }));
    patch(n => ({ ...n, discussion: [...history, { role: 'assistant', content: '' }], discussing: true }));

    const ancestors = get().getAncestors(nodeId);
    const lineage = ancestors.filter(a => a.prompt).map(a => `- ${a.prompt}`).join('\n');
    const code = node.code ? node.code.slice(0, 8000) : '';
    const system = `${REFLECT_PROMPT}

── Context ──
The idea is at the ${(node.stage || 'sketch').toUpperCase()} stage.
The person's current description of the idea: ${node.prompt.trim() || '(not written yet)'}
${lineage ? `Earlier ideas this one branched from:\n${lineage}\n` : ''}${node.sketch ? 'The person has made a drawing of the idea (attached to their latest message).\n' : ''}${code ? `A sketch has already been generated from the idea. Its code (for your understanding only — discuss what it shows, not the code):\n${code}\n` : ''}
── The person's data ──
${csvForModel()}`;

    // Errored turns are kept on screen but not sent back to the model.
    const messages = history
      .filter(m => !(m.role === 'assistant' && m.content.startsWith('Error:')))
      .map(m => ({ role: m.role, content: m.content }));
    const match = node.sketch && state.provider === 'anthropic'
      ? node.sketch.match(/^data:(image\/\w+);base64,(.+)$/)
      : null;
    if (match) {
      const last = messages[messages.length - 1];
      last.content = [
        { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } },
        { type: 'text', text: last.content },
      ];
    }

    const setReply = (fn) => patch(n => {
      const d = [...n.discussion];
      d[d.length - 1] = { ...d[d.length - 1], content: fn(d[d.length - 1].content) };
      return { ...n, discussion: d };
    });

    await sendMessage(state.provider, modelFor(state), state.ollamaUrl, messages, system, {
      onToken: (t) => setReply(c => c + t),
      onDone: () => {
        setReply(c => c || '(No reply)');
        patch(n => ({ ...n, discussing: false }));
      },
      onError: (err) => {
        setReply(() => `Error: ${err}`);
        patch(n => ({ ...n, discussing: false }));
      },
    });
  },

  // Build a prototype from a card's discussion. An empty card is filled in
  // place; a card that already has a prototype gets a new branch, so nothing
  // is overwritten.
  prototypeFromDiscussion: async (nodeId) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node?.discussion?.length) return;
    if (!node.code) {
      set(s => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, fromDiscussion: nodeId } : n) }));
      await get().sendMessage(nodeId, { fromDiscussionOf: nodeId });
      return;
    }
    const id = uid();
    const siblings = get().nodes.filter(n => n.parentId === nodeId);
    set(s => ({
      nodes: [...s.nodes, {
        id, parentId: nodeId,
        x: node.x + siblings.length * (NODE_W + 40), y: node.y + 260,
        title: '', titleEdited: false, prompt: '', response: '', code: '', sketch: node.sketch || null,
        loading: false, stage: node.stage || 'sketch', shape: node.shape || 'dataset',
        source: node.source || null, discussion: [], useDiscussion: true, fromDiscussion: nodeId,
      }],
      selectedId: id,
    }));
    await get().sendMessage(id, { fromDiscussionOf: nodeId });
  },

  // "Why this design?" — ask the AI to explain the decisions behind a card's prototype.
  explainDesign: async (nodeId) => {
    const state = get();
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node?.code || node.rationale?.loading) return;
    const stage = builtStageOf(node);
    // Sketches get back-talk (what the sketch shows); later stages explain their design.
    const kind = stage === 'sketch' ? 'backtalk' : 'why';
    const patch = (fn) => set(s => ({ nodes: s.nodes.map(n => n.id === nodeId ? { ...n, rationale: fn(n.rationale) } : n) }));
    patch(() => ({ text: '', loading: true, kind }));

    const transcript = node.discussion?.length ? discussionTranscript(node.discussion, 3000) : '';
    const lineage = get().getAncestors(nodeId)
      .map(a => `- ${a.title || 'Untitled'} (${a.stage || 'sketch'} stage)${a.prompt ? `: ${a.prompt.slice(0, 300)}` : ''}`)
      .join('\n');
    const system = kind === 'backtalk'
      ? `${BACKTALK_PROMPT}

── The person's data ──
${csvForModel()}`
      : `${RATIONALE_PROMPT}

Stage: ${stage.toUpperCase()}
Function used: ${node.madeWith || '"Generate".'}`;
    const user = `The person's description: ${node.prompt.trim() || '(none written)'}
${node.sketch ? 'The person also made a drawing of the idea.\n' : ''}${lineage ? `Earlier versions this one builds on:\n${lineage}\n` : ''}${transcript ? `Their discussion about the idea:\n${transcript}\n` : ''}
${kind === 'backtalk' ? 'The sketch you made' : 'The prototype you made'}:
\`\`\`html
${node.code.slice(0, 12000)}
\`\`\`

${kind === 'backtalk' ? 'What does this sketch show?' : 'Explain your thinking.'}`;

    await sendMessage(state.provider, modelFor(state), state.ollamaUrl, [{ role: 'user', content: user }], system, {
      onToken: (t) => patch(r => ({ ...r, text: (r?.text || '') + t })),
      onDone: () => patch(r => ({ ...r, loading: false })),
      onError: (err) => patch(() => ({ text: '', loading: false, error: err, kind })),
    });
  },

  clearDiscussion: (id) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, discussion: [] } : n),
  })),

  setUseDiscussion: (id, on) => set(s => ({
    nodes: s.nodes.map(n => n.id === id ? { ...n, useDiscussion: on } : n),
  })),

  setProvider: (provider) => {
    try { localStorage.setItem(PROVIDER_KEY, provider); } catch { /* not remembered, still works */ }
    set({ provider });
  },
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setGeminiModel: (model) => set({ geminiModel: model }),
  setOllamaUrl: (url) => set({ ollamaUrl: url }),

  saveToJSON: () => {
    const { nodes, provider, ollamaModel, ollamaUrl, geminiModel } = get();
    return JSON.stringify({ version: 2, nodes, provider, ollamaModel, ollamaUrl, geminiModel }, null, 2);
  },

  loadFromJSON: (json) => {
    try {
      const data = JSON.parse(json);
      if (!Array.isArray(data.nodes)) throw new Error('Invalid format');
      set({
        nodes: data.nodes.map(n => ({
          ...n, loading: false, discussing: false, code: n.code || '', shape: n.shape || 'dataset',
          rationale: n.rationale?.loading ? null : n.rationale,
          discussion: n.discussion || [], useDiscussion: n.useDiscussion !== false,
        })),
        // The AI choice lives in Settings and is not changed by opening a file.
        selectedId: null,
      });
      return true;
    } catch (e) {
      console.error('Failed to load tree:', e);
      return false;
    }
  },
}));

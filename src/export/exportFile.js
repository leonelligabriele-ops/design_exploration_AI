// "Download": the whole exploration as ONE self-contained HTML file.
// A contents list follows the tree (1, 1.1, 1.2, 2 …); each card then has its
// own section: prototype level, the function that made it, what the person
// asked, their drawing, the running prototype and its code, the AI's
// "Why this design?", the discussion, and exactly how the AI was prompted.
// A "Load CSV" button at the top feeds the person's data to every prototype.

import { STAGES, builtStageOf } from '../store/tree.js';
import { withSketchLook } from '../sketchLook.js';

const LEVELS = {
  sketch: 'Quick, rough and hand-drawn. Makes the idea easy to see in whatever form it takes, so it can be looked at, questioned and changed.',
  explore: 'Medium fidelity. Opens up other ways to represent, interact with and interpret the data.',
  refine: 'High fidelity. A near-final app.',
};

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Paragraphs, with **bold** and *italic* kept.
const prose = (s) => s.trim().split(/\n\s*\n|\n/).filter(l => l.trim()).map(l =>
  `<p>${esc(l.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*(?:[-•]|\*(?=\s))\s*/, ''))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>')}</p>`).join('');
const stageOf = (s) => STAGES[s] || STAGES.sketch;
const modeLabel = (shape) => (shape === 'timeseries' ? 'Live replay (row by row)' : 'Whole dataset');

// Text the AI wrote around the code block, if any.
function aiNotes(response) {
  if (!response || response.startsWith('Error:')) return '';
  return response.replace(/```[\s\S]*?(```|$)/g, '').trim();
}

// Same bridge the tool injects: the prototype receives frames by postMessage.
const BRIDGE = `<script>window.addEventListener('message',function(e){if(e.data&&e.data.type==='bioframe'&&typeof window.onBioframe==='function')window.onBioframe(e.data);});<\/script>`;
function withBridge(code) {
  const i = code.lastIndexOf('</body>');
  return i === -1 ? code + BRIDGE : code.slice(0, i) + BRIDGE + code.slice(i);
}

// Sketches get back-talk (what the sketch shows); later stages explain themselves.
function explanation(node, genStage) {
  const r = node.rationale;
  const backtalk = r?.text ? r.kind === 'backtalk' : genStage === 'sketch';
  const head = backtalk
    ? `<h3>What does it show? <span class="sub">(the AI's back-talk on the sketch)</span></h3>`
    : `<h3>Why this design? <span class="sub">(the AI's explanation)</span></h3>`;
  if (r?.text) return head + `<div class="ai">${prose(r.text)}</div>`;
  const ask = backtalk ? '“What does it show?”' : '“Why this design?”';
  return head + `<p class="none">${node.code ? `Not asked for in the tool. Open the card and choose ${ask} before downloading to include it.` : 'No prototype yet.'}</p>`;
}

function section(node, ctx) {
  const { num, nodesById, children } = ctx;
  const n = num.get(node.id);
  const log = node.promptLog;
  const genStage = builtStageOf(node);
  const st = stageOf(genStage);
  const link = (x) => (x ? `<a href="#card-${num.get(x.id)}">${num.get(x.id)} · ${esc(x.title || 'Untitled idea')}</a>` : 'a deleted card');
  const parent = node.parentId && nodesById.get(node.parentId);
  const kids = children(node.id);

  const facts = [
    ['Prototype level', `<b>${st.label}</b>. ${LEVELS[genStage] || ''}${node.stage && node.stage !== genStage ? ` (card later moved to ${stageOf(node.stage).label})` : ''}`],
    ['Function used', esc(node.madeWith || (node.code ? 'Not recorded' : 'Not generated yet'))],
  ];
  if (parent) facts.push(['Builds on', link(parent)]);
  if (node.combinedFrom?.length) facts.push(['Combined from', node.combinedFrom.map(id => link(nodesById.get(id))).join(', ')]);
  if (node.fromDiscussion && node.fromDiscussion !== node.id && nodesById.get(node.fromDiscussion)) {
    facts.push(['Built from the discussion of', link(nodesById.get(node.fromDiscussion))]);
  }
  if (node.variation) facts.push(['Variation instruction', esc(node.variation.replace(/^\[|\]$/g, ''))]);
  facts.push(['Data mode', modeLabel(node.builtShape || node.shape)]);
  if (log?.csvFileName) facts.push(['Data file', esc(log.csvFileName)]);
  if (log) facts.push(['Generated', `${esc(log.at.slice(0, 16).replace('T', ' '))} with ${esc(log.provider)} (${esc(log.model)})`]);
  if (kids.length) facts.push(['Branches from here', kids.map(link).join(', ')]);

  const discussion = (node.discussion || []).filter(m => m.content);
  const notes = aiNotes(node.response);

  return `<section class="card" id="card-${n}" style="--stage:${st.border};--stage-bg:${st.bg}">
<header><span class="num">${n}</span><h2>${esc(node.title || 'Untitled idea')}</h2><span class="badge">${st.label}</span></header>
<table class="facts">${facts.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>

<h3>What the person asked</h3>
${node.prompt.trim() ? `<blockquote>${esc(node.prompt.trim()).replace(/\n/g, '<br>')}</blockquote>` : '<p class="none">No written description.</p>'}
${node.sketch ? `<h3>The person's drawing</h3><img class="drawing" src="${node.sketch}" alt="Drawing for card ${n}">` : ''}

<h3>Prototype</h3>
${node.code ? `<div class="proto" data-num="${n}" data-mode="${(node.builtShape || node.shape) === 'timeseries' ? 'live' : 'dataset'}"><div class="proto-wait">Loading prototype…</div></div>
<details class="code"><summary>Code</summary><button class="copy" data-num="${n}">Copy code</button><pre data-num="${n}"></pre></details>` : '<p class="none">No prototype yet.</p>'}

${explanation(node, genStage)}
${notes ? `<h3>Notes the AI wrote with the code</h3><div class="ai">${prose(notes)}</div>` : ''}

<h3>Discussion</h3>
${discussion.length ? `<p class="sub">${node.useDiscussion !== false ? 'Given to the AI as background when generating.' : 'Not used when generating.'}</p>
<div class="discussion">${discussion.map(m => `<div class="msg ${m.role === 'user' ? 'person' : 'ai'}"><b>${m.role === 'user' ? 'Person' : 'AI'}</b>${prose(m.content)}</div>`).join('')}</div>`
    : '<p class="none">No discussion on this card.</p>'}

<h3>How the AI was prompted</h3>
${log ? `<ul class="sub">
<li>Drawing attached as an image: ${log.drawingAttached ? 'yes' : 'no'}</li>
<li>Earlier turns sent with it: ${log.earlierTurns} (the descriptions and responses of the cards this one builds on)</li></ul>
<details><summary>Message: the person's description and the context the tool added</summary><pre>${esc(log.user)}</pre></details>
<details><summary>System prompt: the stage and the rules the AI followed</summary><pre>${esc(log.system)}</pre></details>`
    : `<p class="none">${node.code ? 'Not recorded: this card was generated before prompts were recorded. Regenerate it to record one.' : 'Not generated yet.'}</p>`}
<p class="top"><a href="#contents">↑ Contents</a></p>
</section>`;
}

// Runs in the downloaded file: builds the prototypes as they scroll into view
// and feeds them the CSV the reader loads.
const PAGE_SCRIPT = `
var rows=[],columns=[],idx=0,timer=null;
function frame(f){f.type='bioframe';f.source='csv';f.timestamp=Date.now();return f;}
function dataFrame(fr){return fr.dataset.mode==='live'
  ?frame({mode:'live',data:{rows:rows,columns:columns,rowCount:rows.length},row:rows[idx],rowIndex:idx,rowCount:rows.length,columns:columns})
  :frame({mode:'dataset',data:{rows:rows,columns:columns,rowCount:rows.length}});}
function deliver(fr){if(rows.length&&fr.contentWindow)fr.contentWindow.postMessage(dataFrame(fr),'*');}
function tick(){idx=(idx+1)%rows.length;document.querySelectorAll('iframe[data-mode="live"]').forEach(function(fr){
  if(fr.contentWindow)fr.contentWindow.postMessage(frame({mode:'live',row:rows[idx],rowIndex:idx,rowCount:rows.length,columns:columns}),'*');});}
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var box=e.target;io.unobserve(box);
  var fr=document.createElement('iframe');fr.setAttribute('sandbox','allow-scripts');fr.dataset.mode=box.dataset.mode;
  fr.title='Prototype '+box.dataset.num;fr.onload=function(){deliver(fr);};fr.srcdoc=PROTOS[box.dataset.num].run;box.innerHTML='';box.appendChild(fr);});},{rootMargin:'300px'});
document.querySelectorAll('.proto').forEach(function(b){io.observe(b);});
document.querySelectorAll('pre[data-num]').forEach(function(p){p.textContent=PROTOS[p.dataset.num].code;});
document.querySelectorAll('button.copy').forEach(function(b){b.onclick=function(){navigator.clipboard.writeText(PROTOS[b.dataset.num].code).then(function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy code';},1500);});};});
document.getElementById('csv').onchange=function(e){var f=e.target.files[0];if(!f)return;
  if(!window.Papa){alert('The CSV reader could not load. It needs an internet connection.');return;}
  Papa.parse(f,{header:true,dynamicTyping:true,skipEmptyLines:true,complete:function(r){
    rows=r.data;columns=r.meta.fields||[];idx=0;document.getElementById('csv-name').textContent=f.name+' · '+rows.length+' rows';
    document.querySelectorAll('.proto iframe').forEach(deliver);clearInterval(timer);if(rows.length)timer=setInterval(tick,100);}});};
`;

const CSS = `
:root{--ink:#1c1b1a;--muted:#6b6862;--line:#e4e1da;--paper:#faf9f6;--card:#fff}
*{box-sizing:border-box}
body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);background:var(--paper)}
main{max-width:920px;margin:0 auto;padding:32px 16px 80px}
h1{font-size:24px;margin:0 0 4px}.meta{color:var(--muted);font-size:13px}
.loadbar{position:sticky;top:0;z-index:5;background:var(--paper);border-bottom:1px solid var(--line);padding:10px 0;margin:16px 0 24px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px}
.loadbar label{background:var(--ink);color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-weight:600}
#csv-name{color:var(--muted)}
.intro,.contents{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 20px;margin-bottom:20px}
.intro h2,.contents h2{font-size:16px;margin:0 0 8px}.intro p,.intro ul{margin:6px 0;font-size:14px}
.contents ul{list-style:none;padding-left:18px;margin:0}.contents>ul{padding-left:0}.contents li{margin:3px 0;font-size:14px}
.contents a{color:inherit}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:middle}
.how{color:var(--muted);font-size:12px}
.card{background:var(--card);border:1px solid var(--line);border-top:4px solid var(--stage);border-radius:10px;padding:20px 24px;margin:28px 0;scroll-margin-top:60px}
.card header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.card h2{font-size:19px;margin:0;flex:1}.num{font-weight:700;color:var(--stage);font-variant-numeric:tabular-nums}
.badge{background:var(--stage);color:#fff;font-size:11px;font-weight:700;padding:2px 10px;border-radius:10px;text-transform:uppercase;letter-spacing:.04em}
.facts{border-collapse:collapse;width:100%;font-size:13.5px;background:var(--stage-bg);border-radius:8px;overflow:hidden}
.facts th{text-align:left;font-weight:600;padding:6px 12px;width:190px;vertical-align:top;color:#3a3833}.facts td{padding:6px 12px}
.facts a,.card a{color:inherit}
h3{font-size:14px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:22px 0 8px}
.sub{font-size:13px;color:var(--muted);text-transform:none;letter-spacing:0;font-weight:400}
blockquote{margin:0;padding:10px 14px;border-left:3px solid var(--stage);background:var(--paper);border-radius:0 6px 6px 0}
.none{color:var(--muted);font-style:italic;font-size:14px}
.drawing{max-width:100%;max-height:360px;border:1px solid var(--line);border-radius:6px;background:#fff}
.proto{border:1px solid var(--line);border-radius:8px;overflow:hidden;resize:vertical;height:440px;background:#fff}
.proto iframe{width:100%;height:100%;border:0;display:block}.proto-wait{padding:16px;color:var(--muted);font-size:13px}
details{margin:8px 0;font-size:14px}summary{cursor:pointer;color:#3a3833;font-weight:500}
pre{background:#f4f2ee;border-radius:6px;padding:12px;overflow:auto;max-height:480px;font-size:12px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.copy{float:right;margin:6px 0;font-size:12px;padding:3px 10px;border:1px solid var(--line);background:#fff;border-radius:5px;cursor:pointer}
.ai p{margin:0 0 8px}.discussion{display:flex;flex-direction:column;gap:8px}
.msg{padding:8px 12px;border-radius:8px;font-size:14px;max-width:88%}.msg p{margin:2px 0}
.msg.person{background:var(--stage-bg);align-self:flex-end}.msg.ai{background:#f1f0ec}
.top{text-align:right;font-size:12px;margin:16px 0 0}
@media print{.loadbar,.proto,.copy,.top{display:none}details{display:block}details>*{display:block}.card{break-inside:avoid-page}}
`;

// The whole session travels inside the file, so the same file is both the
// readable report and what Open in Biosketch loads to keep working.
const SESSION_ID = 'biosketch-session';

export function readSessionFromFile(text) {
  const open = `<script type="application/json" id="${SESSION_ID}">`;
  const start = text.indexOf(open);
  if (start === -1) return null;
  const end = text.indexOf('</script>', start);
  return end === -1 ? null : text.slice(start + open.length, end);
}

export function buildExportFile(nodes, sessionJson) {
  const nodesById = new Map(nodes.map(n => [n.id, n]));
  const children = (id) => nodes.filter(n => n.parentId === id);
  const roots = nodes.filter(n => !n.parentId || !nodesById.has(n.parentId));

  // Number the tree: 1, 1.1, 1.2, 2 …
  const num = new Map();
  const order = [];
  const walk = (n, label) => {
    num.set(n.id, label);
    order.push(n);
    children(n.id).forEach((c, i) => walk(c, `${label}.${i + 1}`));
  };
  roots.forEach((r, i) => walk(r, String(i + 1)));
  const ctx = { num, nodesById, children };

  const tocItem = (n) => {
    const st = stageOf(n.promptLog?.stage || n.stage);
    const how = n.madeWith ? n.madeWith.split(':')[0].replace(/"/g, '') : n.code ? '' : 'not generated';
    const kids = children(n.id);
    return `<li><span class="dot" style="background:${st.border}"></span><a href="#card-${num.get(n.id)}">${num.get(n.id)} · ${esc(n.title || 'Untitled idea')}</a> <span class="how">${st.label}${how ? ' · ' + esc(how) : ''}</span>${kids.length ? `<ul>${kids.map(tocItem).join('')}</ul>` : ''}</li>`;
  };

  const protos = {};
  for (const n of order) {
    if (!n.code) continue;
    const run = withBridge(n.code);
    protos[num.get(n.id)] = { code: n.code, run: builtStageOf(n) === 'sketch' ? withSketchLook(run) : run };
  }
  // Safe inside <script>: escaping "<" means no "</script>" or "<!--" can appear.
  const protoJson = JSON.stringify(protos).replace(/</g, '\\u003c');

  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Biosketch exploration</title>
<style>${CSS}</style>
<script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"><\/script>
</head><body><main>
<h1>Biosketch exploration</h1>
<div class="meta">Downloaded ${stamp} · ${nodes.length} card${nodes.length === 1 ? '' : 's'}</div>

<div class="loadbar"><label>Load CSV<input id="csv" type="file" accept=".csv,text/csv" hidden></label>
<span id="csv-name">Load your CSV to run the prototypes with your data. Your data is not saved in this file.</span></div>

<div class="intro"><h2>How to read this file</h2>
<p><b>To keep working on these ideas</b>, open this file in Biosketch with <b>Open</b>: your canvas comes back as you left it.</p>
<p>Every card on the canvas has its own section below. Numbers follow the tree: <b>1.2</b> is the second branch made from idea <b>1</b>.</p>
<p>Each section gives the card's prototype level, the function that made it (Generate, What else?, Keep / Change, Explore variations, Combine, Prototype it, Develop), what the person asked, their drawing, the running prototype and its code, what the AI said about it (back-talk on sketches, “Why this design?” in later stages), the discussion, and exactly how the AI was prompted.</p>
<ul>${Object.entries(LEVELS).map(([k, v]) => `<li><span class="dot" style="background:${stageOf(k).border}"></span><b>${stageOf(k).label}</b>: ${v}</li>`).join('')}</ul></div>

<nav class="contents" id="contents"><h2>Contents</h2><ul>${roots.map(tocItem).join('')}</ul></nav>

${order.map(n => section(n, ctx)).join('\n')}
</main>
<script>var PROTOS=${protoJson};${PAGE_SCRIPT}<\/script>
${sessionJson ? `<script type="application/json" id="${SESSION_ID}">${sessionJson.replace(/</g, '\\u003c')}<\/script>` : ''}
</body></html>`;

  return { blob: new Blob([html], { type: 'text/html' }), name: `biosketch-${stamp.slice(0, 10)}-${stamp.slice(11, 16).replace(':', '')}.html` };
}

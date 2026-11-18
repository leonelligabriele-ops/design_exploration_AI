// Demo provider: no AI, no API key. Streams back placeholder output built
// from the request so every flow (generate, questions, variations, develop,
// discussion) can be tried end to end. Output is clearly labelled as demo.

const CHUNK = 48;      // characters per streamed chunk
const TICK_MS = 12;    // delay between chunks
const START_MS = 350;  // "thinking" delay before the first chunk

export async function sendDemo(messages, systemPrompt, callbacks) {
  const last = messages[messages.length - 1];
  const text = textOf(last?.content);
  const hasDrawing = Array.isArray(last?.content) && last.content.some(p => p.type === 'image');

  let reply;
  if (systemPrompt.includes('reflective thinking partner')) {
    reply = discussionReply(text, systemPrompt);
  } else if (systemPrompt.includes('sketch "talks back"')) {
    reply = backtalkReply();
  } else if (systemPrompt.includes('understand your thinking behind it')) {
    reply = rationaleReply(systemPrompt);
  } else {
    reply = appReply(text, hasDrawing, messages);
  }

  await sleep(START_MS);
  for (let i = 0; i < reply.length; i += CHUNK) {
    callbacks.onToken(reply.slice(i, i + CHUNK));
    await sleep(TICK_MS);
  }
  callbacks.onDone();
}

function textOf(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter(p => p.type === 'text').map(p => p.text).join('\n');
  return '';
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Discussion ──

function discussionReply(text, system) {
  const csv = (system.match(/```csv\n([\s\S]*?)\n```/) || [])[1];
  const parsed = csv ? window.Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true }) : null;
  const cols = (parsed?.meta.fields || []).map(c => {
    const nums = parsed.data.map(r => r[c]).filter(v => typeof v === 'number' && isFinite(v));
    return nums.length ? [null, c, Math.min(...nums), Math.max(...nums)] : null;
  }).filter(Boolean);
  const firstCol = cols.find(m => !/time|index|^t$/i.test(m[1])) || cols[0] || [];
  const said = text.length > 90 ? text.slice(0, 90) + '…' : text;
  const dataLine = firstCol[1]
    ? `Looking at your data, I read "${firstCol[1]}" as the main measure — it ranges from ${firstCol[2]} to ${firstCol[3]}. Is that the measure you have in mind, or something else?`
    : 'There is no CSV loaded, so I can only reflect on the idea itself, not on your data.';
  return `[Demo reply — not written by AI]\n\nYou said: "${said}"\n\n${dataLine} In a real session I would also question an assumption I see in what you wrote, and explain my own reading so you can challenge it.`;
}

// ── Why this design? ──

function rationaleReply(system) {
  const stage = (system.match(/^Stage: (\w+)/m) || [])[1] || 'SKETCH';
  const fn = (system.match(/^Function used: (.+)$/m) || [])[1] || '"Generate".';
  return '[Demo explanation — not written by AI]\n\n'
    + `This prototype is at the ${stage.toLowerCase()} stage and was made with ${fn}\n\n`
    + 'A real AI would think aloud here, in its own words: how it understood your request, what it noticed in your description, drawing, discussion or data, what it weighed up, where it was unsure, and why it ended up with this design.';
}

// ── Sketch back-talk ──

function backtalkReply() {
  return '[Demo back-talk — not written by AI]\n\n'
    + 'A real AI would say here what this sketch makes visible about your idea that was not obvious before, '
    + 'where the idea, the sketch and your data do not quite fit, and what the sketch still leaves open.\n\n'
    + 'What do you notice when you look at it?';
}

// ── Generated app ──

function appReply(text, hasDrawing, messages) {
  const stage = ((text.match(/\[Stage: (\w+)\]/) || [])[1] || 'SKETCH').toLowerCase();
  // Show the person's own words: skip the app's internal "(No description…)"
  // placeholders and fall back to the most recent real description.
  const descriptions = messages
    .filter(m => m.role === 'user')
    .map(m => textOf(m.content).split('\n\n[')[0].trim())
    .filter(d => d && !d.startsWith('('));
  // Prototype from a discussion: use the person's first message as the heading.
  const fromDiscussion = text.includes('prototype based on this discussion')
    && (text.match(/\nPerson: (.+)/) || [])[1];
  // Combine: name the source prototypes (plus the focus, if one was given).
  const combinedTitles = [...text.matchAll(/^### Prototype \d+: (.+?) \(\w+ stage\)$/gm)].map(m => m[1]);
  const focusText = text.split('\n\n[')[0].trim();
  const combinedHeading = combinedTitles.length
    ? `Combined: ${combinedTitles.join(' + ')}${focusText.startsWith('(') ? '' : ` — focus: ${focusText}`}`
    : null;
  const description = combinedHeading || fromDiscussion
    || descriptions[descriptions.length - 1] || (hasDrawing ? 'Your drawn idea' : 'Your idea');
  const focus = (text.match(/Variation focus: rethink (?:how the data is |the )?(\w+)/) || [])[1]?.toLowerCase()
    || (text.match(/Design variation: Focus on (\w+)|Design variation: Try an (\w+)/) || []).slice(1).find(Boolean)?.toLowerCase()
    || null;

  const html = buildApp({ stage, description, focus, hasDrawing });
  return `\`\`\`html\n${html}\n\`\`\``;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// One script for all stages: picks the first numeric (non-time) column and
// drives the visual element with its value, scaled to the data range.
// Whole dataset: the demo steps through the rows by itself.
// Live replay: each arriving row drives it.
function dataScript(render) {
  return `<script>
var col=null,min=0,max=1,base=null,rows=[],walker=null;
function pick(row){var ks=Object.keys(row);return ks.find(function(k){return typeof row[k]==='number'&&!/time|index|^t$/i.test(k)})||ks.find(function(k){return typeof row[k]==='number'})||null;}
function setup(data){
  rows=data.rows||[];col=rows.length?pick(rows[0]):null;base=null;
  if(!col){document.getElementById('val').textContent='No numeric column found';return;}
  var vs=rows.map(function(r){return r[col]}).filter(function(v){return typeof v==='number'});
  if(vs.length){min=Math.min.apply(null,vs);max=Math.max.apply(null,vs);}if(max===min)max=min+1;
}
function show(row){
  if(!col||!row)return;var v=row[col];if(typeof v!=='number')return;if(base===null)base=v;
  var t=Math.max(0,Math.min(1,(v-min)/(max-min)));
  (${render})(v,t,base,col);
}
window.onBioframe=function(f){
  if(f.data)setup(f.data);
  if(f.mode==='live'){if(walker){clearInterval(walker);walker=null;}show(f.row);return;}
  if(walker)clearInterval(walker);var i=0;
  walker=setInterval(function(){if(rows.length){show(rows[i%rows.length]);i++;}},120);
};
<\/script>`;
}

function buildApp({ stage, description, focus, hasDrawing }) {
  const title = esc(description.length > 80 ? description.slice(0, 80) + '…' : description);
  const drawing = (focus ? `<div class="note">Variation: ${esc(focus)}</div>` : '')
    + (hasDrawing ? '<div class="note">Your drawing was received.</div>' : '');
  const banner = '<div class="demo">DEMO OUTPUT · placeholder, not made by AI</div>';

  if (stage === 'sketch') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:16px;font-family:system-ui,sans-serif;color:#222;background:#fff}
.demo{font-size:11px;letter-spacing:.05em;color:#888;border:1px dashed #bbb;padding:4px 8px;display:inline-block;margin-bottom:12px}
h1{font-size:16px;font-weight:600;margin:0 0 12px}.note{font-size:12px;color:#888;margin-bottom:8px}
.box{border:1.5px solid #333;height:120px;position:relative}
.bar{position:absolute;left:0;bottom:0;height:100%;width:0;background:#ddd;border-right:2px solid #333;transition:width .1s}
.val{position:absolute;right:8px;top:8px;font-size:14px}
</style></head><body>${banner}<h1>${title}</h1>${drawing}
<div class="box"><div class="bar" id="bar"></div><div class="val" id="val">–</div></div>
${dataScript(`function(v,t){document.getElementById('bar').style.width=(t*100)+'%';document.getElementById('val').textContent=v;}`)}
</body></html>`;
  }

  if (stage === 'explore') {
    const variants = {
      represented: { css: '', render: `function(v,t){var c=document.getElementById('c');var s=40+t*140;c.style.width=s+'px';c.style.height=s+'px';c.style.background='hsl('+(220-t*180)+',70%,60%)';document.getElementById('val').textContent=v;}` },
      interaction: { css: '#c{cursor:pointer}', render: `function(v,t){var c=document.getElementById('c');c.style.width='150px';c.style.height='150px';c.style.background='hsl(260,60%,'+(85-t*40)+'%)';document.getElementById('val').textContent=window.__show?v:'tap';}` },
      interpreted: { css: '', render: `function(v,t,b){var d=v-b;var c=document.getElementById('c');c.style.width='150px';c.style.height='150px';c.style.background=d>=0?'#86efac':'#fca5a5';document.getElementById('val').textContent=(d>=0?'+':'')+d.toFixed(1);}` },
    };
    const vkey = focus === 'interaction' ? 'interaction' : focus === 'interpreted' ? 'interpreted' : 'represented';
    const vr = variants[vkey];
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:16px;font-family:system-ui,sans-serif;color:#1f2937;background:#f8fafc}
.demo{font-size:11px;letter-spacing:.05em;color:#7c3aed;border:1px dashed #c4b5fd;padding:4px 8px;display:inline-block;margin-bottom:12px}
h1{font-size:16px;margin:0 0 4px}.note{font-size:12px;color:#888;margin-bottom:4px}
.stage{height:200px;display:flex;align-items:center;justify-content:center}
#c{border-radius:50%;width:60px;height:60px;display:flex;align-items:center;justify-content:center;font-weight:700;transition:all .15s;background:#c7d2fe}
${vr.css}
</style></head><body>${banner}<h1>${title}</h1>${drawing}
<div class="stage"><div id="c" onclick="window.__show=!window.__show"><span id="val">–</span></div></div>
${dataScript(vr.render)}
</body></html>`;
  }

  // refine
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:20px;font-family:system-ui,sans-serif;color:#0f172a;background:linear-gradient(#ecfdf5,#f8fafc);display:flex;justify-content:center}
.wrap{max-width:360px;width:100%}.demo{font-size:11px;letter-spacing:.05em;color:#059669;border:1px dashed #6ee7b7;padding:4px 8px;display:inline-block;margin-bottom:12px;border-radius:6px}
.card{background:#fff;border-radius:18px;padding:20px;box-shadow:0 6px 24px rgba(0,0,0,.08);text-align:center}
h1{font-size:17px;margin:0 0 12px}.note{font-size:12px;color:#888;margin-bottom:8px}
svg{display:block;margin:0 auto}#val{font-size:28px;font-weight:700;margin-top:-92px;height:92px}
</style></head><body><div class="wrap">${banner}<div class="card"><h1>${title}</h1>${drawing}
<svg width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="64" fill="none" stroke="#e2e8f0" stroke-width="14"/>
<circle id="ring" cx="80" cy="80" r="64" fill="none" stroke="#10b981" stroke-width="14" stroke-linecap="round" stroke-dasharray="402" stroke-dashoffset="402" transform="rotate(-90 80 80)" style="transition:stroke-dashoffset .2s"/></svg>
<div id="val">–</div></div></div>
${dataScript(`function(v,t){document.getElementById('ring').style.strokeDashoffset=402*(1-t);document.getElementById('val').textContent=v;}`)}
</body></html>`;
}

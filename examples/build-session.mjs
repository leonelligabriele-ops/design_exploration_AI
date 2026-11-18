// Builds acl-examples-session.json: the cards and exact prompts recorded from
// the app (Demo provider), with the Demo placeholders replaced by example
// prototypes written by following those prompts.
import { readFileSync, writeFileSync } from 'fs';
const rec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const code = (f) => readFileSync(new URL(`./prototypes/${f}`, import.meta.url), 'utf8');

const EXAMPLES = {
  sketch: { file: '1-sketch.html', pos: [420, 40], kind: 'backtalk', text:
`Drawn out, the idea becomes two screens for two people, and they ask different things of the same data. The patient's side only needs two numbers, the start and today, and the sketch shows how much that gap says on its own. But the bend has hardly moved in the last ten days (114–122°), so a "compared with the start" view will look the same day after day.

The physio's dots are spread out: pain sits between 3 and 6 whatever the exercise minutes, and two days have no value at all.

Still open: how often each person looks, and what the patient sees on a day the bend goes down.

What should the patient feel when the number stops moving?` },
  'New representation': { file: '2-explore-representation.html', pos: [60, 700], kind: 'why', text:
`I read "compared with where they started" as something to see at a glance, not a number to read. So I drew the leg itself: the thigh stays still and every day adds one stroke of the lower leg from the same knee. Over six weeks the strokes open like a fan, and the width of the fan *is* the progress. The first day stays as a dashed ghost to measure against.

Pain didn't need its own chart; I let it colour each stroke, cool on calm days and warm on sore ones, so warm strokes stand out in the fan. A short replay lets the fan open again, because watching it grow is what makes the change felt. p5.js made the drawing and the replay simple. No sound: nothing in the situation calls for it.` },
  'New interaction': { file: '3-explore-interaction.html', pos: [420, 700], kind: 'why', text:
`I asked who looks at this, and when. Being surprised by your own progress can be motivating, so I made it a turn-taking moment in a session: the patient first drags the leg to where it *feels* it bends, then sees the real angle and the starting angle. The gap between feeling and data becomes the conversation.

For the physio's question I used the same pattern: guess first, then look at the data together, so the numbers open a discussion instead of closing it. A yes-or-no question deserves a plain answer, so I compared the easier and harder half of the days instead of drawing a chart. Plain SVG was enough; no library.` },
  'New interpretation': { file: '4-explore-interpretation.html', pos: [780, 700], kind: 'why', text:
`I questioned what "compared with where they started" should measure. Daily angles jump by a few degrees, so I averaged each week and compared it with the mean of the first three days. The steps show steady gains that slow down in the last weeks.

For pain, looking at the data, it seemed to follow exercise the *day after* rather than the same day, so I show both side by side with how strongly each is linked. I was unsure about showing r values to a clinician, so they sit next to plain words. With 42 days this is a hint, not proof, and the app says so. D3 for the custom visuals, simple-statistics for the numbers.` },
  refine: { file: '5-refine.html', pos: [780, 1020], kind: 'why', text:
`I kept the ideas of the interpretation version and split them by who reads them. The patient view answers one question, how far the knee bends now compared with the start: the angle drawn as a leg over the dashed starting position, the number, and the gain. The weekly steps stay, as the calmer view of progress.

The physio view turns the earlier pair of scatter plots into one sentence and two numbers: average pain the day after harder versus easier days. Below are the most painful days with the exercise the day before, so specific dates can be checked with the patient. I kept the note about the small sample. GSAP gives the leg and the bars a short, smooth entrance; simple-statistics does the numbers.` },
};

const nodes = rec.nodes.map(n => {
  const ex = n.stage === 'sketch' ? EXAMPLES.sketch : n.stage === 'refine' ? EXAMPLES.refine : EXAMPLES[n.title];
  if (!ex) return { ...n, x: 420, y: 380, response: '', code: '' };   // the Explore card the variations came from
  const html = code(ex.file);
  return { ...n, x: ex.pos[0], y: ex.pos[1], code: html, response: '```html\n' + html + '\n```',
    rationale: { text: ex.text, loading: false, kind: ex.kind } };
});
const refine = nodes.find(n => n.stage === 'refine');
refine.title = 'Patient + physio app';
writeFileSync(process.argv[3], JSON.stringify({ ...rec, provider: 'demo', nodes }, null, 2));
console.log(nodes.map(n => `${n.stage.padEnd(8)} ${n.title.padEnd(22)} code ${String(n.code.length).padStart(5)}  prompt ${n.promptLog ? 'recorded' : '-'}`).join('\n'));

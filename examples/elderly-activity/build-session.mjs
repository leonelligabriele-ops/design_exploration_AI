// Builds elderly-examples-session.json: the cards and exact prompts recorded
// from the app (Demo provider), with the Demo placeholders replaced by example
// prototypes written by following those prompts.
import { readFileSync, writeFileSync } from 'fs';
const rec = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const code = (f) => readFileSync(new URL(`./prototypes/${f}`, import.meta.url), 'utf8');

const EXAMPLES = {
  sketch: { file: '1-sketch.html', pos: [420, 40], kind: 'backtalk', text:
`Drawn out, the idea splits into two very different screens. Theirs has room for one sentence and seven circles, and that limit is the point: what goes into that one sentence decides whether it feels kind or judging.

The family view shows something theirs hides: a week in early September when steps fell to about 1,100 a day and resting heart rate rose from 66 to 72. On their own screen that week would just look like seven small circles.

Still open: the device, and what a quiet day looks like. On 26 September there is no data at all, because the watch was barely worn.

When they have had a quiet week for a reason, what should their screen say?` },
  'New representation': { file: '2-explore-representation.html', pos: [60, 700], kind: 'why', text:
`The worry in the request was making people feel they are failing, and goals and charts are built on falling short. So I took the goal away and made walking a journey: one path, and every day moves them along it. A quiet day moves them a little; nobody goes backwards. The total, over 110 km since August, is something to be proud of rather than measured against.

The leaves mark longer walks outside, because in the data the outdoor days are the big ones, and they are nice to spot. I kept it calm, with warm paper colours and a serif font, so it feels like a picture rather than an app. p5.js made the winding path simple.` },
  'New interaction': { file: '3-explore-interaction.html', pos: [420, 700], kind: 'why', text:
`Many of the people in the description are not used to technology, so I asked what the simplest possible interaction is: one big button that answers a question in plain words. It is spoken aloud, because small text on a screen is hard for many older adults to read, and also shown in large text. No menus, no charts.

The words compare with their own usual days, never with a target, and a quieter day gets a calm sentence instead of a warning. I was unsure whether "Well done" sounds patronising; that is worth testing with them. The browser's built-in speech was enough, so no library.` },
  'New interpretation': { file: '4-explore-interpretation.html', pos: [780, 700], kind: 'why', text:
`I questioned what an "active day" means for someone over 75. A fixed target makes most days look like failure, so each day is coloured against their own usual instead (about 3,600 steps).

Looking at the data, the quiet week in September falls exactly where resting heart rate is well above their normal. Marking those days changes how the week reads: their body was asking for rest. The most active days are Tuesdays and Thursdays, with over an hour outside. Something regular happens then that might be worth building on, though the data cannot say what. D3 for the calendar, simple-statistics for the medians.` },
  refine: { file: '5-refine.html', pos: [780, 1020], kind: 'why', text:
`I kept the main idea of the interpretation version, comparing with their own usual, and split it by who reads it. Their view shows yesterday in very large type with one kind sentence, and the week as seven big circles with the level written underneath, so it does not rely on colour alone.

The family and physio view keeps the eight-week calendar and turns the raised-heart-rate week into a sentence with dates and numbers, so it can be talked about. The Tuesday and Thursday pattern stays a question to ask, not advice. Pico.css gives clean, large defaults; simple-statistics does the medians.` },
};

const nodes = rec.nodes.map(n => {
  const ex = n.stage === 'sketch' ? EXAMPLES.sketch : n.stage === 'refine' ? EXAMPLES.refine : EXAMPLES[n.title];
  if (!ex) return { ...n, x: 420, y: 380, response: '', code: '' };   // the Explore card the variations came from
  const html = code(ex.file);
  return { ...n, x: ex.pos[0], y: ex.pos[1], code: html, response: '```html\n' + html + '\n```',
    rationale: { text: ex.text, loading: false, kind: ex.kind } };
});
nodes.find(n => n.stage === 'refine').title = 'Move a little: app';
writeFileSync(process.argv[3], JSON.stringify({ ...rec, provider: 'demo', nodes }, null, 2));
console.log(nodes.map(n => `${n.stage.padEnd(8)} ${n.title.padEnd(24)} code ${String(n.code.length).padStart(5)}  prompt ${n.promptLog ? 'recorded' : '-'}`).join('\n'));

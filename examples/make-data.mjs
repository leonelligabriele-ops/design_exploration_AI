// Synthetic ACL rehabilitation log (not real patient data): 42 days, from
// post-operative day 14. Flexion improves quickly then levels off; pain eases
// but rises after days with more exercise; two cells are missing on purpose.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const noise = (a) => (rnd() - 0.5) * 2 * a;
const rows = [];
let prevEx = 25;
for (let d = 0; d < 42; d++) {
  const date = new Date(Date.UTC(2026, 7, 31 + d)).toISOString().slice(0, 10);
  const weekend = [0, 6].includes(new Date(date).getUTCDay());
  const ex = Math.round(Math.max(10, 20 + d * 0.6 + (weekend ? -8 : 6) + noise(9) + (d % 9 === 4 ? 22 : 0)));
  const flex = Math.round(72 + 52 * (1 - Math.exp(-d / 16)) + noise(3));
  const ext = Math.round(Math.min(0, -8 + d * 0.22 + noise(1.2)));
  const pain = Math.max(0, Math.min(10, Math.round(5.2 - d * 0.075 + (prevEx - 30) * 0.06 + (ex - 30) * 0.03 + noise(0.8))));
  const steps = Math.round(1500 + d * 140 + noise(500) + (weekend ? 900 : 0));
  const swell = Math.max(0, +(3.4 - d * 0.06 + (prevEx - 30) * 0.015 + noise(0.25)).toFixed(1));
  rows.push([date, d === 16 ? '' : flex, ext, d === 29 ? '' : pain, ex, steps, swell]);
  prevEx = ex;
}
console.log(['date', 'knee_flexion_deg', 'knee_extension_deg', 'pain_0_10', 'exercise_minutes', 'steps', 'swelling_cm'].join(','));
rows.forEach(r => console.log(r.join(',')));

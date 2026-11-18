// Synthetic smartwatch data for one older adult (not a real person): 8 weeks
// of daily summaries. Built-in patterns: a walking group on Tuesdays and
// Thursdays, quieter Sundays, a week of being unwell in week 4 (resting heart
// rate up, sleep down, little movement), a slow recovery, and one day the
// watch was not worn (empty row values).
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const noise = (a) => (rnd() - 0.5) * 2 * a;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const cols = ['date', 'weekday', 'steps', 'active_minutes', 'distance_km', 'floors_climbed', 'outdoor_minutes',
  'sedentary_hours', 'resting_heart_rate', 'hrv_ms', 'sleep_hours', 'watch_worn_hours'];
console.log(cols.join(','));
for (let d = 0; d < 56; d++) {
  const dt = new Date(Date.UTC(2026, 7, 17 + d));
  const wd = dt.getUTCDay();
  const ill = d >= 22 && d <= 27 ? 1 : 0;                         // unwell
  const rec = d > 27 && d < 36 ? (36 - d) / 8 : 0;                 // recovering
  const group = (wd === 2 || wd === 4) && !ill ? 1 : 0;            // walking group
  const trend = 1 + d * 0.004;
  let steps = (3300 + noise(700)) * trend;
  if (group) steps += 2300 + noise(400);
  if (wd === 0) steps *= 0.7;
  steps *= ill ? 0.38 : 1 - 0.35 * rec;
  steps = Math.round(steps);
  const date = dt.toISOString().slice(0, 10);
  if (d === 40) { console.log([date, DAYS[wd], '', '', '', '', '', '', '', '', '', 2].join(',')); continue; }
  const active = Math.round(steps / 105 + noise(4) + (group ? 8 : 0));
  const km = +(steps * 0.00055).toFixed(2);
  const floors = Math.max(0, Math.round(steps / 1400 + noise(1.2)));
  const outdoor = Math.max(0, Math.round((group ? 70 : 22) * (ill ? 0.15 : 1 - 0.4 * rec) + noise(10)));
  const sedentary = +(10.2 - steps / 1500 + ill * 2 + noise(0.6)).toFixed(1);
  const rhr = Math.round(66 + ill * 7 + rec * 4 - d * 0.03 + noise(1.5));
  const hrv = Math.round(28 - ill * 7 - rec * 3 + noise(2.5));
  const sleep = +(6.9 - ill * 1.1 - rec * 0.4 + (group ? 0.3 : 0) + noise(0.5)).toFixed(1);
  console.log([date, DAYS[wd], steps, active, km, floors, outdoor, sedentary, rhr, hrv, sleep, +(15.5 + noise(1)).toFixed(1)].join(','));
}

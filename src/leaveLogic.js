// Pure logic for the Leave Optimiser (no React) so it can be tested on its own.
import { isPublicHoliday, addIso, diffDays } from "./nzHolidays.js";

const mod = (n, m) => ((n % m) + m) % m;
const median = a => { const s=[...a].sort((x,y)=>x-y); return s.length ? s[Math.floor((s.length-1)/2)] : null; };

// known: Map(dateISO -> true when rostered to work, false when off). Finds the on/off run lengths
// and the first day of a days-off block from complete runs in the imported roster.
export function detectPattern(known){
  const dates = [...known.keys()].sort();
  const onRuns = [], offRuns = [];     // lengths of complete runs
  const offStarts = [];                // {start,len} of complete off runs
  let seg = [];
  const flush = () => {
    if(!seg.length) return;
    const runs = [];
    for(const d of seg){
      const w = known.get(d), last = runs[runs.length-1];
      if(last && last.w === w) last.days.push(d); else runs.push({ w, days:[d] });
    }
    runs.forEach((r,i) => {
      if(i === 0 || i === runs.length-1) return;   // edges are cut off by the roster window
      (r.w ? onRuns : offRuns).push(r.days.length);
      if(!r.w) offStarts.push({ start:r.days[0], len:r.days.length });
    });
    seg = [];
  };
  for(const d of dates){
    if(seg.length && diffDays(seg[seg.length-1], d) !== 1) flush();
    seg.push(d);
  }
  flush();
  const on = median(onRuns), off = median(offRuns);
  const good = offStarts.filter(o => o.len === off);   // ignore off-runs stretched by leave/sick days
  const anchor = good.length ? good[good.length-1].start : null;
  return {
    on:  on  && on  >= 1 && on  <= 14 ? on  : null,
    off: off && off >= 1 && off <= 7  ? off : null,
    anchor,
  };
}

// true = off, false = working, null = unknown (no pattern anchor yet)
export function makeOffFn(known, { on, off, anchor }){
  const cycle = on + off;
  return date => {
    if(known.has(date)) return !known.get(date);
    if(!anchor || cycle < 2) return null;
    return mod(diffDays(anchor, date), cycle) < off;
  };
}

// Annual leave only counts a day that would otherwise be worked. A day already off is free, and a
// public holiday that falls on a working day is paid as the holiday rather than taken from leave.
export function leaveCost(date, offAt){
  const o = offAt(date);
  if(o === null) return Infinity;
  if(o) return 0;
  return isPublicHoliday(date) ? 0 : 1;
}

// Best consecutive breaks using at most `budget` leave days, starting inside [monthStart, monthEnd].
export function findBreaks({ today, monthStart, monthEnd, budget, offAt, limit = 3 }){
  const found = new Map();
  const firstLeave = addIso(today, 1);                       // leave can only be booked from tomorrow
  for(let s = monthStart > firstLeave ? monthStart : firstLeave; s <= monthEnd; s = addIso(s, 1)){
    let spent = 0, e = null;
    for(let d = s, n = 0; n < 45; d = addIso(d, 1), n++){
      const c = leaveCost(d, offAt);
      if(spent + c > budget) break;
      spent += c; e = d;
    }
    if(!e) continue;
    let b = s;                                               // pull the break back over days already off
    while(b > today && leaveCost(addIso(b, -1), offAt) === 0) b = addIso(b, -1);
    const days = [];
    for(let d = b; d <= e; d = addIso(d, 1)){
      const off = offAt(d), ph = isPublicHoliday(d);
      const kind = off ? (ph ? "ph" : "off") : (ph ? "phSaved" : "leave");
      days.push({ date:d, kind });
    }
    const leaveDays = days.filter(x => x.kind === "leave").map(x => x.date);
    if(!leaveDays.length) continue;
    found.set(b + "|" + e, { start:b, end:e, total:days.length, days, leaveDays,
      savedHolidays: days.filter(x => x.kind === "phSaved").map(x => x.date) });
  }
  const ranked = [...found.values()].sort((x,y) =>
    y.total - x.total || x.leaveDays.length - y.leaveDays.length || (x.start < y.start ? -1 : 1));
  const picked = [];
  for(const r of ranked){                                    // no overlapping suggestions
    if(picked.every(p => r.end < p.start || r.start > p.end)) picked.push(r);
    if(picked.length >= limit) break;
  }
  return picked;
}

// Air NZ team year planners (2026 and 2027 both checked against this cycle): every team repeats the same 9-day cycle - 3 days off, 3 earlies, 3 lates -
// and the three teams are offset by 3 days. `anchor` is the first day of one of that team's days-off blocks.
export const TEAMS = {
  alpha:   { label: "Alpha",   on: 6, off: 3, anchor: "2026-01-06" },
  bravo:   { label: "Bravo",   on: 6, off: 3, anchor: "2026-01-03" },
  charlie: { label: "Charlie", on: 6, off: 3, anchor: "2025-12-31" },
};
export const TEAM_PLANNER_END = "2027-12-31";   // the published planners cover calendar 2026 and 2027
// Which team (if any) an anchor date belongs to.
export function teamForAnchor(anchor){
  if(!anchor) return "";
  for(const [k, t] of Object.entries(TEAMS)) if(mod(diffDays(t.anchor, anchor), 9) === 0) return k;
  return "";
}

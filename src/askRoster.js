// "Ask your roster": understands a fixed set of everyday questions by matching keywords and dates,
// then answers from the team planner, the user's leave plan and (when available) their imported roster.
// No AI involved. Returns {headline, lines[]} or null when the question isn't understood.
import { addIso, diffDays, listHolidays, isPublicHoliday, holidayName } from "./nzHolidays.js";
import { TEAMS } from "./leaveLogic.js";

const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
const MON3 = MONTHS.map(m => m.slice(0,3));
const WEEKDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
const WD3 = WEEKDAYS.map(w => w.slice(0,3));
const mod = (n, m) => ((n % m) + m) % m;
const wdOf = iso => new Date(`${iso}T12:00:00Z`).getUTCDay();
const NAME = {E: "an Early", L: "a Late", X: "off"};
const WORD = {E: "Early", L: "Late", X: "Off"};

const fmt = (iso, withYear) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-NZ",
  {weekday: "short", day: "numeric", month: "short", ...(withYear ? {year: "numeric"} : {}), timeZone: "UTC"});
const pad = n => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const validDay = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

const HOLIDAY_WORDS = [
  [/christmas/, "Christmas Day"], [/boxing/, "Boxing Day"], [/new year/, "New Year's Day"],
  [/waitangi/, "Waitangi Day"], [/good friday/, "Good Friday"], [/easter/, "Easter Monday"], [/anzac/, "ANZAC Day"],
  [/king'?s birthday/, "King's Birthday"], [/matariki/, "Matariki"], [/labour day/, "Labour Day"],
  [/auckland anniversary/, "Auckland Anniversary"],
];

// Finds one date in the question: today/tomorrow, a holiday name, "25 dec", "dec 25", "25/12", or a weekday.
export function parseDate(q, today) {
  if (/day after tomorrow/.test(q)) return addIso(today, 2);
  if (/\btomorrow\b/.test(q)) return addIso(today, 1);
  if (/\btoday\b|\btonight\b/.test(q)) return today;
  const yearMatch = q.match(/\b(20\d\d)\b/);
  const hol = HOLIDAY_WORDS.find(([re]) => re.test(q));
  if (hol) {
    const all = listHolidays().filter(h => h.name.startsWith(hol[1]));
    const pick = yearMatch ? all.find(h => h.date.startsWith(yearMatch[1])) : all.find(h => h.date >= today);
    if (pick) return pick.date;
  }
  const todayY = +today.slice(0, 4);
  const resolve = (d, m, y) => {
    if (!validDay(y || todayY, m, d)) return null;
    let res = iso(y || todayY, m, d);
    if (!y && res < today) res = iso(todayY + 1, m, d);
    return res;
  };
  let m = q.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : yearMatch ? +yearMatch[1] : 0; const r = resolve(+m[1], +m[2], y); if (r) return r; }
  const monRe = MON3.join("|");
  m = q.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monRe})[a-z]*\\b`));
  if (m) { const r = resolve(+m[1], MON3.indexOf(m[2]) + 1, yearMatch ? +yearMatch[1] : 0); if (r) return r; }
  m = q.match(new RegExp(`\\b(${monRe})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (m) { const r = resolve(+m[2], MON3.indexOf(m[1]) + 1, yearMatch ? +yearMatch[1] : 0); if (r) return r; }
  m = q.match(new RegExp(`\\b(next|this)?\\s*(${WD3.join("|")})[a-z]*\\b`));
  if (m && /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*day\b|\b(mon|tue|wed|thu|fri|sat|sun)\b/.test(q)) {
    const target = WD3.indexOf(m[2]);
    let d = m[1] === "next" ? addIso(today, 1) : today;
    for (let i = 0; i < 8; i++, d = addIso(d, 1)) if (wdOf(d) === target) return d;
  }
  return null;
}

// A period like "this month", "next month", "december", "december 2027", "this year", "2027".
export function parseScope(q, today) {
  const y = +today.slice(0, 4), mo = +today.slice(5, 7);
  const yearMatch = q.match(/\b(20\d\d)\b/);
  const span = (a, b, label) => ({ start: a, end: b, label });
  const monthSpan = (yy, mm) => span(iso(yy, mm, 1), iso(yy, mm, new Date(Date.UTC(yy, mm, 0)).getUTCDate()), `${MONTHS[mm-1][0].toUpperCase()}${MONTHS[mm-1].slice(1)} ${yy}`);
  if (/next month/.test(q)) return mo === 12 ? monthSpan(y + 1, 1) : monthSpan(y, mo + 1);
  if (/this month/.test(q)) return monthSpan(y, mo);
  const mm = MONTHS.findIndex((full, i) => new RegExp(`\\b(${full}|${MON3[i]}${MON3[i] === "sep" ? "|sept" : ""})\\b`).test(q)
    && !new RegExp(`\\b\\d{1,2}(st|nd|rd|th)?\\s*(of\\s+)?${MON3[i]}|\\b${MON3[i]}[a-z]*\\s+\\d{1,2}\\b`).test(q));
  if (mm >= 0) return monthSpan(yearMatch ? +yearMatch[1] : (mm + 1 < mo ? y + 1 : y), mm + 1);
  if (/next year/.test(q)) return span(iso(y + 1, 1, 1), iso(y + 1, 12, 31), String(y + 1));
  if (yearMatch) return span(iso(+yearMatch[1], 1, 1), iso(+yearMatch[1], 12, 31), yearMatch[1]);
  if (/this year/.test(q)) return span(iso(y, 1, 1), iso(y, 12, 31), String(y));
  return null;
}

// ctx: {today, team, plan:Set(dates), typeOfTeam(team,date), rosterFor(date) -> {working, text}|null}
export function answerQuestion(raw, ctx) {
  const q = String(raw || "").toLowerCase().replace(/[?!.]/g, " ").replace(/\s+/g, " ").trim();
  if (!q) return null;
  const { today, plan } = ctx;
  const tAt = d => ctx.typeOfTeam(ctx.team, d);
  const isLeave = d => plan.has(d);
  const withYear = d => d.slice(0, 4) !== today.slice(0, 4);
  const f = d => fmt(d, withYear(d));
  const from = (start, n, test) => { for (let d = start, i = 0; i < n; d = addIso(d, 1), i++) if (test(d)) return d; return null; };

  // --- how many ... ---
  if (/how many|count|number of|total/.test(q)) {
    const sc = parseScope(q, today) || { start: today.slice(0, 8) + "01", end: addIso(addIso(today.slice(0, 8) + "01", 32).slice(0, 8) + "01", -1), label: "this month" };
    const days = []; for (let d = sc.start; d <= sc.end; d = addIso(d, 1)) days.push(d);
    if (/public holiday|holidays/.test(q)) {
      const hs = days.filter(d => isPublicHoliday(d)), work = hs.filter(d => tAt(d) !== "X" && !isLeave(d));
      return { headline: `${work.length} public holiday${work.length === 1 ? "" : "s"} you're working`, lines: [`${hs.length} holidays in ${sc.label}`, ...work.map(d => `${holidayName(d)} · ${f(d)} · ${WORD[tAt(d)]}`)] };
    }
    const kind = /earl/.test(q) ? "E" : /\blate/.test(q) ? "L" : /off|rdo|rest/.test(q) ? "X" : /leave|\bal\b/.test(q) ? "AL" : "W";
    if (kind === "AL") { const n = days.filter(isLeave).length; return { headline: `${n} leave day${n === 1 ? "" : "s"} planned`, lines: [sc.label] }; }
    const n = days.filter(d => kind === "W" ? tAt(d) !== "X" : tAt(d) === kind).length;
    const name = kind === "E" ? "earlies" : kind === "L" ? "lates" : kind === "X" ? "days off" : "working days";
    return { headline: `${n} ${name}`, lines: [`in ${sc.label}`, ...(plan.size && kind !== "X" ? ["Your planned leave days aren't taken out of this count."] : [])] };
  }

  // --- which teams are working / off ---
  if (/\bteams?\b|who.*(working|off|on shift)/.test(q)) {
    const d = parseDate(q, today) || today;
    return { headline: `Teams on ${d === today ? "today" : f(d)}`, lines: Object.keys(TEAMS).map(k => `${TEAMS[k].label}: ${WORD[ctx.typeOfTeam(k, d)]}${k === ctx.team ? "  (you)" : ""}`) };
  }

  // --- longest break (days off + planned leave) ---
  if (/longest|biggest|best break/.test(q)) {
    const sc = parseScope(q, today) || { start: today, end: addIso(today, 364), label: "the next 12 months" };
    let best = null, run = null;
    for (let d = sc.start; d <= sc.end; d = addIso(d, 1)) {
      const off = tAt(d) === "X" || isLeave(d);
      if (off) { run = run ? { ...run, end: d, n: run.n + 1 } : { start: d, end: d, n: 1 }; if (!best || run.n > best.n) best = { ...run }; }
      else run = null;
    }
    if (!best) return null;
    return { headline: `${best.n} days off in a row`, lines: [`${f(best.start)} – ${f(best.end)}`, plan.size ? "This counts your planned leave days." : "Plan leave days in the Year Planner to make it longer."] };
  }

  // --- weekends ---
  if (/weekend/.test(q)) {
    const full = from(today, 400, d => wdOf(d) === 6 && tAt(d) === "X" && tAt(addIso(d, 1)) === "X");
    const anyD = from(today, 400, d => (wdOf(d) === 6 || wdOf(d) === 0) && tAt(d) === "X");
    return { headline: full ? `Next full weekend off: ${f(full)} – ${f(addIso(full, 1))}` : "No full weekend off in the next year",
      lines: anyD ? [`Next weekend day off: ${f(anyD)}`] : [] };
  }

  // --- leave plan ---
  if (/\bleave\b|\bal\b|annual/.test(q) && !parseDate(q, today)) {
    const up = [...plan].sort().filter(d => d >= today);
    return { headline: up.length ? `${up.length} leave day${up.length === 1 ? "" : "s"} coming up` : "No leave planned yet", lines: up.slice(0, 12).map(d => `${f(d)} · ${WORD[tAt(d)]} day`) };
  }

  // --- public holidays ---
  if (/public holiday|holidays?\b/.test(q) && !parseDate(q, today)) {
    const sc = parseScope(q, today);
    const wantsWork = /work|rostered|\bon\b/.test(q);
    if (/\bnext\b/.test(q) && !sc) {
      const h = listHolidays().find(x => x.date >= today && (!wantsWork || (tAt(x.date) !== "X" && !isLeave(x.date))));
      if (!h) return null;
      return { headline: `${h.name} · ${f(h.date)}`, lines: [`${diffDays(today, h.date)} day${diffDays(today, h.date) === 1 ? "" : "s"} away`,
        tAt(h.date) === "X" ? "You're off that day." : `You're working ${NAME[tAt(h.date)]} that day: time and a half plus an alternative holiday.`] };
    }
    if (wantsWork || sc) {
      const lo = sc ? sc.start : today, hi = sc ? sc.end : addIso(today, 365);
      const list = listHolidays().filter(h => h.date >= lo && h.date <= hi);
      const work = list.filter(h => tAt(h.date) !== "X" && !isLeave(h.date));
      return { headline: `${work.length} public holiday${work.length === 1 ? "" : "s"} you're working`, lines: work.slice(0, 12).map(h => `${h.name} · ${f(h.date)} · ${WORD[tAt(h.date)]}`).concat(["Each pays time and a half and earns an alternative holiday."]) };
    }
    const h = listHolidays().find(x => x.date >= today);
    return h ? { headline: `${h.name} · ${f(h.date)}`, lines: [`${diffDays(today, h.date)} days away`, tAt(h.date) === "X" ? "You're off that day." : `You're working ${NAME[tAt(h.date)]} that day.`] } : null;
  }

  // --- next early / next late / next day off ---
  if (/\bnext\b|when/.test(q) && !parseDate(q, today)) {
    const k = /earl/.test(q) ? "E" : /\blate/.test(q) ? "L" : /off|rdo|rest/.test(q) ? "X" : "";
    if (k) {
      const d = from(addIso(today, 1), 60, x => tAt(x) === k);
      return d ? { headline: k === "X" ? `Next day off: ${f(d)}` : `Next ${WORD[k]}: ${f(d)}`, lines: [`${diffDays(today, d)} day${diffDays(today, d) === 1 ? "" : "s"} away`] } : null;
    }
  }

  // --- a specific day: working? off? free? ---
  const date = parseDate(q, today);
  if (date) {
    const t = tAt(date), r = ctx.rosterFor ? ctx.rosterFor(date) : null;
    const lines = [];
    if (isLeave(date)) lines.push("You've marked this as a leave day.");
    if (isPublicHoliday(date)) lines.push(`Public holiday: ${holidayName(date)}.` + (t !== "X" ? " Working it pays time and a half and earns an alternative holiday." : ""));
    if (r && r.working) lines.push(`Imported roster: ${r.text}`);
    const working = r ? r.working : t !== "X";
    const head = isLeave(date) ? `${f(date)}: you're on leave`
      : working ? `${f(date)}: you're working${r?.text ? " " + r.text : " " + NAME[t]}`
      : `${f(date)}: you're off`;
    if (/\b(go|free|attend|can i|available|come|make it)\b/.test(q)) {
      if (working && !isLeave(date)) lines.push("To go you would need leave or a swap.");
      if (!working && !isLeave(date)) lines.push("You're free.");
    }
    return { headline: head, lines };
  }
  if (/this week|week/.test(q)) {
    const mon = addIso(today, -mod(wdOf(today) - 1, 7));
    return { headline: "This week", lines: Array.from({length: 7}, (_, i) => addIso(mon, i)).map(d => `${f(d)} · ${isLeave(d) ? "Leave" : WORD[tAt(d)]}${isPublicHoliday(d) ? " · PH" : ""}`) };
  }
  return null;
}

export const SUGGESTIONS = [
  "Next weekend off", "Next day off", "What am I on tomorrow", "Am I working Christmas",
  "Next public holiday I'm working", "How many lates this month", "Longest break this year", "Which teams are off today",
];

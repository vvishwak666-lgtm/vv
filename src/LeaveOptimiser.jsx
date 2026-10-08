import React, {useMemo, useState} from "react";
import {holidayName, localISO, addIso} from "./nzHolidays.js";
import {detectPattern, makeOffFn, findBreaks, TEAMS, teamForAnchor, TEAM_PLANNER_END} from "./leaveLogic.js";

const GOLD = "#D4AF6A";
const LS_KEY = "vv-leave-pattern";
const load = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } };
const save = v => { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} };

const fmtDay = (iso, o = {weekday:"short", day:"numeric", month:"short"}) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-NZ", o);
const monthLabel = ym => new Date(`${ym}-01T12:00:00`).toLocaleDateString("en-NZ", {month:"long", year:"numeric"});
const addMonth = (ym, n) => { const d = new Date(`${ym}-01T12:00:00`); d.setMonth(d.getMonth() + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; };
const lastOfMonth = ym => { const d = new Date(`${ym}-01T12:00:00`); d.setMonth(d.getMonth() + 1); d.setDate(0); return localISO(d); };

const CHIP = {
  leave:   {bg: GOLD,          fg: "#111", border: GOLD,      label: "LEAVE"},
  off:     {bg: "transparent", fg: "#b9ad90", border: "#3a3426", label: "OFF"},
  ph:      {bg: "transparent", fg: GOLD,  border: GOLD,      label: "PH"},
  phSaved: {bg: "transparent", fg: GOLD,  border: GOLD,      label: "PH", dashed: true},
};

function DayChip({date, kind}) {
  const c = CHIP[kind];
  return <div title={holidayName(date) || undefined} style={{
    width: 44, padding: "5px 0 4px", textAlign: "center", borderRadius: 10, background: c.bg, color: c.fg,
    border: `1.5px ${c.dashed ? "dashed" : "solid"} ${c.border}`, lineHeight: 1.15}}>
    <div style={{fontSize: 9, fontWeight: 700, opacity: .8}}>{fmtDay(date, {weekday: "short"}).toUpperCase()}</div>
    <div style={{fontSize: 16, fontWeight: 800}}>{new Date(`${date}T12:00:00`).getDate()}</div>
    <div style={{fontSize: 8, fontWeight: 800, letterSpacing: ".04em"}}>{c.label}</div>
  </div>;
}

function shareText(b) {
  const lv = b.leaveDays.length;
  return `Take ${lv} day${lv > 1 ? "s" : ""} of leave (${fmtDay(b.leaveDays[0])}${lv > 1 ? " – " + fmtDay(b.leaveDays[lv-1]) : ""}) and get ${b.total} days off in a row 🌴 Planned with VV Duty Roster – https://vv-sigma-one.vercel.app`;
}
function addToPlan(days) {
  try {
    const cur = new Set(JSON.parse(localStorage.getItem("vv-leave-plan") || "[]"));
    days.forEach(d => cur.add(d));
    localStorage.setItem("vv-leave-plan", JSON.stringify([...cur].sort()));
  } catch {}
}
async function shareBreak(b) {
  const text = shareText(b);
  try {
    if (navigator.share) { await navigator.share({text}); return "Shared"; }
    await navigator.clipboard.writeText(text); return "Copied";
  } catch { return ""; }
}

export default function LeaveOptimiser({entries, isWorking, onBack}) {
  const today = localISO();
  const known = useMemo(() => {
    const m = new Map();
    for (const e of entries || []) if (e.date) m.set(e.date, !!isWorking(e));
    return m;
  }, [entries, isWorking]);
  const lastKnown = useMemo(() => [...known.keys()].sort().pop() || "", [known]);
  const det = useMemo(() => detectPattern(known), [known]);

  const [ov, setOv] = useState(load);
  const [budget, setBudget] = useState(3);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState(false);

  const team = TEAMS[ov.team] ? ov.team : "";
  const t = team ? TEAMS[team] : null;
  const on = ov.on ?? t?.on ?? det.on ?? 6;
  const off = ov.off ?? t?.off ?? det.off ?? 3;
  const anchor = ov.anchor ?? t?.anchor ?? det.anchor ?? "";
  const seenTeam = teamForAnchor(det.anchor);
  const patch = p => { const n = {...ov, ...p}; setOv(n); save(n); };

  const offAt = useMemo(() => makeOffFn(known, {on, off, anchor}), [known, on, off, anchor]);
  const breaks = useMemo(() => {
    if (!anchor && !known.size) return [];
    return findBreaks({today, monthStart: `${month}-01`, monthEnd: lastOfMonth(month), budget, offAt});
  }, [today, month, budget, offAt, anchor, known]);

  const minMonth = today.slice(0, 7), maxMonth = addMonth(minMonth, 12);
  const btn = {background: "transparent", border: "1px solid #3a3426", color: GOLD, borderRadius: 10, padding: "6px 12px", fontWeight: 700};

  return <div>
    <button className="ghost" style={{...btn, marginBottom: 10}} onClick={onBack}>← Back</button>
    <section className="panel" style={{padding: 14}}>
      <div className="sectionTitle"><b>LEAVE OPTIMISER</b></div>
      <p className="rateNote" style={{marginTop: 4}}>Find the best days to book off so a few leave days turn into the longest break.</p>

      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0"}}>
        <button style={btn} disabled={month <= minMonth} onClick={() => setMonth(addMonth(month, -1))}>‹</button>
        <b>{monthLabel(month)}</b>
        <button style={btn} disabled={month >= maxMonth} onClick={() => setMonth(addMonth(month, 1))}>›</button>
      </div>

      <div className="rateRow">
        <span>Leave days I can use</span>
        <div className="rateValue">
          <input type="number" min="1" max="15" value={budget} aria-label="Leave days"
            onChange={ev => setBudget(Math.max(1, Math.min(15, +ev.target.value || 1)))}/>
          <small>days</small>
        </div>
      </div>

      <div className="rateRow" style={{marginTop: 6}}>
        <span>My team</span>
        <div className="rateValue">
          <select value={team} aria-label="My team"
            onChange={ev => patch({team: ev.target.value, on: undefined, off: undefined, anchor: undefined})}>
            <option value="">Auto (from my roster)</option>
            {Object.entries(TEAMS).map(([k, v]) => <option key={k} value={k}>{v.label} team</option>)}
          </select>
        </div>
      </div>
      {!team && seenTeam && <p className="rateNote" style={{marginTop: 4}}>Your roster looks like the <b>{TEAMS[seenTeam].label}</b> team. Choose it above to use the full-year planner.</p>}
      {team && <p className="rateNote" style={{marginTop: 4}}>Using the {TEAMS[team].label} team year planners (2026 and 2027): 3 earlies, 3 lates, 3 off. Days from your imported roster still take priority.</p>}

      <p className="rateNote" style={{marginTop: 10}}>
        Your pattern: <b>{on} on / {off} off</b>{anchor ? <> · a days-off block starts {fmtDay(anchor)}</> : null}.{" "}
        <a onClick={() => setEditing(v => !v)} style={{color: GOLD, textDecoration: "underline", cursor: "pointer"}}>{editing ? "Done" : "Change"}</a>
      </p>
      {editing && <div style={{marginTop: 8}}>
        <div className="rateRow"><span>Days on</span><div className="rateValue">
          <input type="number" min="1" max="14" value={on} onChange={ev => patch({on: Math.max(1, Math.min(14, +ev.target.value || 1))})}/></div></div>
        <div className="rateRow"><span>Days off</span><div className="rateValue">
          <input type="number" min="1" max="7" value={off} onChange={ev => patch({off: Math.max(1, Math.min(7, +ev.target.value || 1))})}/></div></div>
        <div className="rateRow"><span>First day of a days-off block</span><div className="rateValue">
          <input type="date" value={anchor} onChange={ev => patch({anchor: ev.target.value})}/></div></div>
      </div>}

      {!anchor && <p className="rateNote" style={{color: "#ff9f43", marginTop: 8}}>
        Import your roster first, or tap Change and pick the first day of one of your days-off blocks, so I can work out your pattern.</p>}
    </section>

    {anchor && breaks.length === 0 && <section className="panel" style={{padding: 14, marginTop: 10}}>
      <b>No better break found in {monthLabel(month)}</b>
      <p className="rateNote" style={{marginTop: 6}}>Try more leave days, or look at another month.</p>
    </section>}

    {breaks.map((b, i) => {
      const lv = b.leaveDays.length;
      const beyond = lastKnown && b.end > lastKnown && !(team && b.end <= TEAM_PLANNER_END);
      return <section key={b.start} className="panel" style={{padding: 14, marginTop: 10, border: i === 0 ? `1px solid ${GOLD}` : undefined}}>
        {i === 0 && <small style={{color: GOLD, fontWeight: 800, letterSpacing: ".06em"}}>BEST OPTION</small>}
        <div style={{fontSize: 24, fontWeight: 800, marginTop: 2}}>{b.total} days off in a row</div>
        <div style={{opacity: .85, marginTop: 2}}>{fmtDay(b.start)} – {fmtDay(b.end)}</div>
        <div style={{display: "flex", flexWrap: "wrap", gap: 5, margin: "12px 0"}}>
          {b.days.map(d => <DayChip key={d.date} date={d.date} kind={d.kind}/>)}
        </div>
        <div><b>Book {lv} leave day{lv > 1 ? "s" : ""}:</b> {b.leaveDays.map(d => fmtDay(d)).join(", ")}</div>
        {b.savedHolidays.length > 0 && <p className="rateNote" style={{marginTop: 6}}>
          {b.savedHolidays.map(d => `${holidayName(d)} (${fmtDay(d)})`).join(" and ")} falls on a day you'd work, so it's paid as a public holiday and shouldn't use one of your leave days.</p>}
        {beyond && <p className="rateNote" style={{marginTop: 6}}>Part of this is {team ? `after the published team planners (to ${TEAM_PLANNER_END.slice(0, 4)})` : `after your last imported roster (${fmtDay(lastKnown)})`}, so it assumes your {on} on / {off} off pattern continues. Check it against the published roster before you book.</p>}
        <div style={{display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10}}>
          <button style={btn} onClick={async () => { const r = await shareBreak(b); setToast(r); setTimeout(() => setToast(""), 1800); }}>
            Share this plan
          </button>
          <button style={btn} onClick={() => { addToPlan(b.leaveDays); setToast("Added to Year Planner"); setTimeout(() => setToast(""), 1800); }}>
            Add to Year Planner
          </button>
        </div>
      </section>;
    })}
    {toast && <div className="toast">{toast}</div>}
    <p className="rateNote" style={{margin: "12px 4px"}}>Check with your manager and your leave balance before booking. A public holiday inside your leave is normally paid as the holiday and not taken from your leave balance.</p>
  </div>;
}

import React, {useEffect, useMemo, useRef, useState} from "react";
import {holidayName, isPublicHoliday, localISO, addIso, diffDays} from "./nzHolidays.js";
import {detectPattern, TEAMS, teamForAnchor, TEAM_PLANNER_END} from "./leaveLogic.js";

const GOLD = "#D4AF6A";
const PATTERN_KEY = "vv-leave-pattern";   // shared with the Leave Optimiser (team choice)
const PLAN_KEY = "vv-leave-plan";         // leave days the user has planned
const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const mod = (n, m) => ((n % m) + m) % m;

const STYLE = {
  E: {bg: "#f1ece0", fg: "#111",    name: "Early"},
  L: {bg: "#3a3426", fg: "#f1ece0", name: "Late"},
  X: {bg: "#3f6b3a", fg: "#fff",    name: "Off"},
};
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

export default function YearPlanner({entries, isWorking, onBack}) {
  const today = localISO();
  const known = useMemo(() => {
    const m = new Map();
    for (const e of entries || []) if (e.date) m.set(e.date, !!isWorking(e));
    return m;
  }, [entries, isWorking]);
  const seen = useMemo(() => teamForAnchor(detectPattern(known).anchor), [known]);

  const [team, setTeam] = useState(() => { const t = readJson(PATTERN_KEY, {}).team; return TEAMS[t] ? t : ""; });
  const [year, setYear] = useState(+today.slice(0, 4));
  const [plan, setPlan] = useState(() => new Set(readJson(PLAN_KEY, [])));
  const activeTeam = team || seen;
  const anchor = activeTeam ? TEAMS[activeTeam].anchor : "";

  const pickTeam = v => { setTeam(v); writeJson(PATTERN_KEY, {...readJson(PATTERN_KEY, {}), team: v, on: undefined, off: undefined, anchor: undefined}); };
  const toggleLeave = d => setPlan(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); writeJson(PLAN_KEY, [...n].sort()); return n; });

  const typeAt = d => { if (!anchor) return ""; const m = mod(diffDays(anchor, d), 9); return m < 3 ? "X" : m < 6 ? "E" : "L"; };

  // year totals + public holidays you would be rostered on
  const stats = useMemo(() => {
    const s = {E: 0, L: 0, X: 0, phWork: [], leave: 0};
    if (!anchor) return s;
    for (let d = `${year}-01-01`; d <= `${year}-12-31`; d = addIso(d, 1)) {
      const t = typeAt(d); s[t]++;
      if (isPublicHoliday(d) && t !== "X") s.phWork.push({date: d, t});
      if (plan.has(d)) s.leave++;
    }
    return s;
  }, [anchor, year, plan]);

  const curMonthRef = useRef(null);
  useEffect(() => { try { curMonthRef.current?.scrollIntoView({block: "start"}); } catch {} }, [year, activeTeam]);

  const btn = {background: "transparent", border: "1px solid #3a3426", color: GOLD, borderRadius: 10, padding: "6px 12px", fontWeight: 700};
  const fmt = (iso, o = {weekday: "short", day: "numeric", month: "short"}) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-NZ", o);
  const beyond = year > +TEAM_PLANNER_END.slice(0, 4);

  return <div>
    <button className="ghost" style={{...btn, marginBottom: 10}} onClick={onBack}>← Back</button>
    <section className="panel" style={{padding: 14}}>
      <div className="sectionTitle"><b>YEAR PLANNER</b></div>
      <div style={{display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 6px"}}>
        <button style={btn} onClick={() => setYear(y => y - 1)} disabled={year <= 2026}>‹</button>
        <b style={{fontSize: 18}}>{year}</b>
        <button style={btn} onClick={() => setYear(y => y + 1)} disabled={year >= 2028}>›</button>
      </div>
      <div className="rateRow">
        <span>My team</span>
        <div className="rateValue">
          <select value={team} aria-label="My team" onChange={ev => pickTeam(ev.target.value)}>
            <option value="">{seen ? `Auto (${TEAMS[seen].label})` : "Choose a team"}</option>
            {Object.entries(TEAMS).map(([k, v]) => <option key={k} value={k}>{v.label} team</option>)}
          </select>
        </div>
      </div>
      <div style={{display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10, fontSize: 11, fontWeight: 700}}>
        {Object.entries(STYLE).map(([k, v]) => <span key={k} style={{display: "flex", alignItems: "center", gap: 5}}>
          <i style={{width: 16, height: 16, borderRadius: 5, background: v.bg, color: v.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontStyle: "normal", fontSize: 10}}>{k}</i>{v.name}</span>)}
        <span style={{display: "flex", alignItems: "center", gap: 5}}><i style={{width: 16, height: 16, borderRadius: 5, boxShadow: `inset 0 0 0 2px ${GOLD}`, display: "inline-block"}}/>Public holiday</span>
        <span style={{display: "flex", alignItems: "center", gap: 5}}><i style={{width: 16, height: 16, borderRadius: 5, background: GOLD, color: "#111", display: "inline-flex", alignItems: "center", justifyContent: "center", fontStyle: "normal", fontSize: 8}}>AL</i>My leave</span>
      </div>
      <p className="rateNote" style={{marginTop: 8}}>Tap a day you work to add or remove a leave day.</p>
      {!anchor && <p className="rateNote" style={{color: "#ff9f43"}}>Choose your team above to see your year.</p>}
      {beyond && anchor && <p className="rateNote" style={{color: "#ff9f43"}}>The published team planners cover 2026 and 2027. Later years assume the same 9-day cycle continues.</p>}
    </section>

    {anchor && <section className="panel" style={{padding: 14, marginTop: 10}}>
      <div className="stats" style={{display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, textAlign: "center"}}>
        {[["E", stats.E], ["L", stats.L], ["X", stats.X], ["LEAVE", stats.leave]].map(([k, n]) =>
          <div key={k}><div style={{fontSize: 22, fontWeight: 800, color: k === "LEAVE" ? GOLD : undefined}}>{n}</div>
            <small style={{opacity: .7, fontWeight: 700}}>{k === "E" ? "EARLIES" : k === "L" ? "LATES" : k === "X" ? "DAYS OFF" : "LEAVE DAYS"}</small></div>)}
      </div>
      <div style={{marginTop: 12}}>
        <b>Public holidays you're rostered on: {stats.phWork.length}</b>
        <p className="rateNote" style={{margin: "2px 0 6px"}}>Each one pays time and a half and earns an alternative holiday.</p>
        {stats.phWork.length === 0 && <p className="rateNote">None this year.</p>}
        {stats.phWork.map(p => <div key={p.date} className="rateRow" style={{padding: "4px 0"}}>
          <span>{holidayName(p.date)}</span>
          <span style={{opacity: .85}}>{fmt(p.date)} · {STYLE[p.t].name}</span>
        </div>)}
      </div>
    </section>}

    {anchor && MONTHS.map((name, mi) => {
      const first = new Date(year, mi, 1), days = new Date(year, mi + 1, 0).getDate();
      const lead = (first.getDay() + 6) % 7;
      const isCurrent = today.slice(0, 7) === `${year}-${String(mi + 1).padStart(2, "0")}`;
      const cells = [...Array(lead).fill(null), ...Array.from({length: days}, (_, i) => i + 1)];
      let off = 0;
      for (let d = 1; d <= days; d++) if (typeAt(`${year}-${String(mi + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`) === "X") off++;
      return <section key={name} ref={isCurrent ? curMonthRef : null} className="panel" style={{padding: 12, marginTop: 10, scrollMarginTop: 8}}>
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8}}>
          <b style={{color: GOLD}}>{name.toUpperCase()}</b><small style={{opacity: .7}}>{off} days off</small>
        </div>
        <div style={{display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4}}>
          {DOW.map(w => <div key={w} style={{textAlign: "center", fontSize: 9, fontWeight: 800, opacity: .55}}>{w}</div>)}
          {cells.map((n, i) => {
            if (!n) return <div key={i}/>;
            const iso = `${year}-${String(mi + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
            const t = typeAt(iso), st = STYLE[t], ph = isPublicHoliday(iso), lv = plan.has(iso), isToday = iso === today;
            const canLeave = t !== "X";
            return <button key={i} title={ph ? holidayName(iso) : undefined} disabled={!canLeave && !lv}
              onClick={() => toggleLeave(iso)} aria-label={`${fmt(iso)} ${st.name}${ph ? ", " + holidayName(iso) : ""}${lv ? ", leave" : ""}`}
              style={{position: "relative", padding: "5px 0 4px", borderRadius: 9, border: 0, lineHeight: 1.1, textAlign: "center",
                background: lv ? GOLD : st.bg, color: lv ? "#111" : st.fg,
                boxShadow: [ph ? `inset 0 0 0 2px ${GOLD}` : "", isToday ? "0 0 0 2px #fff" : ""].filter(Boolean).join(",") || "none",
                opacity: !canLeave ? .95 : 1}}>
              <div style={{fontSize: 9, fontWeight: 700, opacity: .75}}>{n}</div>
              <div style={{fontSize: 14, fontWeight: 800}}>{lv ? "AL" : t}</div>
              {ph && <i style={{position: "absolute", top: 1, right: 3, fontSize: 7, fontStyle: "normal", fontWeight: 900, color: lv ? "#111" : GOLD}}>PH</i>}
            </button>;
          })}
        </div>
      </section>;
    })}
    <p className="rateNote" style={{margin: "12px 4px"}}>Based on the Air NZ team year planners. If your roster is changed or swapped, your imported roster is the one to follow.</p>
  </div>;
}

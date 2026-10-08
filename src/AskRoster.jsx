import React, {useMemo, useState} from "react";
import {localISO, diffDays} from "./nzHolidays.js";
import {detectPattern, TEAMS, teamForAnchor} from "./leaveLogic.js";
import {answerQuestion, SUGGESTIONS} from "./askRoster.js";

const GOLD = "#D4AF6A";
const PATTERN_KEY = "vv-leave-pattern";   // team choice, shared with Year Planner + Leave Optimiser
const PLAN_KEY = "vv-leave-plan";         // leave days planned in the Year Planner
const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? d; } catch { return d; } };
const writeJson = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const mod = (n, m) => ((n % m) + m) % m;

export default function AskRoster({entries, isWorking, shiftText, onBack}) {
  const today = localISO();
  const byDate = useMemo(() => { const m = new Map(); for (const e of entries || []) if (e.date) m.set(e.date, e); return m; }, [entries]);
  const seen = useMemo(() => {
    const known = new Map(); for (const [d, e] of byDate) known.set(d, !!isWorking(e));
    return teamForAnchor(detectPattern(known).anchor);
  }, [byDate, isWorking]);

  const [team, setTeam] = useState(() => { const t = readJson(PATTERN_KEY, {}).team; return TEAMS[t] ? t : ""; });
  const [q, setQ] = useState("");
  const [answers, setAnswers] = useState([]);   // newest first
  const active = team || seen;

  const pickTeam = v => { setTeam(v); writeJson(PATTERN_KEY, {...readJson(PATTERN_KEY, {}), team: v, on: undefined, off: undefined, anchor: undefined}); };

  const ask = text => {
    const question = (text ?? q).trim();
    if (!question || !active) return;
    const ctx = {
      today, team: active, plan: new Set(readJson(PLAN_KEY, [])),
      typeOfTeam: (t, d) => { const m = mod(diffDays(TEAMS[t].anchor, d), 9); return m < 3 ? "X" : m < 6 ? "E" : "L"; },
      rosterFor: d => { const e = byDate.get(d); if (!e) return null; const w = !!isWorking(e); return {working: w, text: w ? (shiftText ? shiftText(e) : "") : ""}; },
    };
    const a = answerQuestion(question, ctx);
    setAnswers(prev => [{question, a}, ...prev].slice(0, 4));
    setQ("");
  };

  const btn = {background: "transparent", border: "1px solid #3a3426", color: GOLD, borderRadius: 10, padding: "6px 12px", fontWeight: 700};
  const chip = {background: "#1b1810", border: "1px solid #3a3426", color: "#f1ece0", borderRadius: 99, padding: "7px 12px", fontSize: 13, fontWeight: 600};

  return <div>
    <button className="ghost" style={{...btn, marginBottom: 10}} onClick={onBack}>← Back</button>
    <section className="panel" style={{padding: 14}}>
      <div className="sectionTitle"><b>ASK YOUR ROSTER</b></div>
      <p className="rateNote" style={{marginTop: 4}}>Ask about your days off, shifts, holidays and leave. Tap a question below or type your own.</p>

      <div className="rateRow" style={{marginTop: 6}}>
        <span>My team</span>
        <div className="rateValue">
          <select value={team} aria-label="My team" onChange={ev => pickTeam(ev.target.value)}>
            <option value="">{seen ? `Auto (${TEAMS[seen].label})` : "Choose a team"}</option>
            {Object.entries(TEAMS).map(([k, v]) => <option key={k} value={k}>{v.label} team</option>)}
          </select>
        </div>
      </div>
      {!active && <p className="rateNote" style={{color: "#ff9f43"}}>Choose your team above so I can answer.</p>}

      <form onSubmit={ev => { ev.preventDefault(); ask(); }} style={{display: "flex", gap: 8, marginTop: 10}}>
        <input value={q} onChange={ev => setQ(ev.target.value)} placeholder="e.g. Am I working on 25 Dec?" aria-label="Ask a question"
          style={{flex: 1, minWidth: 0, background: "#0b0b0b", border: "1px solid #3a3426", color: "#f1ece0", borderRadius: 10, padding: "10px 12px", font: "inherit"}}/>
        <button type="submit" style={{...btn, background: GOLD, color: "#111", border: 0}} disabled={!active}>Ask</button>
      </form>

      <div style={{display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12}}>
        {SUGGESTIONS.map(s => <button key={s} type="button" style={chip} disabled={!active} onClick={() => ask(s)}>{s}</button>)}
      </div>
    </section>

    {answers.map((x, i) => <section key={i} className="panel" style={{padding: 14, marginTop: 10, border: i === 0 ? `1px solid ${GOLD}` : undefined}}>
      <small style={{opacity: .65}}>You asked: {x.question}</small>
      {x.a ? <>
        <div style={{fontSize: 19, fontWeight: 800, marginTop: 4, lineHeight: 1.25}}>{x.a.headline}</div>
        {x.a.lines.map((l, j) => <div key={j} className="rateNote" style={{margin: "4px 0 0", fontSize: 13.5}}>{l}</div>)}
      </> : <>
        <div style={{fontWeight: 800, marginTop: 4}}>I didn't understand that one.</div>
        <p className="rateNote" style={{margin: "4px 0 0"}}>Try something like "next weekend off", "am I working 25 Dec", "how many lates in December" or "next public holiday".</p>
      </>}
    </section>)}
    <p className="rateNote" style={{margin: "12px 4px"}}>Answers come from the Air NZ team planners, your leave plan and your imported roster. Your imported roster wins if it differs.</p>
  </div>;
}

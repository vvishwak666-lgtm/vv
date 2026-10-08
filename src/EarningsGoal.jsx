import React, {useState} from "react";
import {localISO, diffDays} from "./nzHolidays.js";

const GOLD = "#D4AF6A";
const KEY = "vv-earnings-goal";
const load = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
const save = v => { try { localStorage.setItem(KEY, v); } catch {} };
const money = n => "$" + Math.round(n).toLocaleString("en-NZ");

// gross: projected gross for the current pay period (everything rostered, including days still to come).
// taxFn(gross) returns the PAYE + ACC for one period. otMult is the overtime rate used for the estimate.
export default function EarningsGoalCard({gross, taxFn, unionPct, kiwiSaverPct, payRate, otMult, periodEnd}) {
  const [target, setTarget] = useState(load);
  const goal = Math.max(0, Number(target) || 0);
  const netOf = g => g - taxFn(g) - g * (unionPct / 100) - g * (kiwiSaverPct / 100);
  const net = netOf(gross);
  const left = periodEnd ? diffDays(localISO(), periodEnd) : null;
  const gap = goal - net;

  // Take-home from one extra overtime hour, after tax, union fee and KiwiSaver at the current level of pay.
  const perHour = payRate > 0 ? netOf(gross + payRate * (otMult || 1.5)) - net : 0;
  const hours = gap > 0 && perHour > 0 ? gap / perHour : 0;
  const pct = goal > 0 ? Math.max(0, Math.min(100, (net / goal) * 100)) : 0;

  return <section className="panel" style={{padding: "12px 14px"}}>
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
      <small style={{color: GOLD, fontWeight: 800, letterSpacing: ".06em"}}>EARNINGS GOAL</small>
      <div className="rateValue">
        <small>$</small>
        <input type="number" min="0" step="50" placeholder="Net target" value={target} aria-label="Net pay target for this period"
          onChange={ev => { setTarget(ev.target.value); save(ev.target.value); }}/>
      </div>
    </div>

    {!(goal > 0) && <p className="rateNote" style={{margin: "6px 0 0"}}>Enter the take-home pay you want this pay period and I'll show how close you are.</p>}

    {goal > 0 && <>
      <div style={{display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800}}>
        <span>{money(net)} <span style={{opacity: .65, fontWeight: 600}}>projected net</span></span>
        <span>{money(goal)}</span>
      </div>
      <div style={{height: 8, borderRadius: 99, background: "#2a251c", marginTop: 6, overflow: "hidden"}}>
        <div style={{width: pct + "%", height: "100%", background: GOLD}}/>
      </div>

      {gap <= 0
        ? <p className="rateNote" style={{margin: "8px 0 0"}}>You're on track. Your rostered shifts already reach this goal, about {money(-gap)} over.{left != null && left >= 0 ? ` ${left} day${left === 1 ? "" : "s"} left in this period.` : ""}</p>
        : payRate > 0 && perHour > 0
          ? <p className="rateNote" style={{margin: "8px 0 0"}}>
              You're about <b>{money(gap)}</b> short. That's roughly <b>{hours.toFixed(1)} more hours</b> of overtime
              {" "}(about {Math.ceil(hours / 4)} × 4-hour or {Math.ceil(hours / 8)} × 8-hour shift{Math.ceil(hours / 8) === 1 ? "" : "s"})
              {left != null && left >= 0 ? `, with ${left} day${left === 1 ? "" : "s"} left in this period` : ""}.
            </p>
          : <p className="rateNote" style={{margin: "8px 0 0"}}>Set your hourly rate in More to see how many hours you need.</p>}
      <p className="rateNote" style={{margin: "4px 0 0", opacity: .7}}>Estimate after tax, union fee and KiwiSaver, using your overtime rate. Your payslip may differ slightly.</p>
    </>}
  </section>;
}

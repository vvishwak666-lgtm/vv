import React, {useEffect, useRef, useState} from "react";
import {LANGUAGES, ROSTER_TYPES, t, formatGap, compactShiftsParam} from "./vvGeneral.js";

const fmtDay = iso => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {weekday: "short", day: "numeric", month: "short"});
const CONSENT_KEY = "vv-scan-consent-v1";

// ---------------------------------------------------------------------------
// First-run setup: language first, then company / roster type, exact roster name,
// minimum rest. Shown once to new users; existing users are never shown it.
// ---------------------------------------------------------------------------
export function SetupModal({initial, onSave, onCancel}){
  const [lang, setLang] = useState(initial.language || "en");
  const [rosterType, setRosterType] = useState(initial.rosterType || "airnz");
  const [name, setName] = useState(initial.name || "");
  const [minRest, setMinRest] = useState(String(initial.minRestHours ?? 10));
  const [payCycle, setPayCycle] = useState(initial.payCycle || "fortnightly");
  const [codes, setCodes] = useState(Object.entries(initial.shiftTypes || {}).map(([code, v]) => ({code, start: v.slice(0, 4), end: v.slice(5)})));
  const [err, setErr] = useState("");
  const general = rosterType !== "airnz";

  const submit = () => {
    const n = name.trim();
    if(n.length < 2){ setErr(t(lang, "exactName")); return; }
    const rest = Math.max(0, Math.min(24, Number(minRest) || 0));
    const shiftTypes = {};
    for(const c of codes){
      const code = String(c.code || "").trim().toUpperCase().slice(0, 10);
      if(code && /^\d{4}$/.test(c.start) && /^\d{4}$/.test(c.end)) shiftTypes[code] = `${c.start}-${c.end}`;
    }
    onSave({language: lang, rosterType, name: n, minRestHours: rest, shiftTypes, payCycle});
  };

  return <div className="modalWrap"><div className="modal" style={{maxHeight: "92vh", overflowY: "auto"}}>
    <div className="modalHead"><div><h2>{t(lang, "welcome")}</h2></div>{onCancel && <button className="ghost" onClick={onCancel}>×</button>}</div>

    <label className="rateNote" htmlFor="vv-lang">{t(lang, "language")}</label>
    <select id="vv-lang" value={lang} onChange={e => setLang(e.target.value)} style={{width: "100%", marginBottom: 10}}>
      {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
    </select>

    <label className="rateNote" htmlFor="vv-company">{t(lang, "company")}</label>
    <select id="vv-company" value={rosterType} onChange={e => setRosterType(e.target.value)} style={{width: "100%", marginBottom: 10}}>
      {ROSTER_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select>

    <label className="rateNote" htmlFor="vv-name">{t(lang, "exactName")}</label>
    <input id="vv-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. SMITH, John" autoComplete="name" style={{width: "100%"}}/>
    <p className="rateNote" style={{marginTop: 4}}>{t(lang, "exactNameHint")}</p>

    <label className="rateNote" htmlFor="vv-rest">{t(lang, "minRest")}</label>
    <input id="vv-rest" type="number" min="0" max="24" step="0.5" value={minRest} onChange={e => setMinRest(e.target.value)} style={{width: 100, marginBottom: 10}}/>

    <label className="rateNote" htmlFor="vv-cycle">{t(lang, "payCycle")}</label>
    <select id="vv-cycle" value={payCycle} onChange={e => setPayCycle(e.target.value)} style={{width: "100%", marginBottom: 10}}>
      <option value="weekly">{t(lang, "weekly")}</option>
      <option value="fortnightly">{t(lang, "fortnightly")}</option>
      {payCycle === "monthly" && <option value="monthly">{t(lang, "monthly")}</option>}
    </select>

    {general && <div style={{marginBottom: 10}}>
      <div className="rateNote">{t(lang, "shiftCodesHint")}</div>
      {codes.map((c, i) => <div key={i} style={{display: "flex", gap: 6, margin: "6px 0"}}>
        <input value={c.code} placeholder="Code" maxLength={10} onChange={e => setCodes(codes.map((x, j) => j === i ? {...x, code: e.target.value} : x))} style={{width: 70}}/>
        <input value={c.start} placeholder="0700" inputMode="numeric" maxLength={4} onChange={e => setCodes(codes.map((x, j) => j === i ? {...x, start: e.target.value.replace(/\D/g, "")} : x))} style={{width: 70}}/>
        <input value={c.end} placeholder="1500" inputMode="numeric" maxLength={4} onChange={e => setCodes(codes.map((x, j) => j === i ? {...x, end: e.target.value.replace(/\D/g, "")} : x))} style={{width: 70}}/>
        <button className="ghost" onClick={() => setCodes(codes.filter((_, j) => j !== i))} aria-label="Remove code">×</button>
      </div>)}
      {codes.length < 12 && <button className="ghost" onClick={() => setCodes([...codes, {code: "", start: "", end: ""}])}>{t(lang, "addCode")}</button>}
    </div>}

    {err && <p className="rateNote" style={{color: "#e88"}}>{err}</p>}
    <button className="primary authFull" onClick={submit}>{t(lang, "save")}</button>
  </div></div>;
}

// ---------------------------------------------------------------------------
// Image -> JPEG base64, longest side <= 1800px, comfortably under the API size limit.
// ---------------------------------------------------------------------------
async function prepareImage(file){
  const url = URL.createObjectURL(file);
  try{
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    let q = 0.85, data = c.toDataURL("image/jpeg", q);
    while(data.length > 6_000_000 && q > 0.4){ q -= 0.15; data = c.toDataURL("image/jpeg", q); }
    return data.split(",")[1];
  }finally{ URL.revokeObjectURL(url); }
}

// ---------------------------------------------------------------------------
// AI roster scan dialog (privacy notice + consent -> scan -> confirm -> save).
// onShifts receives ONLY the user's own shifts.
// ---------------------------------------------------------------------------
export function AiScanModal({supabase, lang, myName, today, onClose, onShifts, initialResult}){
  const [agreed, setAgreed] = useState(() => { try{ return localStorage.getItem(CONSENT_KEY) === "1"; }catch{ return false; } });
  const [stage, setStage] = useState(initialResult ? "preview" : "intro"); // intro | working | pick | preview | error
  const [remaining, setRemaining] = useState(null);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(initialResult || null);
  const [checked, setChecked] = useState(initialResult ? Object.fromEntries(initialResult.shifts.map((s, i) => [i, true])) : {});
  const fileRef = useRef(null);
  const lastFile = useRef(null);

  const authHeader = async () => {
    const {data} = await supabase.auth.getSession();
    return data?.session?.access_token ? {Authorization: `Bearer ${data.session.access_token}`} : null;
  };

  useEffect(() => {
    if(initialResult) return; // spreadsheet result: no AI scan, nothing to count
    (async () => {
      try{
        const h = await authHeader(); if(!h) return;
        const r = await fetch("/api/scan-roster", {method: "POST", headers: {...h, "Content-Type": "application/json"}, body: JSON.stringify({action: "status"})});
        if(r.ok){ const j = await r.json(); setRemaining(j.remaining); }
      }catch{}
    })();
  }, []);

  const scan = async (file, pickName) => {
    setStage("working"); setMsg("");
    try{
      const h = await authHeader();
      if(!h){ setMsg(t(lang, "signInAgain")); setStage("error"); return; }
      const image = await prepareImage(file);
      const r = await fetch("/api/scan-roster", {
        method: "POST", headers: {...h, "Content-Type": "application/json"},
        body: JSON.stringify({image, mediaType: "image/jpeg", name: myName, pickName: pickName || undefined, today})
      });
      const j = await r.json().catch(() => ({}));
      if(r.status === 429){ setRemaining(0); setMsg(t(lang, "scanLimit")); setStage("error"); return; }
      if(r.status === 503){ setMsg(t(lang, "scanPaused")); setStage("error"); return; }
      if(!r.ok){ setMsg(t(lang, "scanFailed")); setStage("error"); return; }
      if(typeof j.remaining === "number") setRemaining(j.remaining);
      if(j.ambiguous && j.candidates?.length){ setResult(j); setStage("pick"); return; }
      if(!j.found || !j.shifts?.length){ setMsg(t(lang, "notFound")); setStage("error"); return; }
      setResult(j); setChecked(Object.fromEntries(j.shifts.map((s, i) => [i, true]))); setStage("preview");
    }catch{
      setMsg(t(lang, "scanFailedNet")); setStage("error");
    }
  };

  const onFile = e => {
    const f = e.target.files?.[0]; e.target.value = "";
    if(!f) return;
    lastFile.current = f;
    scan(f);
  };

  const agree = v => { setAgreed(v); try{ v ? localStorage.setItem(CONSENT_KEY, "1") : localStorage.removeItem(CONSENT_KEY); }catch{} };

  return <div className="modalWrap"><div className="modal" style={{maxHeight: "92vh", overflowY: "auto"}}>
    <div className="modalHead"><div><h2>{t(lang, "scanTitle")}</h2>
      {remaining !== null && <p>{remaining} {t(lang, "scansLeft")}</p>}</div><button className="ghost" onClick={onClose}>×</button></div>

    {(stage === "intro" || stage === "error") && <>
      <p className="rateNote">{t(lang, "scanNotice")}</p>
      <label style={{display: "flex", gap: 8, alignItems: "flex-start", margin: "10px 0"}}>
        <input type="checkbox" checked={agreed} onChange={e => agree(e.target.checked)} style={{marginTop: 3}}/>
        <span>{t(lang, "scanAgree")}</span>
      </label>
      {msg && <p className="rateNote" style={{color: "#e88"}}>{msg}</p>}
      <input ref={fileRef} hidden type="file" accept="image/*" onChange={onFile}/>
      <button className="primary authFull" disabled={!agreed || remaining === 0} onClick={() => fileRef.current?.click()}>{t(lang, "scanButton")}</button>
    </>}

    {stage === "working" && <p className="rateNote">…</p>}

    {stage === "pick" && result && <>
      <p className="rateNote">{myName}?</p>
      {result.candidates.map(n => <button key={n} className="ghost authFull" style={{marginBottom: 6}} onClick={() => lastFile.current && scan(lastFile.current, n)}>{n}</button>)}
    </>}

    {stage === "preview" && result && <>
      <p className="rateNote">{t(lang, "confirm")}</p>
      <div style={{maxHeight: "45vh", overflowY: "auto", margin: "8px 0"}}>
        {result.shifts.map((s, i) => <label key={i} style={{display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid #2a251c"}}>
          <input type="checkbox" checked={!!checked[i]} onChange={e => setChecked({...checked, [i]: e.target.checked})}/>
          <span style={{flex: 1}}>{fmtDay(s.date)}</span>
          <b>{s.start ? `${s.start.slice(0, 2)}:${s.start.slice(2)}–${s.end.slice(0, 2)}:${s.end.slice(2)}` : s.code}</b>
        </label>)}
      </div>
      {result.notes && <p className="rateNote">{result.notes}</p>}
      <button className="primary authFull" onClick={() => onShifts(result.shifts.filter((_, i) => checked[i]), result.matchedName)}>{t(lang, "saveShifts")}</button>
    </>}
  </div></div>;
}

// ---------------------------------------------------------------------------
// Short-turnaround warnings. Warns only; never blocks an edit.
// ---------------------------------------------------------------------------
export function RestBanner({warnings, lang}){
  if(!warnings?.length) return null;
  return <section className="panel" style={{padding: 13, borderColor: "#c9a24a"}} role="alert">
    {warnings.slice(0, 8).map((w, i) => <div key={i} style={{padding: "3px 0"}}>
      <b>{w.kind === "overlap" ? t(lang, "restOverlap") : t(lang, "restShort")}</b>
      {" "}{fmtDay(w.fromDate)} → {fmtDay(w.toDate)}
      {w.kind === "short" && <> — {formatGap(w.gapHours)} {t(lang, "restOnly")} ({t(lang, "restMin")} {w.minRestHours}h)</>}
    </div>)}
    {warnings.length > 8 && <small>+{warnings.length - 8}</small>}
  </section>;
}

// ---------------------------------------------------------------------------
// Calendar export (.ics works with Google, Apple and Outlook calendars)
// ---------------------------------------------------------------------------
// "Add to calendar": opens a link the phone's calendar app understands.
//   iPhone / iPad  -> webcal://…  (iOS asks "Subscribe to calendar?", works from the installed app too)
//   Android, other -> https://…   (the phone offers to open the file in its calendar)
// ---------------------------------------------------------------------------
const isApplePhone = () => {
  try{
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }catch{ return false; }
};

export function calendarLinkFor(entries, {timeZone, title, now = new Date(), origin, host}){
  const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10); // last week onwards
  const recent = (entries || []).filter(e => e && e.date >= from).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const build = list => {
    const s = compactShiftsParam(list);
    return s ? `/api/calendar?s=${encodeURIComponent(s)}&tz=${encodeURIComponent(timeZone || "Pacific/Auckland")}&t=${encodeURIComponent(title || "Work shift")}` : null;
  };
  let list = recent;
  let path = build(list);
  // Keep the link comfortably short for every phone: drop the furthest-away shifts if the roster is huge.
  while(path && path.length > 7000 && list.length > 1){
    list = list.slice(0, Math.max(1, Math.floor(list.length * 0.8)));
    path = build(list);
  }
  if(!path) return null;
  return {path, https: `${origin}${path}`, webcal: `webcal://${host}${path}`, length: path.length, shifts: list.length};
}

export function addToCalendarLink(entries, {timeZone, title, lang}){
  const link = calendarLinkFor(entries, {timeZone, title, origin: window.location.origin, host: window.location.host});
  if(!link){ alert(t(lang, "noShifts")); return; }
  if(isApplePhone()) window.location.href = link.webcal;
  else window.open(link.https, "_blank") || (window.location.href = link.https);
}

// ---------------------------------------------------------------------------
// Admin: who is scanning most + spend this month (data comes from admin-only RPCs)
// ---------------------------------------------------------------------------
export function AdminScans({supabase, budgetUsd = 10}){
  const [rows, setRows] = useState(null);
  const [spend, setSpend] = useState(0);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      const a = await supabase.rpc("admin_scan_summary");
      const b = await supabase.rpc("admin_scan_spend");
      if(a.error){ setErr(a.error.message); return; }
      setRows(a.data || []); setSpend(Number(b.data || 0));
    })();
  }, []);
  const pct = Math.min(100, Math.round(spend / budgetUsd * 100));
  return <div style={{marginTop: 16}}>
    <h3 style={{margin: "0 0 6px"}}>Roster scans</h3>
    {err && <p className="rateNote" style={{color: "#e88"}}>{err}</p>}
    <div className="rateNote">Estimated spend this month: ${spend.toFixed(2)} of ${budgetUsd.toFixed(2)} ({pct}%){pct >= 80 ? " — nearing the cap" : ""}</div>
    <div style={{height: 6, background: "#2a251c", borderRadius: 3, margin: "6px 0 10px"}}><div style={{width: `${pct}%`, height: 6, borderRadius: 3, background: pct >= 80 ? "#d96b5f" : "#c9a24a"}}/></div>
    {rows === null && !err && <p className="rateNote">…</p>}
    {rows && !rows.length && <p className="rateNote">No scans yet.</p>}
    {rows && rows.map(r => <div key={r.user_id} style={{display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid #2a251c"}}>
      <div style={{minWidth: 0}}><b style={{overflowWrap: "anywhere"}}>{r.email || r.user_id.slice(0, 8)}</b>
        <small style={{display: "block", opacity: .7}}>today {r.scans_today} · 7d {r.scans_7d} · month {r.scans_month}{r.limit_hits_7d > 0 ? ` · hit limit ${r.limit_hits_7d}d` : ""}{r.failed_7d > 0 ? ` · ${r.failed_7d} failed` : ""}</small></div>
      <span style={{whiteSpace: "nowrap"}}>${Number(r.est_cost_month).toFixed(2)}</span>
    </div>)}
  </div>;
}

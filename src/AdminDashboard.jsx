import { Component, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * VV Admin Dashboard (black + gold)
 * Usage:  <AdminDashboard supabase={supabase} onClose={() => ...} />
 * Uses your existing RPCs admin_scan_summary / admin_scan_spend plus admin_dashboard_extras.
 * Optional: add this to your index.html <head> for the serif numerals:
 *   <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
 * Without it, the fallback fonts are used.
 */

const MONTHLY_CAP = 10; // USD
const DAILY_LIMIT = 2;  // scans per user per day
const TZ = "Pacific/Auckland";

const css = `
.vva{--gold1:#F3DC8A;--gold2:#D4AF37;--gold3:#9c7d1c;--line:rgba(212,175,55,.2);--text:#F3EBD3;--muted:#a09878;--red:#ec6a55;
 color:var(--text);font-family:'Manrope','Avenir Next','Segoe UI',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:22px 16px 56px;min-height:100vh;
 background:radial-gradient(120% 50% at 50% -8%,#2a2106 0%,rgba(0,0,0,0) 70%),#000}
.vva *{box-sizing:border-box}
.vva .serif{font-family:'Cormorant Garamond','Iowan Old Style',Georgia,serif}
.vva .head{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.vva .logo{width:44px;height:44px;border-radius:13px;border:1px solid var(--line);display:grid;place-items:center;background:#0b0a06;flex:none}
.vva .head h1{margin:0;font-size:28px;font-weight:600;line-height:1}
.vva .head p{margin:4px 0 0;font-size:12.5px;color:var(--muted)}
.vva .sp{flex:1}
.vva .btn{font:inherit;font-size:13px;font-weight:600;color:var(--gold1);background:rgba(212,175,55,.08);border:1px solid var(--line);border-radius:999px;padding:8px 14px;cursor:pointer}
.vva .btn+.btn{margin-left:6px}
.vva .btn:focus-visible,.vva .seg button:focus-visible{outline:2px solid var(--gold2);outline-offset:2px}
.vva .card{background:linear-gradient(165deg,#16130a,#0a0905);border:1px solid var(--line);border-radius:20px;padding:18px}
.vva .hero{display:flex;gap:18px;align-items:center;flex-wrap:wrap;box-shadow:0 0 60px rgba(212,175,55,.07)}
.vva .ring{position:relative;width:150px;height:150px;flex:none}
.vva .ring svg{display:block}
.vva .ring .mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.vva .ring .mid b{font-size:36px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.vva .ring .mid span{font-size:12px;color:var(--muted);margin-top:4px}
.vva .hero .info{flex:1;min-width:150px}
.vva .lbl{font-size:12.5px;color:var(--muted)}
.vva .left{font-size:40px;font-weight:600;line-height:1.05;margin:2px 0 10px;font-variant-numeric:tabular-nums}
.vva .pill{display:inline-block;font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:999px;background:rgba(212,175,55,.12);color:var(--gold1);border:1px solid var(--line)}
.vva .pill.bad{background:rgba(236,106,85,.12);color:var(--red);border-color:rgba(236,106,85,.4)}
.vva .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0 4px}
.vva .tile{padding:14px 14px 12px;border-radius:16px}
.vva .tile b{display:block;font-size:34px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.vva .tile span{display:block;font-size:12px;color:var(--muted);margin-top:6px}
.vva h2{margin:28px 0 12px;font-size:22px;font-weight:600;display:flex;align-items:baseline;justify-content:space-between}
.vva h2 small{font-family:'Manrope',system-ui,sans-serif;font-size:12px;font-weight:500;color:var(--muted)}
.vva .bars{display:flex;align-items:flex-end;gap:5px;height:110px}
.vva .bw{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center}
.vva .bar{width:100%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#7d6618,#3b300b);min-height:3px}
.vva .bar.t{background:linear-gradient(180deg,var(--gold1),var(--gold3));box-shadow:0 0 14px rgba(243,220,138,.45)}
.vva .days{display:flex;gap:5px;margin-top:8px}
.vva .days span{flex:1;text-align:center;font-size:10.5px;color:var(--muted)}
.vva .days span.t{color:var(--gold1);font-weight:700}
.vva .seg{display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px}
.vva .seg button{font:inherit;font-size:12.5px;font-weight:600;white-space:nowrap;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:999px;padding:7px 13px;cursor:pointer}
.vva .seg button[aria-pressed=true]{color:#1a1403;border-color:transparent;background:linear-gradient(135deg,var(--gold1),var(--gold2))}
.vva .note{border-radius:12px;padding:10px 13px;font-size:13px;margin:0 0 12px;background:rgba(212,175,55,.09);border:1px solid var(--line);color:var(--gold1)}
.vva .note.bad{background:rgba(236,106,85,.1);border-color:rgba(236,106,85,.4);color:var(--red)}
.vva .u{display:grid;grid-template-columns:44px 1fr auto;gap:2px 13px;align-items:center;padding:13px 14px;margin-bottom:9px;border-radius:16px}
.vva .av{grid-row:1/3;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:21px;font-weight:700;color:var(--gold1);background:radial-gradient(circle at 30% 25%,#2b230c,#0d0b05);border:1.5px solid var(--gold3)}
.vva .nm{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vva .sub{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vva .rt{grid-row:1/3;text-align:right}
.vva .rt b{display:block;font-size:28px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums}
.vva .pips{display:flex;gap:4px;justify-content:flex-end;margin-top:6px}
.vva .pip{width:9px;height:9px;border-radius:50%;border:1px solid var(--gold3)}
.vva .pip.on{background:var(--gold2);border-color:var(--gold2)}
.vva .pip.full{background:var(--red);border-color:var(--red)}
.vva .share{grid-column:2/3;height:4px;border-radius:4px;background:#1f1b0d;margin-top:7px;overflow:hidden}
.vva .share i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--gold3),var(--gold1))}
.vva .feed{padding:6px 16px}
.vva .a{display:grid;grid-template-columns:10px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(212,175,55,.1)}
.vva .a:last-child{border-bottom:0}
.vva .dot{width:8px;height:8px;border-radius:50%;background:var(--gold2);box-shadow:0 0 8px rgba(212,175,55,.6)}
.vva .dot.bad{background:var(--red);box-shadow:0 0 8px rgba(236,106,85,.6)}
.vva .a .nm{font-size:14px}
.vva .amt{font-size:13px;font-weight:600;color:var(--gold1);font-variant-numeric:tabular-nums}
.vva .amt.bad{color:var(--red)}
.vva .empty{color:var(--muted);font-size:13px;padding:14px 0}
.vva .views{display:flex;gap:8px;margin:0 0 18px}
.vva .views button{flex:1;font:inherit;font-size:14px;font-weight:700;color:var(--muted);background:transparent;border:1px solid var(--line);border-radius:14px;padding:11px 12px;cursor:pointer}
.vva .views button[aria-pressed=true]{color:#1a1403;border-color:transparent;background:linear-gradient(135deg,var(--gold1),var(--gold2))}
.vva .badge{display:inline-block;min-width:20px;padding:1px 6px;margin-left:6px;border-radius:999px;background:var(--red);color:#fff;font-size:12px;line-height:18px}
.vva .req{display:grid;grid-template-columns:44px 1fr;gap:4px 13px;padding:14px;margin-bottom:9px;border-radius:16px}
.vva .req .av{grid-row:1/3}
.vva .req .acts{grid-column:2/3;display:flex;gap:8px;margin-top:8px}
.vva .req.pending{border-color:rgba(243,220,138,.5);box-shadow:0 0 28px rgba(212,175,55,.1)}
.vva .ok,.vva .no{font:inherit;font-size:13px;font-weight:700;border-radius:999px;padding:8px 16px;cursor:pointer}
.vva .ok{color:#1a1403;border:0;background:linear-gradient(135deg,var(--gold1),var(--gold2))}
.vva .no{color:var(--red);background:transparent;border:1px solid rgba(236,106,85,.45)}
.vva .ok:disabled,.vva .no:disabled{opacity:.5;cursor:default}
.vva .ok:focus-visible,.vva .no:focus-visible{outline:2px solid var(--gold1);outline-offset:2px}
.vva .none{color:var(--muted);font-size:13px;padding:2px 2px 8px}
@media (max-width:380px){.vva .tile b{font-size:28px}.vva .left{font-size:34px}}
`;

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD
const fmtDay = (d) => dayFmt.format(d);
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const rel = (iso) => {
  if (!iso) return "no scans yet";
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
};
const short = (email) => (email || "unknown").split("@")[0];
const cap1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const R = 58;
const C = 2 * Math.PI * R;

function AdminDashboardInner({ supabase, onClose }) {
  const [state, setState] = useState({ loading: true, error: null, summary: [], spend: 0, extras: null, people: [] });
  const [sort, setSort] = useState("month");
  const [view, setView] = useState("overview");
  const [busyEmail, setBusyEmail] = useState(null);
  const [actionError, setActionError] = useState(null);

  const setAccess = async (email, allow) => {
    setBusyEmail(email);
    setActionError(null);
    const { error } = await supabase.rpc("admin_set_user_access", { p_email: email, p_allow: allow });
    setBusyEmail(null);
    if (error) return setActionError(error.message);
    load();
  };

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const [sum, sp, ex, ppl] = await Promise.all([
        supabase.rpc("admin_scan_summary"),
        supabase.rpc("admin_scan_spend"),
        supabase.rpc("admin_dashboard_extras"),
        supabase.rpc("admin_list_users"),
      ]);
      const err = sum.error || sp.error || ex.error || ppl.error;
      if (err) throw err;
      setState({ loading: false, error: null, summary: sum.data || [], spend: Number(sp.data || 0), extras: ex.data, people: ppl.data || [] });
    } catch (e) {
      setState({ loading: false, error: e.message || "Could not load", summary: [], spend: 0, extras: null, people: [] });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const m = useMemo(() => {
    const { summary, spend, extras } = state;
    const people = extras?.users || [];
    const byId = Object.fromEntries(summary.map((r) => [r.user_id, r]));
    const users = people.map((p) => {
      const r = byId[p.user_id] || {};
      return {
        user_id: p.user_id,
        name: p.name || short(p.email),
        scans_today: Number(r.scans_today || 0),
        scans_month: Number(r.scans_month || 0),
        cost_month: Number(r.est_cost_month || 0),
        failed_7d: Number(r.failed_7d || 0),
        last_scan: r.last_scan || null,
      };
    });
    const nameById = Object.fromEntries(users.map((u) => [u.user_id, u.name]));

    const today = fmtDay(new Date());
    const dom = Number(today.slice(8));
    const dim = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate();
    const proj = (spend / dom) * dim;

    const costByDay = Object.fromEntries((extras?.daily || []).map((d) => [d.day, Number(d.cost || 0)]));
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = fmtDay(d);
      days.push({ key, label: Number(key.slice(8)), cost: costByDay[key] || 0 });
    }
    const maxDay = Math.max(0.01, ...days.map((d) => d.cost));

    const sorted = [...users].sort((a, b) =>
      sort === "today" ? b.scans_today - a.scans_today || b.scans_month - a.scans_month
      : sort === "spend" ? b.cost_month - a.cost_month
      : sort === "recent" ? new Date(b.last_scan || 0) - new Date(a.last_scan || 0)
      : b.scans_month - a.scans_month || a.name.localeCompare(b.name)
    );

    return {
      today, spend, proj, days, maxDay, sorted, nameById,
      count: users.length,
      maxMonth: Math.max(1, ...users.map((u) => u.scans_month)),
      atLimit: users.filter((u) => u.scans_today >= DAILY_LIMIT).length,
      okToday: users.reduce((a, u) => a + u.scans_today, 0),
      okMonth: users.reduce((a, u) => a + u.scans_month, 0),
      recent: extras?.recent || [],
    };
  }, [state, sort]);

  const pct = Math.min(100, (m.spend / MONTHLY_CAP) * 100);
  const hot = pct >= 80;
  const over = m.proj > MONTHLY_CAP;
  const notAdmin = !state.loading && !state.error && m.count === 0;
  const pendingCount = state.people.filter((p) => p.state === "pending").length;

  return (
    <div className="vva">
      <style>{css}</style>

      <div className="head">
        <div className="logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none" stroke="#D4AF37" strokeWidth="3.2" strokeLinejoin="miter">
            <path d="M3 7 L11 33 L20 15 L29 33 L37 7" />
            <path d="M10 7 L16 22" strokeWidth="2" stroke="#9c7d1c" />
            <path d="M30 7 L24 22" strokeWidth="2" stroke="#9c7d1c" />
          </svg>
        </div>
        <div>
          <h1 className="serif">Admin</h1>
          <p>Roster scans and API spend</p>
        </div>
        <div className="sp" />
        <div>
          <button className="btn" onClick={load} disabled={state.loading}>{state.loading ? "Loading…" : "Refresh"}</button>
          {onClose && <button className="btn" onClick={onClose}>Close</button>}
        </div>
      </div>

      {state.error && <div className="note bad">Couldn't load data: {state.error}</div>}
      {notAdmin && <div className="note bad">This account isn't an admin, so there's nothing to show.</div>}

      {!notAdmin && (
        <div className="views" role="group" aria-label="Admin sections">
          <button aria-pressed={view === "overview"} onClick={() => setView("overview")}>Overview</button>
          <button aria-pressed={view === "users"} onClick={() => setView("users")}>
            Users{pendingCount > 0 && <span className="badge">{pendingCount}</span>}
          </button>
        </div>
      )}

      {view === "users" && !notAdmin && (
        <UsersPanel people={state.people} busyEmail={busyEmail} error={actionError} onSet={setAccess} />
      )}

      {view === "overview" && (<>
      <section className="card hero" aria-label="Monthly API spend">
        <div className="ring">
          <svg width="150" height="150" viewBox="0 0 140 140">
            <defs>
              <linearGradient id="vv-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#F3DC8A" />
                <stop offset="1" stopColor="#9c7d1c" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r={R} fill="none" stroke="#211d0f" strokeWidth="10" />
            <circle
              cx="70" cy="70" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
              stroke={hot ? "#ec6a55" : "url(#vv-ring)"}
              strokeDasharray={`${(pct / 100) * C} ${C}`}
              transform="rotate(-90 70 70)"
              style={{ transition: "stroke-dasharray .6s ease" }}
            />
          </svg>
          <div className="mid">
            <b className="serif">{money(m.spend)}</b>
            <span>of {money(MONTHLY_CAP)} cap</span>
          </div>
        </div>
        <div className="info">
          <div className="lbl">Left this month</div>
          <div className="left serif">{money(Math.max(0, MONTHLY_CAP - m.spend))}</div>
          <span className={`pill ${over ? "bad" : ""}`}>
            On pace for {money(m.proj)}{over ? " · over cap" : ""}
          </span>
        </div>
      </section>

      <div className="tiles">
        <div className="card tile"><b className="serif">{m.okToday}</b><span>last 24 hours</span></div>
        <div className="card tile"><b className="serif">{m.okMonth}</b><span>scans this month</span></div>
        <div className="card tile"><b className="serif">{m.count}</b><span>users</span></div>
      </div>

      <h2 className="serif">Daily spend<small>last 14 days</small></h2>
      <div className="card">
        <div className="bars" aria-hidden="true">
          {m.days.map((d) => (
            <div className="bw" key={d.key}>
              <div
                className={`bar ${d.key === m.today ? "t" : ""}`}
                style={{ height: `${Math.max(3, (d.cost / m.maxDay) * 100)}%` }}
                title={`${d.key}: ${money(d.cost)}`}
              />
            </div>
          ))}
        </div>
        <div className="days" aria-hidden="true">
          {m.days.map((d) => (
            <span key={d.key} className={d.key === m.today ? "t" : ""}>{d.label}</span>
          ))}
        </div>
      </div>

      <h2 className="serif">Who scans the most</h2>
      <div className="seg" role="group" aria-label="Sort users">
        {[["month", "This month"], ["today", "Last 24 h"], ["spend", "Spend"], ["recent", "Latest"]].map(([k, l]) => (
          <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>
        ))}
      </div>
      {m.atLimit > 0 && (
        <div className="note">
          {m.atLimit} {m.atLimit === 1 ? "user has" : "users have"} used all {DAILY_LIMIT} scans in the last 24 hours.
        </div>
      )}
      {m.sorted.map((u) => (
        <div className="card u" key={u.user_id}>
          <div className="av serif" aria-hidden="true">{cap1(u.name).charAt(0)}</div>
          <div className="nm">{u.name}</div>
          <div className="rt">
            <b className="serif">{u.scans_month}</b>
            <div className="pips" aria-label={`${u.scans_today} of ${DAILY_LIMIT} scans in the last 24 hours`}>
              {Array.from({ length: DAILY_LIMIT }).map((_, i) => (
                <span key={i} className={`pip ${i < u.scans_today ? (u.scans_today >= DAILY_LIMIT ? "full" : "on") : ""}`} />
              ))}
            </div>
          </div>
          <div className="sub">
            {rel(u.last_scan)} · {money(u.cost_month)}{u.failed_7d > 0 ? ` · ${u.failed_7d} failed` : ""}
          </div>
          <div className="share"><i style={{ width: `${(u.scans_month / m.maxMonth) * 100}%` }} /></div>
        </div>
      ))}

      <h2 className="serif">Latest activity</h2>
      <div className="card feed">
        {m.recent.length === 0 && <div className="empty">No scans logged yet.</div>}
        {m.recent.map((x) => {
          const ok = x.status === "ok";
          return (
            <div className="a" key={x.id}>
              <span className={`dot ${ok ? "" : "bad"}`} />
              <div>
                <div className="nm">{m.nameById[x.user_id] || "Unknown"}</div>
                <div className="sub">{rel(x.created_at)}</div>
              </div>
              <span className={`amt ${ok ? "" : "bad"}`}>{ok ? money(x.cost) : String(x.status).replace(/_/g, " ")}</span>
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}

/**
 * Renders the dashboard inside a shadow root so the app's global CSS can't
 * restyle or hide it, and shows any crash on screen instead of a blank page.
 */
function ShadowHost({ children }) {
  const hostRef = useRef(null);
  const [mount, setMount] = useState(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot || host.attachShadow({ mode: "open" });
    let el = shadow.querySelector("[data-vv-root]");
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("data-vv-root", "");
      shadow.appendChild(el);
    }
    setMount(el);
  }, []);
  return (
    <div ref={hostRef} style={{ display: "block", background: "#000", minHeight: "60vh" }}>
      {mount && createPortal(children, mount)}
    </div>
  );
}

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error("AdminDashboard crashed", err); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ color: "#F3EBD3", background: "#000", padding: 20, fontFamily: "system-ui, sans-serif" }}>
          <b>The admin dashboard hit an error.</b>
          <div style={{ marginTop: 8, fontSize: 13, color: "#ec6a55", wordBreak: "break-word" }}>
            {String(this.state.err?.message || this.state.err)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminDashboard(props) {
  return (
    <ShadowHost>
      <Boundary>
        <AdminDashboardInner {...props} />
      </Boundary>
    </ShadowHost>
  );
}

function UserRow({ p, kind, busy, onSet }) {
  const ask = (msg, allow) => {
    if (window.confirm(msg)) onSet(p.email, allow);
  };
  return (
    <div className={`card req ${kind === "pending" ? "pending" : ""}`}>
      <div className="av serif" aria-hidden="true">{cap1(p.name || "?").charAt(0)}</div>
      <div>
        <div className="nm">{p.name}</div>
        <div className="sub">{p.email} · joined {rel(p.signed_up_at)}</div>
      </div>
      <div className="acts">
        {kind === "pending" && (
          <>
            <button className="ok" disabled={busy} onClick={() => onSet(p.email, true)}>Approve</button>
            <button className="no" disabled={busy} onClick={() => ask(`Reject ${p.name}? They won't be able to use the app.`, false)}>Reject</button>
          </>
        )}
        {kind === "approved" && (
          <button className="no" disabled={busy} onClick={() => ask(`Revoke access for ${p.name}?`, false)}>Revoke</button>
        )}
        {kind === "revoked" && (
          <button className="ok" disabled={busy} onClick={() => onSet(p.email, true)}>Restore</button>
        )}
      </div>
    </div>
  );
}

function UsersPanel({ people, busyEmail, error, onSet }) {
  const pending = people.filter((p) => p.state === "pending");
  const approved = people.filter((p) => p.state === "approved");
  const revoked = people.filter((p) => p.state === "revoked");
  const row = (p, kind) => <UserRow key={p.user_id} p={p} kind={kind} busy={busyEmail === p.email} onSet={onSet} />;
  return (
    <div>
      {error && <div className="note bad">{error}</div>}
      <h2 className="serif" style={{ marginTop: 4 }}>Awaiting approval<small>{pending.length}</small></h2>
      {pending.length === 0 ? <div className="none">No one is waiting.</div> : pending.map((p) => row(p, "pending"))}
      <h2 className="serif">Approved<small>{approved.length}</small></h2>
      {approved.map((p) => row(p, "approved"))}
      {revoked.length > 0 && (
        <>
          <h2 className="serif">Blocked<small>{revoked.length}</small></h2>
          {revoked.map((p) => row(p, "revoked"))}
        </>
      )}
    </div>
  );
}

/**
 * True only for accounts listed in the `admins` table. Use it to show the Admin tab:
 *   const isAdmin = useIsAdmin(supabase, session);
 */
export function useIsAdmin(supabase, session) {
  const [isAdmin, setIsAdmin] = useState(false);
  const uid = session?.user?.id;
  useEffect(() => {
    let off = false;
    (async () => {
      if (!uid) return setIsAdmin(false);
      const { data } = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
      if (!off) setIsAdmin(!!data);
    })();
    return () => { off = true; };
  }, [supabase, uid]);
  return isAdmin;
}

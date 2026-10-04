import { useState } from "react";

/**
 * VV sign-up page (black + gold)
 * Usage:  <SignUpPage supabase={supabase} onSwitchToLogin={() => setScreen("login")} />
 *
 * Creates the account with Supabase Auth. The person can't use the app until
 * an admin approves them in Admin > Users.
 */

const css = `
.vvs{--gold1:#F3DC8A;--gold2:#D4AF37;--gold3:#9c7d1c;--line:rgba(212,175,55,.22);--text:#F3EBD3;--muted:#a09878;--red:#ec6a55;
 color:var(--text);font-family:'Manrope','Avenir Next','Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px 16px;
 background:radial-gradient(120% 55% at 50% -8%,#2a2106 0%,rgba(0,0,0,0) 70%),#000}
.vvs *{box-sizing:border-box}
.vvs .serif{font-family:'Cormorant Garamond','Iowan Old Style',Georgia,serif}
.vvs .wrap{width:100%;max-width:400px}
.vvs .logo{width:64px;height:64px;border-radius:18px;border:1px solid var(--line);display:grid;place-items:center;background:#0b0a06;margin:0 auto 14px;box-shadow:0 0 40px rgba(212,175,55,.12)}
.vvs h1{margin:0;text-align:center;font-size:34px;font-weight:600;line-height:1.05}
.vvs .tag{margin:6px 0 24px;text-align:center;font-size:13px;color:var(--muted)}
.vvs .card{background:linear-gradient(165deg,#16130a,#0a0905);border:1px solid var(--line);border-radius:22px;padding:22px 18px}
.vvs label{display:block;font-size:12.5px;color:var(--muted);margin:0 0 6px}
.vvs .f{margin-bottom:14px}
.vvs input{width:100%;font:inherit;font-size:16px;color:var(--text);background:#0b0a06;border:1px solid var(--line);border-radius:12px;padding:13px 14px;outline:none}
.vvs input:focus{border-color:var(--gold2);box-shadow:0 0 0 3px rgba(212,175,55,.15)}
.vvs .btn{width:100%;font:inherit;font-size:15px;font-weight:700;color:#1a1403;background:linear-gradient(135deg,var(--gold1),var(--gold2));border:0;border-radius:12px;padding:14px;margin-top:4px;cursor:pointer}
.vvs .btn:disabled{opacity:.6;cursor:default}
.vvs .btn:focus-visible,.vvs .link:focus-visible{outline:2px solid var(--gold1);outline-offset:3px}
.vvs .err{background:rgba(236,106,85,.1);border:1px solid rgba(236,106,85,.4);color:var(--red);border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:14px}
.vvs .foot{text-align:center;margin-top:18px;font-size:13px;color:var(--muted)}
.vvs .link{font:inherit;font-size:13px;font-weight:700;color:var(--gold1);background:none;border:0;padding:0;cursor:pointer}
.vvs .done{text-align:center;padding:10px 4px}
.vvs .done .ring{width:62px;height:62px;border-radius:50%;margin:0 auto 14px;display:grid;place-items:center;border:2px solid var(--gold2);box-shadow:0 0 28px rgba(212,175,55,.3)}
.vvs .done h2{margin:0 0 8px;font-size:26px;font-weight:600}
.vvs .done p{margin:0 0 6px;font-size:14px;line-height:1.5;color:var(--muted)}
.vvs .done b{color:var(--text);font-weight:600}
`;

const Logo = () => (
  <svg width="38" height="38" viewBox="0 0 40 40" fill="none" stroke="#D4AF37" strokeWidth="3.2" strokeLinejoin="miter" aria-hidden="true">
    <path d="M3 7 L11 33 L20 15 L29 33 L37 7" />
    <path d="M10 7 L16 22" strokeWidth="2" stroke="#9c7d1c" />
    <path d="M30 7 L24 22" strokeWidth="2" stroke="#9c7d1c" />
  </svg>
);

export default function SignUpPage({ supabase, onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // null | { needsEmail: boolean }

  const submit = async (e) => {
    e?.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setError("Enter your name.");
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    if (password !== confirm) return setError("The passwords don't match.");

    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: name.trim() } },
      });
      if (err) throw err;
      // An existing email returns a user with no identities instead of an error.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error("This email already has an account. Log in instead.");
      }
      const needsEmail = !data?.session;
      if (data?.session) await supabase.auth.signOut(); // keep them out until approved
      setDone({ needsEmail });
    } catch (e2) {
      const msg = String(e2?.message || "Something went wrong");
      setError(/already registered|already exists/i.test(msg) ? "This email already has an account. Log in instead." : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="vvs">
      <style>{css}</style>
      <div className="wrap">
        <div className="logo"><Logo /></div>
        <h1 className="serif">Duty Roster</h1>
        <p className="tag">{done ? "Request sent" : "Create your account"}</p>

        <div className="card">
          {done ? (
            <div className="done">
              <div className="ring">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F3DC8A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5 L10 17.5 L19 7" />
                </svg>
              </div>
              <h2 className="serif">Waiting for approval</h2>
              {done.needsEmail && <p>First, tap the confirmation link we emailed to <b>{email.trim()}</b>.</p>}
              <p>An admin needs to approve your account before you can use the app. Log in again later to check.</p>
              <div className="foot">
                <button className="link" onClick={onSwitchToLogin}>Back to log in</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              {error && <div className="err" role="alert">{error}</div>}
              <div className="f">
                <label htmlFor="vvs-name">Your name</label>
                <input id="vvs-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="f">
                <label htmlFor="vvs-email">Email</label>
                <input id="vvs-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="f">
                <label htmlFor="vvs-pw">Password</label>
                <input id="vvs-pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="f">
                <label htmlFor="vvs-pw2">Confirm password</label>
                <input id="vvs-pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Request access"}</button>
              <div className="foot">
                Already have an account? <button type="button" className="link" onClick={onSwitchToLogin}>Log in</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

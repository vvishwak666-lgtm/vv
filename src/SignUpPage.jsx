import { useState } from "react";

/**
 * VV sign-up screen. Uses the same look as the app's sign-in screen.
 * Usage:  <SignUpPage supabase={supabase} T={T} onSwitchToLogin={() => ...} />
 *
 * Creates the account with Supabase Auth. The person can't use the app until an
 * admin approves them in Admin > Users.
 */
export default function SignUpPage({ supabase, onSwitchToLogin, T = (s) => s }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(null); // null | { needsEmail: boolean }

  const submit = async () => {
    if (busy) return;
    setMsg("");
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim()) return setMsg(T("Enter your name."));
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return setMsg(T("Enter a valid email address."));
    if (password.length < 8) return setMsg(T("Password must be at least 8 characters."));
    if (password !== confirm) return setMsg(T("Passwords do not match."));

    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { name: name.trim() },
          emailRedirectTo: "https://vv-sigma-one.vercel.app/",
        },
      });
      if (error) throw error;
      // An email that already has an account comes back as a user with no identities.
      if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error("already registered");
      }
      // With "Confirm email" on there is no session yet. With it off, the app's gate
      // takes over and shows the waiting-for-approval screen by itself.
      setDone({ needsEmail: !data?.session });
    } catch (e) {
      const text = String(e?.message || "");
      setMsg(/already registered|already exists/i.test(text)
        ? T("This email already has an account. Go back and sign in.")
        : text || T("Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="authScreen"><div className="authCard">
        <img src="/icon-512.png" alt={T("VV")} style={{ height: 56, width: 56, display: "block", margin: "0 auto 12px" }} />
        <h2>{T("Request sent")}</h2>
        {done.needsEmail && <p>{T("First, tap the confirmation link we emailed to")} {email.trim()}.</p>}
        <p>{T("An admin needs to approve your account before you can use the app. Sign in again later to check.")}</p>
        <button className="primary authFull" onClick={onSwitchToLogin}>{T("Back to sign in")}</button>
      </div></div>
    );
  }

  return (
    <div className="authScreen"><div className="authCard">
      <img src="/icon-512.png" alt={T("VV")} style={{ height: 56, width: 56, display: "block", margin: "0 auto 12px" }} />
      <h2>{T("Create account")}</h2>
      <p>{T("An admin approves new accounts before they can use the app.")}</p>
      <input type="text" placeholder={T("Your name")} value={name} autoComplete="name"
        onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder={T("Work email")} value={email} autoComplete="email"
        onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder={T("Password")} value={password} autoComplete="new-password"
        onChange={(e) => setPassword(e.target.value)} />
      <input type="password" placeholder={T("Confirm password")} value={confirm} autoComplete="new-password"
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      <button className="primary authFull" onClick={submit} disabled={busy}>
        {busy ? T("Sending…") : T("Request access")}
      </button>
      <button className="ghost authFull" onClick={onSwitchToLogin}>{T("Back to sign in")}</button>
      {msg && <small>{msg}</small>}
    </div></div>
  );
}

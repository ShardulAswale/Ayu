import React from 'react';
import { ArrowLeft, Eye, EyeOff, Leaf, LockKeyhole } from 'lucide-react';
import { currentUser, getCsrf, login, logout, SessionUser } from './auth-client';
import { dashboardPathForRole } from './role-routing.mjs';
import './login.css';

export function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [csrf, setCsrf] = React.useState('');
  const [serverSlow, setServerSlow] = React.useState(false);
  const signingIn = React.useRef(false);
  const configured = Boolean(import.meta.env.VITE_API_URL);

  React.useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    // Only check the existing session on entry. Anonymous CSRF cookies must
    // be created once, immediately before the user actually submits login.
    const delay = window.setTimeout(() => { if (!cancelled) setServerSlow(true); }, 6000);
    void currentUser().then(existing => {
      if (!cancelled && !signingIn.current && existing) {
        setUser(existing);
        window.location.replace(dashboardPathForRole(existing.role));
      }
    }).catch(() => { /* A failed old-session lookup must not block sign-in. */ })
      .finally(() => { window.clearTimeout(delay); if (!cancelled) setServerSlow(false); });
    return () => { cancelled = true; window.clearTimeout(delay); };
  }, [configured]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    signingIn.current = true;
    setBusy(true); setError('');
    try {
      // A fresh CSRF fetch also recovers from an expired anonymous session.
      const token = await getCsrf();
      setCsrf(token);
      const result = await login(email.trim(), password, token);
      setUser(result.user); setCsrf(result.csrfToken); setPassword(''); window.location.replace(dashboardPathForRole(result.user.role));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError('');
    try { await logout(csrf); setUser(null); setCsrf(await getCsrf()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-out failed.'); }
    finally { setBusy(false); }
  }

  return <main className="ayu-login-page"><div className="ayu-login-card">
    <a href="/" className="ayu-login-brand"><Leaf size={22}/> ayu.</a>
    <a href="/" className="ayu-login-back"><ArrowLeft size={15}/> Back to website</a>
    <div className="ayu-login-mark"><LockKeyhole size={23}/></div>
    <h1>{user ? 'Signed in' : 'Log in to Ayu'}</h1>
    <p className="ayu-login-intro">{user ? 'Your identity has been verified.' : 'One secure sign-in for patients, dietitians and administrators.'}</p>
    {!configured && <div className="ayu-login-alert" role="status">Secure sign-in is not yet available on this deployment. The API address has not been configured.</div>}
    {error && <div className="ayu-login-alert" role="alert">{error}</div>}
    {serverSlow && !error && <p role="status">Connecting to Ayu. The server may be waking from inactivity; you can still enter your details.</p>}
    {user ? <div className="ayu-login-session">
      <strong>{user.email}</strong>
      <span>Role: {user.role}</span>
      <p><a href={dashboardPathForRole(user.role)}>Continue to your dashboard</a></p>
      <button type="button" onClick={signOut} disabled={busy || !csrf}>Sign out</button>
    </div> : <form onSubmit={submit}>
      <label htmlFor="ayu-email">Email address</label>
      <input id="ayu-email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
      <label htmlFor="ayu-password">Password</label>
      <div className="ayu-password-field"><input id="ayu-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"/><button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
      <button className="ayu-login-submit" type="submit" disabled={!configured || busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>}
    <p className="ayu-login-note"><a href="/#signup">Sign up information</a></p>
  </div></main>;
}

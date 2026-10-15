import React from 'react';
import { ArrowLeft, Eye, EyeOff, Leaf, LockKeyhole } from 'lucide-react';
import { currentUser, getCsrf, login, logout, SessionUser } from './auth-client';
import './login.css';

type Portal = 'staff' | 'customer';

function permitted(user: SessionUser, portal: Portal): boolean {
  return portal === 'staff' ? user.role === 'admin' || user.role === 'dietitian' : user.role === 'patient';
}

export function LoginPage({ portal }: { portal: Portal }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [csrf, setCsrf] = React.useState('');
  const configured = Boolean(import.meta.env.VITE_API_URL);
  const isStaff = portal === 'staff';
  const otherPath = isStaff ? '/login' : '/admin';
  const otherLabel = isStaff ? 'Customer login' : 'Dietitian & admin login';
  const allowed = user ? permitted(user, portal) : false;

  React.useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      try {
        const existing = await currentUser();
        const token = await getCsrf();
        if (!cancelled) { setUser(existing); setCsrf(token); if (existing && permitted(existing, portal)) window.location.hash = '#dashboard'; }
      } catch { if (!cancelled) setError('Unable to connect to the authentication service.'); }
    })();
    return () => { cancelled = true; };
  }, [configured]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!csrf || busy) return;
    setBusy(true); setError('');
    try {
      const result = await login(email.trim(), password, csrf);
      setUser(result.user); setCsrf(result.csrfToken); setPassword(''); if (permitted(result.user, portal)) window.location.hash = '#dashboard';
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
    <h1>{user ? (allowed ? 'Signed in' : 'Different account type') : (isStaff ? 'Dietitian & admin login' : 'Customer login')}</h1>
    <p className="ayu-login-intro">{user ? (allowed ? 'Your identity has been verified.' : 'This account belongs to a different Ayu portal.') : (isStaff ? 'Secure sign-in for approved dietitians and administrators.' : 'Sign in to your Ayu patient account.')}</p>
    {!configured && <div className="ayu-login-alert" role="status">Secure sign-in is not yet available on this deployment. The API address has not been configured.</div>}
    {error && <div className="ayu-login-alert" role="alert">{error}</div>}
    {user ? <div className="ayu-login-session">
      <strong>{user.email}</strong>
      <span>Role: {user.role}</span>
      {allowed
        ? <p>Sign-in successful. Your role-specific dashboard will be available after the remaining authorization checks are completed.</p>
        : <p role="alert">This account cannot use the {isStaff ? 'staff' : 'customer'} portal. <a href={otherPath}>Continue to {otherLabel.toLowerCase()}</a>.</p>}
      <button type="button" onClick={signOut} disabled={busy || !csrf}>Sign out</button>
    </div> : <form onSubmit={submit}>
      <label htmlFor="ayu-email">Email address</label>
      <input id="ayu-email" type="email" autoComplete="username" maxLength={254} required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/>
      <label htmlFor="ayu-password">Password</label>
      <div className="ayu-password-field"><input id="ayu-password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password"/><button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
      <button className="ayu-login-submit" type="submit" disabled={!configured || !csrf || busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>}
    <p className="ayu-login-note"><a href={otherPath}>{otherLabel}</a>{!isStaff && <> · <a href="/#signup">Sign up information</a></>}</p>
  </div></main>;
}

import React from 'react';
import { activatePatient } from './auth-client';

export function ActivatePage({ token }: { token: string }) {
  const [password, setPassword] = React.useState('');
  const [confirmation, setConfirmation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  // Remove the secret from the visible address bar/history as soon as the page mounts.
  React.useEffect(() => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < 12 || password !== confirmation) {
      setError('Use at least 12 characters and make sure both passwords match.');
      return;
    }
    setError(''); setBusy(true);
    try { await activatePatient(token, password); setPassword(''); setConfirmation(''); setSuccess(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to activate invitation'); }
    finally { setBusy(false); }
  };
  return <main className="ayu-signup-info" style={{ maxWidth:520,margin:'9vh auto',padding:24,fontFamily:'sans-serif' }}>
    <a href="/">← Ayu home</a>
    <h1>Activate your patient account</h1>
    {success ? <><p role="status">Your account is activated. You can now sign in.</p>
      <a className="primary-button" href="/login">Go to login</a></> :
      <form onSubmit={event => { void submit(event); }} style={{display:'grid',gap:14}}>
        <p>Set a personal password. This one-time invitation expires after 48 hours. Do not share this link.</p>
        {error && <p role="alert">{error}</p>}
        <label>Password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={password} onChange={e=>setPassword(e.target.value)} style={{display:'block',width:'100%',padding:10}}/></label>
        <label>Confirm password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128}
          value={confirmation} onChange={e=>setConfirmation(e.target.value)} style={{display:'block',width:'100%',padding:10}}/></label>
        <button type="submit" className="primary-button" disabled={busy || !token}>{busy ? 'Activating…' : 'Activate account'}</button>
      </form>}
  </main>;
}

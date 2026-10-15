import React from 'react';
import { ArrowLeft, CalendarDays, ClipboardList, HeartPulse, Leaf, LockKeyhole, ShieldCheck, Users, UtensilsCrossed } from 'lucide-react';
import { currentUser, getCsrf, logout, SessionUser } from './auth-client';
import './dashboard.css';
import './login.css';

const sections = {
  admin: [
    { title: 'Practice management', detail: 'Manage practitioner workflows when the authorized API is ready.', icon: Users },
    { title: 'Appointments', detail: 'Scheduling and calendar integration are coming next.', icon: CalendarDays },
    { title: 'Reports', detail: 'Practice reporting will use authorized, live records only.', icon: ClipboardList },
  ],
  dietitian: [
    { title: 'My patients', detail: 'Patient access will be limited to assigned records.', icon: Users },
    { title: 'Nutrition plans', detail: 'Create and review care plans when clinical endpoints are available.', icon: UtensilsCrossed },
    { title: 'Appointments', detail: 'View your authorized consultation schedule.', icon: CalendarDays },
  ],
  patient: [
    { title: 'My nutrition', detail: 'Your personalized plan will appear when available.', icon: UtensilsCrossed },
    { title: 'My appointments', detail: 'Your scheduled consultations will appear here.', icon: CalendarDays },
    { title: 'My progress', detail: 'Your private progress information will appear here.', icon: HeartPulse },
  ],
} as const;

export function DashboardPage() {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    currentUser().then(identity => {
      if (!active) return;
      if (!identity) { window.location.hash = '#login'; return; }
      setUser(identity);
    }).catch(() => { if (active) setError('Could not verify your session. Please retry.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function signOut() {
    setBusy(true); setError('');
    try {
      const csrf = await getCsrf();
      await logout(csrf);
      window.location.hash = '#login';
    } catch {
      setError('Sign out failed. Please try again.');
    } finally { setBusy(false); }
  }
  if (loading) return <main className="ayu-login-page"><p role="status">Verifying your session…</p></main>;
  if (!user) return <main className="ayu-login-page"><div className="ayu-login-card"><p role="alert">{error || 'You must sign in to access your dashboard.'}</p><a href="#login">Go to sign in</a></div></main>;
  const roleTitle = user.role === 'admin' ? 'Admin' : user.role === 'dietitian' ? 'Dietitian' : 'Patient';
  return <div className="app-preview">
    <aside className="app-sidebar">
      <a href="#home" className="app-logo"><span className="app-logo-icon"><Leaf size={20}/></span>ayu<span className="app-logo-dot">.</span></a>
      <div className="app-nav-heading">{roleTitle.toUpperCase()} WORKSPACE</div>
      <div className="app-sidebar-bottom"><ShieldCheck size={17}/><span>Authenticated session<br/><small>Role: {user.role}</small></span></div>
    </aside>
    <div className="app-content">
      <header className="app-topbar"><span className="app-breadcrumb">Ayu / {roleTitle} dashboard</span><button type="button" className="app-back" onClick={signOut} disabled={busy}><ArrowLeft size={16}/> {busy ? 'Signing out…' : 'Sign out'}</button></header>
      <main className="app-main">
        <div className="app-page-heading"><div><div className="app-eyebrow">YOUR SECURE WORKSPACE</div><h1>{roleTitle} dashboard</h1><p>Signed in as {user.email}</p></div></div>
        {error && <p role="alert" className="ayu-login-alert">{error}</p>}
        <div className="app-demo-notice"><LockKeyhole size={18}/><div><strong>Live account — no clinical records loaded</strong><span>Access is authenticated and role-specific. Patient data and operational actions will be enabled only after server-side resource authorization and API integration.</span></div></div>
        <div className="app-stats">{sections[user.role].map(({ title, detail, icon: Icon }) => <article className="app-stat" key={title}><div className="app-stat-icon"><Icon size={21}/></div><strong>{title}</strong><small>{detail}</small></article>)}</div>
      </main>
    </div>
  </div>;
}

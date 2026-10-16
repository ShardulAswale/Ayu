import React from 'react';
import { ArrowLeft, CalendarDays, ClipboardList, HeartPulse, Leaf, Menu, ShieldCheck, Users, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { currentUser, dashboardSummary, DashboardSummary, getCsrf, logout, SessionUser } from './auth-client';
import { dashboardPathForRole } from './role-routing.mjs';
import './dashboard.css';
import './login.css';

const metricIcons = {
  patients: Users, dietitians: Users, admins: ShieldCheck,
  plans: UtensilsCrossed, appointments: CalendarDays, progress: HeartPulse,
} as const;

export function DashboardPage() {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const loadSummary = React.useCallback(async (identity: SessionUser) => {
    setDataLoading(true);
    setError('');
    try {
      const result = await dashboardSummary();
      if (result.role !== identity.role) throw new Error('Dashboard role mismatch. Please sign in again.');
      setSummary(result);
    } catch (cause) {
      setSummary(null);
      setError(cause instanceof Error ? cause.message : 'Unable to load dashboard data.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    currentUser().then(async identity => {
      if (!active) return;
      if (!identity) { window.location.replace('/login'); return; }
      const canonicalPath = dashboardPathForRole(identity.role);
      if (window.location.pathname !== canonicalPath || window.location.hash) {
        window.location.replace(canonicalPath);
        return;
      }
      setUser(identity);
      setLoading(false);
      // No synthetic fixtures. All metrics are returned by the guarded API.
      await loadSummary(identity);
    }).catch(() => { if (active) { setError('Could not verify your session. Please retry.'); setLoading(false); } });
    return () => { active = false; };
  }, [loadSummary]);

  async function signOut() {
    setBusy(true); setError('');
    try {
      await logout(await getCsrf());
      window.location.replace('/login');
    } catch {
      setError('Sign out failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="ayu-login-page"><p role="status">Verifying your session…</p></main>;
  if (!user) return <main className="ayu-login-page"><div className="ayu-login-card"><p role="alert">{error || 'You must sign in to access your dashboard.'}</p><a href="/login">Go to sign in</a></div></main>;

  const roleTitle = user.role === 'admin' ? 'Admin' : user.role === 'dietitian' ? 'Dietitian' : 'Patient';

  return <div className="app-preview">
    <aside className={menuOpen ? 'app-sidebar open' : 'app-sidebar'}>
      <a href="/" className="app-logo"><span className="app-logo-icon"><Leaf size={20}/></span>ayu<span className="app-logo-dot">.</span></a>
      <div className="app-nav-heading">{roleTitle.toUpperCase()} WORKSPACE</div>
      <nav aria-label="Dashboard navigation">
        <a className="app-nav-link active" href="#overview" onClick={() => setMenuOpen(false)}>Overview</a>
        {summary?.sections.map(section => <a className="app-nav-link" key={section.key} href={'#' + section.key} onClick={() => setMenuOpen(false)}>{section.title}</a>)}
      </nav>
      <div className="app-sidebar-bottom"><ShieldCheck size={17}/><span>Signed in<br/><small>{user.email}</small></span></div>
    </aside>
    <div className="app-content">
      <header className="app-topbar">
        <button type="button" className="app-menu-toggle" aria-label="Toggle navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><Menu size={22}/></button>
        <span className="app-breadcrumb">Ayu / {roleTitle} dashboard</span>
        <button type="button" className="app-back" onClick={signOut} disabled={busy}><ArrowLeft size={16}/> {busy ? 'Signing out…' : 'Sign out'}</button>
      </header>
      <main className="app-main" id="overview">
        <div className="app-page-heading">
          <div><div className="app-eyebrow">YOUR WORKSPACE</div><h1>{roleTitle} dashboard</h1><p>Signed in as {user.email}</p></div>
          <button type="button" className="app-refresh" disabled={dataLoading} onClick={() => void loadSummary(user)}><RefreshCw size={16}/> {dataLoading ? 'Loading…' : 'Refresh'}</button>
        </div>
        {error && <div className="app-data-error" role="alert"><strong>Dashboard data unavailable</strong><p>{error}</p><button type="button" onClick={() => void loadSummary(user)}>Retry loading</button></div>}
        {dataLoading && !summary && <p role="status">Loading dashboard data…</p>}
        {summary && <>
          <div className="app-stats">
            {summary.metrics.map(metric => {
              const Icon = metricIcons[metric.key as keyof typeof metricIcons] || ClipboardList;
              return <article className="app-stat" key={metric.key}>
                <div className="app-stat-icon"><Icon size={21}/></div>
                <span>{metric.label}</span>
                <strong>{metric.count.toLocaleString()}</strong>
                <small>{metric.description}</small>
              </article>;
            })}
          </div>
          <div className="app-panels">
            {summary.sections.map(section => <section className="app-panel" id={section.key} key={section.key}>
              <div className="app-panel-title"><h2>{section.title}</h2></div>
              {section.items.length === 0
                ? <div className="app-section-empty"><ClipboardList size={24}/><strong>0 records</strong><p>{section.description}</p></div>
                : <p>{section.items.length} records available</p>}
            </section>)}
          </div>
          {user.role !== 'admin' && <p className="app-data-footnote">Counts are zero until authorized clinical and scheduling data services are connected. No sample records are displayed.</p>}
        </>}
      </main>
    </div>
  </div>;
}

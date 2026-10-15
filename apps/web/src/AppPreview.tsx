import React from 'react';
import { Activity, ArrowLeft, ArrowRight, CalendarDays, ClipboardList, HeartPulse, LayoutDashboard, Leaf, LockKeyhole, Menu, ShieldCheck, Users, UtensilsCrossed } from 'lucide-react';
import './dashboard.css';

type Role = 'dietitian' | 'patient';
type Page = 'overview' | 'patients' | 'appointments' | 'nutrition' | 'reports';
const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'nutrition', label: 'Nutrition', icon: UtensilsCrossed },
  { id: 'reports', label: 'Reports', icon: ClipboardList },
] as const;

export function AppPreview() {
  const [role, setRole] = React.useState<Role>('dietitian');
  const [page, setPage] = React.useState<Page>('overview');
  const [mobileNav, setMobileNav] = React.useState(false);
  const patientMode = role === 'patient';
  const currentNavigation = navigation.filter(item => !patientMode || ['overview', 'appointments', 'nutrition'].includes(item.id));
  const cards = patientMode
    ? [{ label: 'Meal entries', value: '3', note: 'Sample entries today', icon: UtensilsCrossed }, { label: 'Upcoming visits', value: '1', note: 'Sample appointment', icon: CalendarDays }, { label: 'Weekly check-ins', value: '5 / 7', note: 'Illustrative activity', icon: Activity }]
    : [{ label: 'Active patients', value: '24', note: 'Synthetic records', icon: Users }, { label: 'Appointments', value: '6', note: 'Illustrative schedule', icon: CalendarDays }, { label: 'Meal reviews', value: '12', note: 'Sample review queue', icon: ClipboardList }];

  return <div className="app-preview">
    <aside className={mobileNav ? 'app-sidebar open' : 'app-sidebar'}>
      <a href="#home" className="app-logo"><span className="app-logo-icon"><Leaf size={20}/></span> ayu<span className="app-logo-dot">.</span></a>
      <div className="app-nav-heading">WORKSPACE PREVIEW</div>
      <nav aria-label="Preview navigation">{currentNavigation.map(({ id, label, icon: Icon }) =>
        <button key={id} type="button" className={page === id ? 'app-nav-link active' : 'app-nav-link'} onClick={() => { setPage(id); setMobileNav(false); }}><Icon size={18}/>{label}</button>)}</nav>
      <div className="app-sidebar-bottom"><ShieldCheck size={17}/><span>Synthetic data only<br/><small>Not connected to patient records</small></span></div>
    </aside>
    <div className="app-content">
      <header className="app-topbar"><button className="app-menu-toggle" type="button" onClick={() => setMobileNav(v => !v)} aria-label="Toggle workspace navigation"><Menu size={22}/></button><span className="app-breadcrumb">Ayu / {navigation.find(item => item.id === page)?.label}</span><a href="#home" className="app-back"><ArrowLeft size={16}/> Back to website</a></header>
      <main className="app-main">
        <div className="app-demo-notice"><LockKeyhole size={18}/><div><strong>Interface preview — not a live account</strong><span>Authentication and API integration are not yet enabled. All displayed information is synthetic.</span></div></div>
        <div className="app-page-heading"><div><div className="app-eyebrow">AYU / DEVELOPMENT WORKSPACE</div><h1>{page === 'overview' ? (patientMode ? 'Your nutrition overview' : 'Practice overview') : navigation.find(item => item.id === page)?.label}</h1><p>{page === 'overview' ? 'A clearer view of care, designed around everyday decisions.' : 'This workspace module is being prepared for secure API integration.'}</p></div><label className="app-role-switch">Preview as<select aria-label="Preview role" value={role} onChange={e => { setRole(e.target.value as Role); setPage('overview'); }}><option value="dietitian">Dietitian</option><option value="patient">Patient</option></select></label></div>
        {page === 'overview' ? <>
          <div className="app-stats">{cards.map(({ label, value, note, icon: Icon }) => <article className="app-stat" key={label}><div className="app-stat-icon"><Icon size={21}/></div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
          <div className="app-panels"><section className="app-panel"><div className="app-panel-title"><div><span className="app-eyebrow">TODAY'S FOCUS</span><h2>{patientMode ? 'Daily nourishment' : 'Care priorities'}</h2></div><HeartPulse size={22}/></div><div className="app-task"><span className="app-task-dot"/><div><strong>{patientMode ? 'Review your meal plan' : 'Review sample meal logs'}</strong><small>{patientMode ? 'Your plan will appear here once connected.' : '12 illustrative reviews are awaiting assessment.'}</small></div><ArrowRight size={17}/></div><div className="app-task"><span className="app-task-dot"/><div><strong>{patientMode ? 'Track your daily habits' : 'Prepare for upcoming consultations'}</strong><small>Designed for a more connected nutrition journey.</small></div><ArrowRight size={17}/></div></section><section className="app-panel app-panel-muted"><div className="app-panel-title"><div><span className="app-eyebrow">UP NEXT</span><h2>Building with care</h2></div><ShieldCheck size={22}/></div><p>Secure sign-in, patient-level authorization and practitioner-reviewed care workflows are the next implementation steps.</p><div className="app-roadmap"><span>Application shell</span><strong>Ready for review</strong></div><div className="app-roadmap"><span>Authentication API</span><strong>Planned</strong></div><div className="app-roadmap"><span>MFA support</span><strong>Future phase</strong></div></section></div>
        </> : <section className="app-panel app-empty"><div className="app-empty-icon"><ClipboardList size={29}/></div><h2>{navigation.find(item => item.id === page)?.label} workspace</h2><p>This screen is a navigation placeholder. No patient information is stored or fetched. Functionality will be enabled after secure backend integration.</p><button type="button" onClick={() => setPage('overview')}>Return to overview <ArrowRight size={16}/></button></section>}
      </main>
    </div>
  </div>;
}

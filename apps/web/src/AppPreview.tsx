import React from 'react';
import { Activity, ArrowLeft, ArrowRight, CalendarDays, ClipboardList, HeartPulse, LayoutDashboard, Leaf, LockKeyhole, Menu, Search, ShieldCheck, Users, UtensilsCrossed } from 'lucide-react';
import './dashboard.css';
import './dashboard-pages.css';

type Role = 'dietitian' | 'patient';
type Page = 'overview' | 'patients' | 'appointments' | 'nutrition' | 'reports';
const nav = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: CalendarDays },
  { id: 'nutrition', label: 'Nutrition', icon: UtensilsCrossed },
  { id: 'reports', label: 'Reports', icon: ClipboardList },
] as const;
const patients = [
  { id: 'AYU-101', name: 'Sample Patient A', goal: 'Balanced nutrition', status: 'On track', next: 'Oct 19' },
  { id: 'AYU-102', name: 'Sample Patient B', goal: 'Meal consistency', status: 'Review due', next: 'Oct 20' },
  { id: 'AYU-103', name: 'Sample Patient C', goal: 'Heart-healthy habits', status: 'On track', next: 'Oct 22' },
  { id: 'AYU-104', name: 'Sample Patient D', goal: 'Healthy routines', status: 'New', next: 'Oct 24' },
];
const appointments = [
  { time: '09:30', title: 'Initial nutrition consultation', person: 'Sample Patient D', type: 'Video' },
  { time: '11:00', title: 'Progress review', person: 'Sample Patient B', type: 'In person' },
  { time: '14:15', title: 'Meal plan follow-up', person: 'Sample Patient A', type: 'Video' },
];
const meals = [
  { time: '08:00', name: 'Breakfast', detail: 'Oats, yogurt and berries', state: 'Logged' },
  { time: '12:30', name: 'Lunch', detail: 'Lentils, rice and vegetables', state: 'Logged' },
  { time: '16:00', name: 'Snack', detail: 'Fruit and nuts', state: 'Planned' },
  { time: '19:30', name: 'Dinner', detail: 'Whole grains and mixed vegetables', state: 'Planned' },
];
const summary = (role: Role) => role === 'dietitian'
  ? [{ label: 'Active patients', value: '24', note: 'Sample caseload', icon: Users }, { label: 'Appointments today', value: '6', note: 'Illustrative schedule', icon: CalendarDays }, { label: 'Plans to review', value: '12', note: 'Sample review queue', icon: ClipboardList }]
  : [{ label: 'Meals logged', value: '2 / 4', note: 'Sample daily log', icon: UtensilsCrossed }, { label: 'Next appointment', value: 'Oct 19', note: 'Illustrative booking', icon: CalendarDays }, { label: 'Weekly check-ins', value: '5 / 7', note: 'Sample activity', icon: Activity }];

function Panel({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="app-panel"><div className="app-panel-title"><div><span className="app-eyebrow">{eyebrow}</span><h2>{title}</h2></div></div>{children}</section>;
}
export function AppPreview() {
  const [role, setRole] = React.useState<Role>('dietitian');
  const [page, setPage] = React.useState<Page>('overview');
  const [mobileNav, setMobileNav] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const patientMode = role === 'patient';
  const available = nav.filter(item => !patientMode || ['overview', 'appointments', 'nutrition', 'reports'].includes(item.id));
  const filtered = patients.filter(p => [p.name, p.id, p.goal].some(v => v.toLowerCase().includes(query.trim().toLowerCase())));
  const go = (next: Page) => { setPage(next); setMobileNav(false); };
  const patientCard = <Panel title="Your nutrition plan" eyebrow="PERSONAL PLAN"><div className="ayu-plan"><div><strong>Balanced everyday meals</strong><p>Illustrative plan with regular meals, varied vegetables, whole grains and hydration.</p></div><span className="ayu-chip">Sample plan</span></div><div className="ayu-progress-label"><span>Weekly meal check-ins</span><strong>5 of 7</strong></div><div className="ayu-progress"><span style={{ width: '71%' }}/></div></Panel>;
  return <div className="app-preview">
    <aside className={mobileNav ? 'app-sidebar open' : 'app-sidebar'}>
      <a href="#home" className="app-logo"><span className="app-logo-icon"><Leaf size={20}/></span>ayu<span className="app-logo-dot">.</span></a>
      <div className="app-nav-heading">{patientMode ? 'PATIENT PREVIEW' : 'PRACTICE PREVIEW'}</div>
      <nav aria-label="Dashboard navigation">{available.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={page === id ? 'app-nav-link active' : 'app-nav-link'} onClick={() => go(id)}><Icon size={18}/>{patientMode && id === 'reports' ? 'Progress' : patientMode && id === 'nutrition' ? 'My meals' : label}</button>)}</nav>
      <div className="app-sidebar-bottom"><ShieldCheck size={17}/><span>Demonstration only<br/><small>No real patient records</small></span></div>
    </aside>
    <div className="app-content">
      <header className="app-topbar"><button className="app-menu-toggle" type="button" onClick={() => setMobileNav(v => !v)} aria-label="Toggle navigation"><Menu size={22}/></button><span className="app-breadcrumb">Ayu / {available.find(n => n.id === page)?.label}</span><a href="#home" className="app-back"><ArrowLeft size={16}/> Back to website</a></header>
      <main className="app-main">
        <div className="app-demo-notice"><LockKeyhole size={18}/><div><strong>Interactive UI preview — not a live account</strong><span>All names, schedules and metrics are fictional. No changes are saved; authentication and API connections are not enabled.</span></div></div>
        <div className="app-page-heading"><div><div className="app-eyebrow">AYU / {patientMode ? 'PERSONAL WELLNESS' : 'PRACTICE MANAGEMENT'}</div><h1>{page === 'overview' ? patientMode ? 'Your daily overview' : 'Practice overview' : patientMode && page === 'reports' ? 'My progress' : patientMode && page === 'nutrition' ? 'My meals' : available.find(n => n.id === page)?.label}</h1><p>{page === 'overview' ? 'Thoughtful nutrition care, organized in one place.' : 'Explore how this part of Ayu will work.'}</p></div><label className="app-role-switch">View as<select aria-label="Dashboard preview role" value={role} onChange={e => { setRole(e.target.value as Role); setPage('overview'); setQuery(''); }}><option value="dietitian">Admin / Dietitian</option><option value="patient">Patient</option></select></label></div>
        {page === 'overview' && <>
          <div className="app-stats">{summary(role).map(({ label, value, note, icon: Icon }) => <article className="app-stat" key={label}><div className="app-stat-icon"><Icon size={21}/></div><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
          <div className="app-panels">
            {patientMode ? patientCard : <Panel title="Upcoming consultations" eyebrow="TODAY'S SCHEDULE">{appointments.map(a => <div className="ayu-list-row" key={a.time}><span className="ayu-time">{a.time}</span><div><strong>{a.title}</strong><small>{a.person} · {a.type}</small></div></div>)}<button className="ayu-text-button" onClick={() => go('appointments')}>View appointments <ArrowRight size={16}/></button></Panel>}
            <Panel title={patientMode ? 'Today’s meals' : 'Care priorities'} eyebrow={patientMode ? 'MEAL JOURNAL' : 'NEXT ACTIONS'}>{patientMode ? meals.slice(0,3).map(m => <div className="ayu-list-row" key={m.name}><span className="ayu-time">{m.time}</span><div><strong>{m.name}</strong><small>{m.detail}</small></div><span className="ayu-chip">{m.state}</span></div>) : <><div className="ayu-list-row"><HeartPulse size={20}/><div><strong>Review sample meal journals</strong><small>12 entries waiting for review</small></div></div><div className="ayu-list-row"><ClipboardList size={20}/><div><strong>Prepare upcoming diet plans</strong><small>4 illustrative follow-ups</small></div></div></>}<button className="ayu-text-button" onClick={() => go('nutrition')}>{patientMode ? 'Open meal journal' : 'Open nutrition plans'} <ArrowRight size={16}/></button></Panel>
          </div>
        </>}
        {page === 'patients' && !patientMode && <Panel title="Patient directory" eyebrow="SYNTHETIC RECORDS"><label className="ayu-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search sample patients" aria-label="Search sample patients"/></label><div className="ayu-table-wrap"><table className="ayu-table"><thead><tr><th>Patient</th><th>Care goal</th><th>Status</th><th>Next visit</th></tr></thead><tbody>{filtered.map(p => <tr key={p.id}><td><strong>{p.name}</strong><small>{p.id}</small></td><td>{p.goal}</td><td><span className="ayu-chip">{p.status}</span></td><td>{p.next}</td></tr>)}</tbody></table></div>{filtered.length === 0 && <p className="ayu-empty-text">No sample patients match your search.</p>}</Panel>}
        {page === 'appointments' && <Panel title={patientMode ? 'Your upcoming appointments' : 'Consultation schedule'} eyebrow="SAMPLE SCHEDULE">{(patientMode ? appointments.slice(0,1) : appointments).map(a => <div className="ayu-list-row" key={a.time}><div className="ayu-date"><CalendarDays size={18}/><strong>{a.time}</strong></div><div><strong>{a.title}</strong><small>{patientMode ? 'Oct 19 · ' + a.type : a.person + ' · ' + a.type}</small></div><span className="ayu-chip">Scheduled</span></div>)}<p className="ayu-footnote">Booking and cancellation will be available after API integration.</p></Panel>}
        {page === 'nutrition' && (patientMode ? <div className="ayu-stack">{patientCard}<Panel title="Daily meal journal" eyebrow="ILLUSTRATIVE ENTRIES">{meals.map(m => <div className="ayu-list-row" key={m.name}><span className="ayu-time">{m.time}</span><div><strong>{m.name}</strong><small>{m.detail}</small></div><span className="ayu-chip">{m.state}</span></div>)}</Panel></div> : <Panel title="Diet plans and meal reviews" eyebrow="CARE WORKFLOW">{patients.map((p,i) => <div className="ayu-list-row" key={p.id}><UtensilsCrossed size={20}/><div><strong>{p.name}</strong><small>{p.goal}</small></div><span className="ayu-chip">{i % 2 ? 'Review due' : 'Plan active'}</span></div>)}<p className="ayu-footnote">Plan editing and approvals require authenticated practitioner access.</p></Panel>)}
        {page === 'reports' && <div className="ayu-stack"><Panel title={patientMode ? 'Your weekly consistency' : 'Practice activity'} eyebrow="ILLUSTRATIVE INSIGHTS">{(patientMode ? [{ name: 'Meal check-ins', value: 71 }, { name: 'Hydration check-ins', value: 86 }, { name: 'Movement check-ins', value: 57 }] : [{ name: 'Follow-ups completed', value: 78 }, { name: 'Meal reviews processed', value: 64 }, { name: 'Appointments attended', value: 91 }]).map(m => <div className="ayu-report-row" key={m.name}><div className="ayu-progress-label"><span>{m.name}</span><strong>{m.value}%</strong></div><div className="ayu-progress"><span style={{ width: m.value + '%' }}/></div></div>)}</Panel><p className="ayu-footnote">These figures are illustrative, not clinical measurements or patient outcomes.</p></div>}
      </main>
    </div>
  </div>;
}

import React from 'react';
import {
  Activity, ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChartNoAxesCombined,
  Check, ChevronLeft, ChevronRight, ClipboardList, Clock3, GripVertical, HeartPulse,
  LayoutDashboard, Leaf, Menu, MessageCircle, Plus, RefreshCw, Search,
  Settings, ShieldCheck, Trash2, Users, UtensilsCrossed, X,
} from 'lucide-react';
import { currentUser, getCsrf, logout, SessionExpiredError, SessionUser } from './auth-client';
import {
  Appointment, FoodEntry, PatientRef, PlanEntry, ProgressEntry, Recipe,
  WorkspaceStats, workspaceApi,
} from './workspace-client';
import { dashboardPathForRole } from './role-routing.mjs';
import { FoodCatalogueSection } from './FoodCatalogueSection';
import { formatRecipeIngredients, displayText } from './recipe-format.mjs';
import './workspace.css';

type DashboardRole = SessionUser['role'];
type Nav = { id: string; label: string; icon: typeof LayoutDashboard };
const patientNav: Nav[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'food-diary', label: 'Food diary', icon: UtensilsCrossed },
  { id: 'my-diet-plan', label: 'My diet plan', icon: CalendarDays },
  { id: 'nutrition-insights', label: 'Nutrition insights', icon: ChartNoAxesCombined },
  { id: 'progress', label: 'Progress', icon: Activity },
  { id: 'appointments', label: 'Appointments', icon: Clock3 },
  { id: 'recipes', label: 'My recipes', icon: BookOpen },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const staffNav: Nav[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'patients', label: 'Patients', icon: Users },
  { id: 'patient-overview', label: 'Patient overview', icon: HeartPulse },
  { id: 'diet-plan-builder', label: 'Diet plan builder', icon: CalendarDays },
  { id: 'recipes', label: 'Food & recipes', icon: UtensilsCrossed },
  { id: 'appointments', label: 'Appointments', icon: Clock3 },
  { id: 'reports', label: 'Reports', icon: ClipboardList },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const allWidgets = [
  { id: 'patients', label: 'Total patients', caption: 'Authorized patient accounts', icon: Users },
  { id: 'meetings', label: "Today's meetings", caption: 'Scheduled consultations', icon: CalendarDays },
  { id: 'reviews', label: 'Pending reviews', caption: 'No review workflow connected', icon: ClipboardList },
  { id: 'plans', label: 'Active diet plans', caption: 'Published recommendations', icon: UtensilsCrossed },
  { id: 'activity', label: 'Patient activity', caption: 'Activity analytics coming later', icon: Activity },
  { id: 'appointments', label: 'Consultations', caption: 'Meetings today', icon: Clock3 },
  { id: 'dietitians', label: 'Dietitians', caption: 'Active practitioners', icon: Users },
];
const defaultWidgets = allWidgets.map(item => item.id);
const localDate = (date: Date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
};
const localDateTime = (date: Date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const fmt = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleString(undefined, options || { dateStyle: 'medium', timeStyle: 'short' });
const dayKey = (value: string) => localDate(new Date(value));
const int = (value?: number) => Number(value || 0).toLocaleString();
const queryPatient = (role: DashboardRole, selected: string) =>
  role === 'patient' ? '' : '?patientId=' + encodeURIComponent(selected);

function Empty({ title, description, icon: Icon = ClipboardList }: {
  title: string; description: string; icon?: typeof ClipboardList;
}) {
  return <div className="ws-empty"><Icon size={26} aria-hidden="true"/><strong>{title}</strong><p>{description}</p></div>;
}
function Metric({ name, value, note, icon: Icon }: {
  name: string; value: string; note: string; icon: typeof LayoutDashboard;
}) {
  return <article className="ws-metric"><div className="ws-metric-icon"><Icon size={19}/></div>
    <span>{name}</span><strong>{value}</strong><small>{note}</small></article>;
}
function dateSpan(date: string, view: 'day' | 'week' | 'month') {
  const anchor = new Date(date + 'T12:00:00');
  if (view === 'day') return [date];
  const start = new Date(anchor);
  if (view === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  else start.setDate(1);
  const size = view === 'week' ? 7 : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return Array.from({ length: size }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return localDate(d);
  });
}

export function DashboardPage() {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [failedSections, setFailedSections] = React.useState<string[]>([]);
  const [notice, setNotice] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [view, setView] = React.useState(window.location.hash.slice(1) || 'home');
  const [selectedPatient, setSelectedPatient] = React.useState('');
  const [selectedTab, setSelectedTab] = React.useState('Overview');
  const [stats, setStats] = React.useState<WorkspaceStats | null>(null);
  const [patients, setPatients] = React.useState<PatientRef[]>([]);
  const [dietitians, setDietitians] = React.useState<PatientRef[]>([]);
  const [recipes, setRecipes] = React.useState<Recipe[]>([]);
  const [entries, setEntries] = React.useState<FoodEntry[]>([]);
  const [plans, setPlans] = React.useState<PlanEntry[]>([]);
  const [appointments, setAppointments] = React.useState<Appointment[]>([]);
  const [progress, setProgress] = React.useState<ProgressEntry[]>([]);
  const [widgets, setWidgets] = React.useState<string[]>(defaultWidgets);
  const [editingWidgets, setEditingWidgets] = React.useState(false);
  const [recipeSearch, setRecipeSearch] = React.useState('');
  const [libraryTab, setLibraryTab] = React.useState<'foods' | 'recipes'>('foods');
  const [recipeEditing, setRecipeEditing] = React.useState('');
  const [mealEditing, setMealEditing] = React.useState('');
  const [planEditing, setPlanEditing] = React.useState('');
  const [calendarView, setCalendarView] = React.useState<'day' | 'week' | 'month'>('week');
  const [calendarDate, setCalendarDate] = React.useState(localDate(new Date()));
  const [formOpen, setFormOpen] = React.useState(false);
  const [meal, setMeal] = React.useState({
    foodName: '', eatenAt: localDateTime(new Date()), quantity: '1',
    unit: 'serving', recipeId: '', notes: '',
  });
  const [recipeForm, setRecipeForm] = React.useState({
    name: '', ingredients: '', instructions: '', calories: '0', protein: '0', carbs: '0',
    fat: '0', fiber: '0', allergens: '', source: '',
  });
  const [planForm, setPlanForm] = React.useState({
    title: '', plannedAt: localDateTime(new Date()), notes: '', status: 'draft', recipeId: '',
  });
  const [visitForm, setVisitForm] = React.useState({
    title: '', startsAt: localDateTime(new Date()), durationMinutes: '30', dietitianId: '',
  });
  const [progressForm, setProgressForm] = React.useState({
    metric: 'Weight', value: '', unit: 'kg', measuredAt: localDateTime(new Date()),
  });
  const [assignDietitian, setAssignDietitian] = React.useState('');

  React.useEffect(() => {
    const handler = () => setView(window.location.hash.slice(1) || 'home');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  React.useEffect(() => {
    let active = true;
    currentUser().then(identity => {
      if (!active) return;
      if (!identity) { window.location.replace('/login'); return; }
      const canonical = dashboardPathForRole(identity.role);
      if (window.location.pathname !== canonical || window.location.hash === '#dashboard') {
        window.location.replace(canonical); return;
      }
      setUser(identity);
    }).catch(() => { if (active) setError('Could not verify the session.'); })
      .finally(() => { if (active) setAuthLoading(false); });
    return () => { active = false; };
  }, []);

  const reload = React.useCallback(async (identity: SessionUser, patientSelection: string) => {
    setLoading(true); setError('');
    const role = identity.role;
    const isPatient = role === 'patient';
    const hasPatientScope = isPatient || Boolean(patientSelection);
    const param = queryPatient(role, patientSelection);
    const start = new Date(); start.setDate(start.getDate() - 180);
    const end = new Date(); end.setDate(end.getDate() + 180);
    const range = '&from=' + encodeURIComponent(start.toISOString()) + '&to=' + encodeURIComponent(end.toISOString());
    try {
      const keys = ['stats', 'recipes', 'appointments', 'patients', 'dietitians', 'layout', 'entries', 'plans', 'progress'] as const;
      const results = await Promise.allSettled([
        workspaceApi<WorkspaceStats>('stats?offset=' + new Date().getTimezoneOffset()),
        workspaceApi<Recipe[]>('recipes'),
        workspaceApi<Appointment[]>('appointments' + (hasPatientScope ? param : '')),
        isPatient ? Promise.resolve([] as PatientRef[]) : workspaceApi<PatientRef[]>('patients'),
        role === 'admin' ? workspaceApi<PatientRef[]>('dietitians') : Promise.resolve([] as PatientRef[]),
        isPatient ? Promise.resolve({ widgets: defaultWidgets }) : workspaceApi<{widgets: string[]}>('layout'),
        hasPatientScope ? workspaceApi<FoodEntry[]>('entries' + (param || '?') + (param ? range : range.slice(1))) : Promise.resolve([] as FoodEntry[]),
        hasPatientScope ? workspaceApi<PlanEntry[]>('plans' + (param || '?') + (param ? range : range.slice(1))) : Promise.resolve([] as PlanEntry[]),
        hasPatientScope ? workspaceApi<ProgressEntry[]>('progress' + param) : Promise.resolve([] as ProgressEntry[]),
      ]);
      // A 401 must invalidate the complete dashboard, not expose partial patient data.
      if (results.some(item => item.status === 'rejected' && item.reason instanceof SessionExpiredError)) {
        setStats(null); setUser(null);
        window.location.replace('/login');
        return;
      }
      const failed = results.flatMap((item, index) => item.status === 'rejected' ? [keys[index]] : []);
      const read = <T,>(index: number, fallback: T): T => {
        const item = results[index];
        return item.status === 'fulfilled' ? item.value as T : fallback;
      };
      setStats(read<WorkspaceStats | null>(0, null));
      setRecipes(read<Recipe[]>(1, []));
      setAppointments(read<Appointment[]>(2, []));
      setPatients(read<PatientRef[]>(3, []));
      setDietitians(read<PatientRef[]>(4, []));
      setWidgets(read<{ widgets: string[] }>(5, {widgets: defaultWidgets}).widgets);
      setEntries(read<FoodEntry[]>(6, []));
      setPlans(read<PlanEntry[]>(7, []));
      setProgress(read<ProgressEntry[]>(8, []));
      setFailedSections(failed);
      if (failed.length) setError('Unable to load: ' + failed.join(', ') + '. Other sections remain available.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Data is unavailable. Retry to reconnect.');
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (user) void reload(user, selectedPatient);
  }, [user, selectedPatient, reload]);

  const mutate = async (message: string, operation: () => Promise<unknown>) => {
    if (!user) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await operation();
      await reload(user, selectedPatient);
      setNotice(message);
      setFormOpen(false);
    } catch (cause) {
      if (cause instanceof SessionExpiredError) { window.location.replace('/login'); return; }
      setError(cause instanceof Error ? cause.message : 'Could not save changes.');
    } finally { setBusy(false); }
  };
  const navigate = (next: string) => {
    setMenuOpen(false); setFormOpen(false); setError(''); setNotice('');
    window.location.hash = next === 'home' ? '' : next;
    setView(next);
  };
  const logoutNow = async () => {
    setBusy(true);
    try { await logout(await getCsrf()); window.location.replace('/login'); }
    catch { setError('Sign out failed. Please try again.'); setBusy(false); }
  };

  if (authLoading) return <main className="ayu-login-page"><p role="status">Verifying session…</p></main>;
  if (!user) return <main className="ayu-login-page"><div className="ayu-login-card">
    <p role="alert">{error || 'Please sign in.'}</p><a href="/login">Go to login</a>
  </div></main>;

  const role = user.role;
  const isPatient = role === 'patient';
  const nav = isPatient ? patientNav : staffNav;
  const validView = nav.some(item => item.id === view) ? view : 'home';
  const title = nav.find(item => item.id === validView)?.label || 'Home';
  const isStaff = !isPatient;
  const activePatient = patients.find(p => p.id === selectedPatient);
  const myVisits = appointments.filter(a => new Date(a.startsAt).getTime() >= Date.now());
  const calendarDays = dateSpan(calendarDate, calendarView);
  const scopedPatient = isPatient || Boolean(selectedPatient);
  const selectedPatientName = activePatient?.email || 'Select a patient';
  const formattedDay = new Date(calendarDate + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'long' });

  const choosePatient = <label className="ws-select-inline">Patient
    <select aria-label="Select patient" value={selectedPatient} onChange={event => setSelectedPatient(event.target.value)}>
      <option value="">Select patient</option>
      {patients.map(person => <option value={person.id} key={person.id}>{person.email}</option>)}
    </select>
  </label>;

  const pageHeading = (eyebrow: string, heading: string, subtitle: string, action?: React.ReactNode) =>
    <div className="ws-page-heading"><div><div className="ws-eyebrow">{eyebrow}</div>
      <h1>{heading}</h1><p>{subtitle}</p></div>{action && <div className="ws-page-action">{action}</div>}</div>;

  const renderMetrics = (items: { id: string; label: string; caption: string; icon: typeof LayoutDashboard }[]) =>
    <div className="ws-metrics">{items.map(item =>
      <Metric key={item.id} name={item.label} value={int(stats?.values[item.id])}
        note={item.caption} icon={item.icon}/>)}</div>;

  const foodDiary = (staffMode: boolean) => <div className="ws-stack">
    {pageHeading('Time-ordered food log', staffMode ? "Patient's food diary" : 'Every bite, when it happens',
      staffMode ? 'View the selected patient’s entries in chronological order.' :
      'Log whenever you eat. No fixed breakfast, lunch or dinner slots.',
      !staffMode && <button className="ws-primary" onClick={() => { setMealEditing(''); setMeal({
        foodName: '', eatenAt: localDateTime(new Date()), quantity: '1', unit: 'serving', recipeId: '', notes: '',
      }); setFormOpen(!formOpen); }}><Plus size={16}/> Add food</button>)}
    {!staffMode && formOpen && <form className="ws-card ws-form" onSubmit={event => {
      event.preventDefault();
      void mutate(mealEditing ? 'Food entry updated.' : 'Food entry saved.', () => workspaceApi(mealEditing ? 'entries/' + mealEditing : 'entries', mealEditing ? 'PATCH' : 'POST', {
        foodName: meal.foodName.trim(), eatenAt: new Date(meal.eatenAt).toISOString(),
        quantity: Number(meal.quantity), unit: meal.recipeId ? 'serving' : meal.unit,
        ...(meal.recipeId ? { recipeId: meal.recipeId } : {}), notes: meal.notes,
      }));
    }}>
      <h2>{mealEditing ? 'Edit food entry' : 'Add food entry'}</h2><p>Record the time you actually ate. Category labels are optional.</p>
      <div className="ws-form-grid">
        <label>Food name<input required maxLength={160} value={meal.foodName} onChange={e => setMeal({ ...meal, foodName: e.target.value })}/></label>
        <label>Date & time<input required type="datetime-local" value={meal.eatenAt} onChange={e => setMeal({ ...meal, eatenAt: e.target.value })}/></label>
        <label>Quantity<input required type="number" min="0.01" max="100000" step="any" value={meal.quantity} onChange={e => setMeal({ ...meal, quantity: e.target.value })}/></label>
        <label>Unit<input required maxLength={36} disabled={Boolean(meal.recipeId)} value={meal.recipeId ? 'serving' : meal.unit} onChange={e => setMeal({ ...meal, unit: e.target.value })}/></label>
        <label className="ws-wide">Recipe (optional — supplies known nutrients)
          <select value={meal.recipeId} onChange={e => {
            const recipe = recipes.find(r => r.id === e.target.value);
            setMeal({ ...meal, recipeId: e.target.value, foodName: recipe?.name || meal.foodName });
          }}><option value="">Manual food entry (nutrients not calculated)</option>
            {recipes.map(recipe => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}</select>
        </label>
        <label className="ws-wide">Notes<textarea maxLength={1000} value={meal.notes} onChange={e => setMeal({ ...meal, notes: e.target.value })}/></label>
      </div>
      <div className="ws-form-actions"><button className="ws-primary" disabled={busy}>{mealEditing ? "Update entry" : "Save entry"}</button>
        <button type="button" className="ws-secondary" onClick={() => setFormOpen(false)}>Cancel</button></div>
    </form>}
    <div className="ws-card">
      <div className="ws-section-title"><h2>Food timeline</h2><span>{entries.length} entries</span></div>
      {entries.length === 0 ? <Empty title="0 food entries" description="Food entries appear here with their actual timestamp, portions, and nutrients." icon={Clock3}/> :
        <div className="ws-list">{entries.map(entry => <article className="ws-list-row" key={entry.id}>
          <div className="ws-time"><Clock3 size={15}/>{fmt(entry.eatenAt)}</div>
          <div className="ws-list-text"><strong>{entry.foodName}</strong>
            <span>{entry.quantity} {entry.unit} · {entry.recipeId
              ? int(entry.nutrition?.calories) + ' kcal per entry' : 'Nutrients not calculated'}</span>
            {entry.notes && <small>{entry.notes}</small>}</div>
          {!staffMode && <button type="button" className="ws-secondary" onClick={() => {
            setMealEditing(entry.id);
            setMeal({
              foodName:entry.foodName, eatenAt:localDateTime(new Date(entry.eatenAt)),
              quantity:String(entry.quantity), unit:entry.unit, recipeId:entry.recipeId || '', notes:entry.notes || '',
            });
            setFormOpen(true);
          }}>Edit</button>}
          {!staffMode && <button type="button" className="ws-icon-button" aria-label={'Delete ' + entry.foodName}
            onClick={() => { if (window.confirm('Delete this entry?')) void mutate('Entry deleted.', () => workspaceApi('entries/' + entry.id, 'DELETE')); }}><Trash2 size={16}/></button>}
        </article>)}</div>}
    </div>
  </div>;

  const dietPlan = (staffMode: boolean) => <div className="ws-stack">
    {pageHeading(staffMode ? 'Plan studio' : 'Your nutrition recommendations',
      staffMode ? 'Diet plan builder' : 'My diet plan',
      staffMode ? 'Create and publish meal recommendations on a flexible calendar.' :
        'Read your dietitian’s published recommendations by day, week or month.',
      staffMode && scopedPatient && <button className="ws-primary" onClick={() => {
        setPlanEditing(''); setPlanForm({ title:'',plannedAt:localDateTime(new Date()),notes:'',status:'draft',recipeId:'' });
        setFormOpen(!formOpen);
      }}><Plus size={16}/> Add recommendation</button>)}
    {staffMode && !scopedPatient && <div className="ws-card">{choosePatient}<Empty title="No patient selected" description="Choose an assigned patient before editing their diet plan."/></div>}
    {staffMode && scopedPatient && formOpen && <form className="ws-card ws-form" onSubmit={event => {
      event.preventDefault();
      void mutate(planEditing ? 'Recommendation updated.' : 'Recommendation saved.',
        () => workspaceApi(planEditing ? 'plans/' + planEditing : 'plans', planEditing ? 'PATCH' : 'POST', {
          ...(planEditing ? {} : {patientId: selectedPatient}),
          title: planForm.title, plannedAt: new Date(planForm.plannedAt).toISOString(),
          notes: planForm.notes, status: planForm.status,
          ...(!planEditing && planForm.recipeId ? { recipeId: planForm.recipeId } : {}),
        }));
    }}>
      <h2>{planEditing ? 'Edit recommendation' : 'New recommendation'} for {selectedPatientName}</h2>
      <div className="ws-form-grid">
        <label>Recommended food<input required maxLength={160} value={planForm.title} onChange={e => setPlanForm({ ...planForm, title: e.target.value })}/></label>
        <label>Recommended date & time<input type="datetime-local" required value={planForm.plannedAt} onChange={e => setPlanForm({ ...planForm, plannedAt: e.target.value })}/></label>
        <label>Related recipe<select disabled={Boolean(planEditing)} value={planForm.recipeId} onChange={e => setPlanForm({ ...planForm, recipeId: e.target.value, title: recipes.find(r => r.id === e.target.value)?.name || planForm.title })}>
          <option value="">None</option>{recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label>Visibility<select value={planForm.status} onChange={e => setPlanForm({ ...planForm, status: e.target.value })}>
          <option value="draft">Draft (practitioners only)</option><option value="published">Publish to patient</option></select></label>
        <label className="ws-wide">Guidance<textarea maxLength={1000} value={planForm.notes} onChange={e => setPlanForm({ ...planForm, notes: e.target.value })}/></label>
      </div><div className="ws-form-actions"><button disabled={busy} className="ws-primary">{planEditing ? 'Update recommendation' : 'Save recommendation'}</button>
        <button className="ws-secondary" type="button" onClick={() => setFormOpen(false)}>Cancel</button></div>
    </form>}
    {scopedPatient && <>
      <div className="ws-calendar-tools">
        <div className="ws-segment">{(['day','week','month'] as const).map(period =>
          <button type="button" className={calendarView === period ? 'active' : ''} key={period} onClick={() => setCalendarView(period)}>{period}</button>)}</div>
        <div className="ws-date-nav">
          <button aria-label="Previous period" onClick={() => { const d = new Date(calendarDate + 'T12:00:00'); calendarView === 'month' ? d.setMonth(d.getMonth() - 1) : d.setDate(d.getDate() - (calendarView === 'week' ? 7 : 1)); setCalendarDate(localDate(d)); }}><ChevronLeft size={16}/></button>
          <input aria-label="Plan date" type="date" value={calendarDate} onChange={e => setCalendarDate(e.target.value)}/>
          <button aria-label="Next period" onClick={() => { const d = new Date(calendarDate + 'T12:00:00'); calendarView === 'month' ? d.setMonth(d.getMonth() + 1) : d.setDate(d.getDate() + (calendarView === 'week' ? 7 : 1)); setCalendarDate(localDate(d)); }}><ChevronRight size={16}/></button>
        </div>
      </div>
      <div className="ws-card">
        <div className="ws-section-title"><h2>{calendarView === 'month' ? 'Monthly' : calendarView === 'week' ? 'Weekly' : 'Daily'} recommendations</h2>
          <span>{plans.length} recorded · {formattedDay}</span></div>
        <div className={'ws-calendar-grid ' + (calendarView === 'month' ? 'month' : '')}>
          {calendarDays.map(date => {
            const dayPlans = plans.filter(item => dayKey(item.plannedAt) === date);
            return <div className="ws-day" key={date}><strong>{new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</strong>
              <small>{dayPlans.length} {dayPlans.length === 1 ? 'item' : 'items'}</small>
              {dayPlans.length === 0 ? <p className="ws-day-empty">No meals planned</p> : dayPlans.map(item =>
                <div key={item.id} className="ws-planned-item"><span>{new Date(item.plannedAt).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span>
                  <strong>{item.title}</strong>
                  <em>{item.status}</em>
                  {staffMode && <div className="ws-inline-actions">
                    <button type="button" onClick={() => {
                      setPlanEditing(item.id);
                      setPlanForm({ title:item.title, plannedAt:localDateTime(new Date(item.plannedAt)),
                        notes:item.notes || '',status:item.status,recipeId:item.recipeId || '' });
                      setFormOpen(true);
                    }}>Edit</button>
                    {item.status === 'draft' && <button type="button" onClick={() => void mutate('Plan published.', () => workspaceApi('plans/' + item.id, 'PATCH', { status: 'published' }))}>Publish</button>}
                    <button type="button" aria-label="Delete recommendation" onClick={() => { if (window.confirm('Remove this recommendation?')) void mutate('Recommendation removed.', () => workspaceApi('plans/' + item.id,'DELETE')); }}>Remove</button>
                  </div>}
                </div>)}
            </div>;
          })}
        </div>
      </div>
      <div className="ws-callout"><ShieldCheck size={18}/><p><strong>Recommendations and food diary are separate.</strong> The plan suggests what to eat; the diary records what was actually eaten. Only published items are visible to patients.</p></div>
    </>}
  </div>;

  const recipeLibrary = () => <div className="ws-stack">
    {pageHeading('Nutrition library', isPatient ? 'My recipes' : 'Foods & recipes',
      'Reusable foods and preparations with ingredient, serving and macronutrient information.',
      isStaff && libraryTab === 'recipes' && <button className="ws-primary" onClick={() => { setRecipeEditing(''); setRecipeForm({
        name:'',ingredients:'',instructions:'',calories:'0',protein:'0',carbs:'0',fat:'0',fiber:'0',allergens:'',source:'',
      }); setFormOpen(true); }}><Plus size={16}/> Add recipe</button>)}
    <div className="ws-tabs" role="tablist" aria-label="Food library sections">
      <button type="button" role="tab" aria-selected={libraryTab === 'foods'} className={libraryTab === 'foods' ? 'active' : ''}
        onClick={() => { setLibraryTab('foods'); setFormOpen(false); }}>Individual foods</button>
      <button type="button" role="tab" aria-selected={libraryTab === 'recipes'} className={libraryTab === 'recipes' ? 'active' : ''}
        onClick={() => { setLibraryTab('recipes'); setFormOpen(false); }}>Recipes</button>
    </div>
    {libraryTab === 'foods' && <FoodCatalogueSection/>}
    {libraryTab === 'recipes' && <React.Fragment>}
    {isStaff && formOpen && <form className="ws-card ws-form" onSubmit={event => {
      event.preventDefault();
      const data = {
        ...recipeForm, calories:Number(recipeForm.calories), protein:Number(recipeForm.protein),
        carbs:Number(recipeForm.carbs), fat:Number(recipeForm.fat), fiber:Number(recipeForm.fiber),
      };
      void mutate(recipeEditing ? 'Recipe updated.' : 'Recipe added.',
        () => workspaceApi(recipeEditing ? 'recipes/' + recipeEditing : 'recipes', recipeEditing ? 'PATCH' : 'POST', data));
    }}>
      <h2>{recipeEditing ? 'Edit recipe' : 'Add a recipe or food'}</h2>
      <p>Nutrients are specified per standard serving. Use a verified source where possible.</p>
      <div className="ws-form-grid">
        <label>Food / recipe name<input required maxLength={160} value={recipeForm.name} onChange={e => setRecipeForm({ ...recipeForm,name:e.target.value })}/></label>
        <label>Ingredients (with quantities)<input required maxLength={5000} value={recipeForm.ingredients} onChange={e => setRecipeForm({ ...recipeForm,ingredients:e.target.value })}/></label>
        {(['calories','protein','carbs','fat','fiber'] as const).map(field =>
          <label key={field}>{field === 'calories' ? 'Calories (kcal)' : field + ' (g)'}
            <input required type="number" min="0" max="100000" step="any" value={recipeForm[field]}
              onChange={e => setRecipeForm({ ...recipeForm,[field]:e.target.value })}/></label>)}
        <label>Allergens<input maxLength={500} value={recipeForm.allergens} onChange={e => setRecipeForm({ ...recipeForm,allergens:e.target.value })}/></label>
        <label>Nutrition source<input maxLength={400} value={recipeForm.source} onChange={e => setRecipeForm({ ...recipeForm,source:e.target.value })}/></label>
        <label className="ws-wide">Preparation instructions<textarea maxLength={3000} value={recipeForm.instructions} onChange={e => setRecipeForm({ ...recipeForm,instructions:e.target.value })}/></label>
      </div>
      <div className="ws-form-actions"><button disabled={busy} className="ws-primary">{recipeEditing ? 'Save changes' : 'Add to library'}</button>
        <button type="button" className="ws-secondary" onClick={() => setFormOpen(false)}>Cancel</button></div>
    </form>}
    <div className="ws-card">
      <div className="ws-toolbar"><label className="ws-search"><Search size={17}/><input placeholder="Search foods, recipes, ingredients…" aria-label="Search recipes" value={recipeSearch} onChange={e => setRecipeSearch(e.target.value)}/></label>
        <span>{recipes.length} entries</span></div>
      {recipes.length === 0 ? <Empty title="0 recipes" description="The library is empty. Practitioners can add verified recipes and nutritional details." icon={BookOpen}/> :
        <div className="ws-table-wrap"><table className="ws-table"><thead><tr><th>Food / recipe</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Fiber</th>{isStaff && <th>Actions</th>}</tr></thead>
          <tbody>{recipes.filter(r => (r.name + ' ' + formatRecipeIngredients(r.ingredients)).toLowerCase().includes(recipeSearch.toLowerCase())).map(recipe =>
            <tr key={recipe.id}><td><strong>{recipe.name}</strong><small>{formatRecipeIngredients(recipe.ingredients)}</small>{Boolean(recipe.allergens) && <small>Allergens: {displayText(recipe.allergens)}</small>}</td>
              <td>{recipe.calories == null ? '—' : int(recipe.calories) + ' kcal'}</td><td>{recipe.protein == null ? '—' : int(recipe.protein) + ' g'}</td><td>{recipe.carbs == null ? '—' : int(recipe.carbs) + ' g'}</td><td>{recipe.fat == null ? '—' : int(recipe.fat) + ' g'}</td><td>{recipe.fiber == null ? '—' : int(recipe.fiber) + ' g'}</td>
              {isStaff && <td><div className="ws-inline-actions">
                <button type="button" onClick={() => { setRecipeEditing(recipe.id); setRecipeForm({
                  name:recipe.name,ingredients:formatRecipeIngredients(recipe.ingredients),instructions:displayText(recipe.instructions),
                  calories:String(recipe.calories ?? ''),protein:String(recipe.protein ?? ''),carbs:String(recipe.carbs ?? ''),
                  fat:String(recipe.fat ?? ''),fiber:String(recipe.fiber ?? ''),allergens:displayText(recipe.allergens),source:displayText(recipe.source),
                });setFormOpen(true); }}>Edit</button>
                <button type="button" onClick={() => { if (window.confirm('Delete recipe? Existing food entries keep their recorded snapshot.')) void mutate('Recipe removed.', () => workspaceApi('recipes/' + recipe.id,'DELETE')); }}>Remove</button>
              </div></td>}
            </tr>)}</tbody></table></div>}
    </div>
    </React.Fragment>}
  </div>;

  const appointmentsPage = () => <div className="ws-stack">
    {pageHeading('Consultations','Appointments','Upcoming meetings and consultation scheduling.',
      isStaff && <button className="ws-primary" onClick={() => setFormOpen(!formOpen)}><Plus size={16}/> Schedule meeting</button>)}
    {isStaff && formOpen && <form className="ws-card ws-form" onSubmit={event => {
      event.preventDefault();
      const clinician = role === 'dietitian' ? user.id : visitForm.dietitianId;
      void mutate('Appointment scheduled.', () => workspaceApi('appointments','POST',{
        patientId:selectedPatient,dietitianId:clinician,startsAt:new Date(visitForm.startsAt).toISOString(),
        title:visitForm.title,durationMinutes:Number(visitForm.durationMinutes),
      }));
    }}>
      <h2>Schedule consultation</h2>
      <div className="ws-form-grid">
        <label>Patient<select required value={selectedPatient} onChange={e => setSelectedPatient(e.target.value)}><option value="">Select patient</option>{patients.map(p => <option key={p.id} value={p.id}>{p.email}</option>)}</select></label>
        {role === 'admin' && <label>Dietitian<select required value={visitForm.dietitianId} onChange={e => setVisitForm({ ...visitForm,dietitianId:e.target.value })}><option value="">Select dietitian</option>{dietitians.map(d => <option key={d.id} value={d.id}>{d.email}</option>)}</select></label>}
        <label>Title<input required value={visitForm.title} maxLength={160} onChange={e => setVisitForm({ ...visitForm,title:e.target.value })}/></label>
        <label>Starts at<input required type="datetime-local" value={visitForm.startsAt} onChange={e => setVisitForm({ ...visitForm,startsAt:e.target.value })}/></label>
        <label>Duration (minutes)<input required type="number" min="15" max="240" step="1" value={visitForm.durationMinutes} onChange={e => setVisitForm({ ...visitForm,durationMinutes:e.target.value })}/></label>
      </div><button className="ws-primary" disabled={busy}>Save appointment</button></form>}
    <div className="ws-card"><div className="ws-section-title"><h2>Consultation schedule</h2><span>{appointments.length} meetings</span></div>
      {appointments.length === 0 ? <Empty title="0 appointments" description="No consultations are currently scheduled." icon={CalendarDays}/> :
        <div className="ws-list">{appointments.map(item => <article className="ws-list-row" key={item.id}>
          <div className="ws-time">{fmt(item.startsAt)}</div><div className="ws-list-text"><strong>{item.title}</strong>
            <span>{item.durationMinutes} minutes{isStaff ? ' · ' + (patients.find(p => p.id === String(item.patientId))?.email || 'Patient') : ''}</span></div>
          {isStaff && <button className="ws-icon-button" aria-label="Cancel appointment" onClick={() => { if (window.confirm('Delete this appointment?')) void mutate('Appointment removed.', () => workspaceApi('appointments/' + item.id,'DELETE')); }}><Trash2 size={16}/></button>}
        </article>)}</div>}
    </div>
  </div>;

  const progressPage = (staffMode: boolean) => <div className="ws-stack">
    {pageHeading('Longitudinal progress',staffMode ? 'Patient progress' : 'My progress',
      'Track measurements and goals over time.',
      !staffMode && <button className="ws-primary" onClick={() => setFormOpen(!formOpen)}><Plus size={16}/> Add measurement</button>)}
    {!staffMode && formOpen && <form className="ws-card ws-form" onSubmit={event => {
      event.preventDefault();
      void mutate('Measurement saved.',()=>workspaceApi('progress','POST',{
        metric:progressForm.metric, value:Number(progressForm.value),unit:progressForm.unit,
        measuredAt:new Date(progressForm.measuredAt).toISOString(),
      }));
    }}><div className="ws-form-grid">
        <label>Measurement name<input required maxLength={90} value={progressForm.metric} onChange={e => setProgressForm({ ...progressForm,metric:e.target.value })}/></label>
        <label>Value<input required type="number" step="any" value={progressForm.value} onChange={e => setProgressForm({ ...progressForm,value:e.target.value })}/></label>
        <label>Unit<input required maxLength={20} value={progressForm.unit} onChange={e => setProgressForm({ ...progressForm,unit:e.target.value })}/></label>
        <label>When measured<input required type="datetime-local" value={progressForm.measuredAt} onChange={e => setProgressForm({ ...progressForm,measuredAt:e.target.value })}/></label>
      </div><button className="ws-primary" disabled={busy}>Save measurement</button></form>}
    <div className="ws-card"><h2>Measurement history</h2>
      {progress.length === 0 ? <Empty title="0 progress records" description="Measurements appear here once logged." icon={Activity}/> :
        <div className="ws-list">{progress.map(p => <div className="ws-list-row" key={p.id}>
          <div className="ws-time">{fmt(p.measuredAt)}</div><div className="ws-list-text"><strong>{p.metric}</strong><span>{p.value} {p.unit}</span></div>
        </div>)}</div>}
    </div>
  </div>;

  const patientOverview = () => <div className="ws-stack">
    {pageHeading('Patient care','Patient overview','A secure, unified view of each assigned patient’s food diary, diet plan and progress.')}
    <div className="ws-card">{choosePatient}
      {!scopedPatient ? <Empty title="No patient selected" description="Choose an authorized patient to access their care overview." icon={Users}/> :
        <div className="ws-patient-identity"><HeartPulse size={22}/><div><strong>{selectedPatientName}</strong><p>Assigned patient workspace</p></div></div>}
    </div>
    {scopedPatient && <>
      <div className="ws-tabs">{['Overview','Food diary','Diet plan','Progress','Appointments'].map(tab =>
        <button key={tab} className={selectedTab === tab ? 'active' : ''} onClick={() => { setSelectedTab(tab);setFormOpen(false); }}>{tab}</button>)}</div>
      {selectedTab === 'Overview' && <div className="ws-grid-two">
        <div className="ws-card"><h2>Food diary</h2><Empty title={int(entries.length) + ' entries'} description="The patient’s chronological food log." icon={UtensilsCrossed}/></div>
        <div className="ws-card"><h2>Diet recommendations</h2><Empty title={int(plans.length) + ' plan items'} description="Draft and published diet recommendations." icon={CalendarDays}/></div>
        <div className="ws-card"><h2>Progress</h2><Empty title={int(progress.length) + ' measurements'} description="Recorded patient measurements." icon={Activity}/></div>
        <div className="ws-card"><h2>Appointments</h2><Empty title={int(appointments.length) + ' meetings'} description="Scheduled consultations." icon={Clock3}/></div>
      </div>}
      {selectedTab === 'Food diary' && foodDiary(true)}
      {selectedTab === 'Diet plan' && dietPlan(true)}
      {selectedTab === 'Progress' && progressPage(true)}
      {selectedTab === 'Appointments' && appointmentsPage()}
    </>}
  </div>;

  const patientsPage = () => <div className="ws-stack">
    {pageHeading('Practice directory',role === 'admin' ? 'All patients' : 'My patients',
      role === 'admin' ? 'Active patients in your practice.' : 'Only patients assigned to you appear here.')}
    <div className="ws-card"><div className="ws-section-title"><h2>Patient directory</h2><span>{patients.length} patients</span></div>
      {patients.length === 0 ? <Empty title="0 patients" description="No authorized patient accounts available." icon={Users}/> :
        <div className="ws-list">{patients.map(p => <div className="ws-list-row" key={p.id}>
          <div className="ws-initial">{p.email[0].toUpperCase()}</div>
          <div className="ws-list-text"><strong>{p.email}</strong><span>Patient account</span></div>
          <button className="ws-secondary" onClick={() => { setSelectedPatient(p.id);navigate('patient-overview'); }}>Open overview <ArrowRight size={14}/></button>
        </div>)}</div>}
    </div>
    {role === 'admin' && <div className="ws-card ws-form"><h2>Assign dietitian to patient</h2>
      <p>Only assigned practitioners can access a patient's clinical workspace.</p>
      <div className="ws-form-grid">{choosePatient}
        <label>Dietitian<select value={assignDietitian} onChange={e => setAssignDietitian(e.target.value)}><option value="">Select a dietitian</option>{dietitians.map(d => <option key={d.id} value={d.id}>{d.email}</option>)}</select></label>
      </div><button className="ws-primary" disabled={!selectedPatient || !assignDietitian || busy}
        onClick={() => void mutate('Dietitian assigned.', () => workspaceApi('assignments','POST',{patientId:selectedPatient,dietitianId:assignDietitian}))}>Assign</button>
    </div>}
  </div>;

  const homePage = () => isPatient ? <div className="ws-stack">
    {pageHeading('Your secure space','Your daily overview','Nutrition, recommendations and appointments — at your pace.',
      <button className="ws-primary" onClick={() => {navigate('food-diary');setFormOpen(true);}}><Plus size={16}/> Log food</button>)}
    <div className="ws-metrics">
      <Metric name="Food entries" value={int(stats?.values.entries)} note="Today" icon={UtensilsCrossed}/>
      <Metric name="Calories recorded" value={int(stats?.values.calories) + ' kcal'} note="Known recipe nutrients only" icon={Activity}/>
      <Metric name="Protein recorded" value={int(stats?.values.protein) + ' g'} note="Known recipe nutrients only" icon={HeartPulse}/>
      <Metric name="Appointments" value={int(stats?.values.appointments)} note="Upcoming consultations" icon={CalendarDays}/>
    </div>
    <div className="ws-grid-two">
      <div className="ws-card"><div className="ws-section-title"><h2>Today's food timeline</h2><button className="ws-link" onClick={() => navigate('food-diary')}>View diary <ArrowRight size={14}/></button></div>
        {entries.filter(item => dayKey(item.eatenAt) === localDate(new Date())).length === 0
          ? <Empty title="Nothing logged today" description="Log food whenever you eat — no fixed meal slots." icon={Clock3}/> :
          <div className="ws-list">{entries.filter(item => dayKey(item.eatenAt) === localDate(new Date())).slice(0,5).map(item =>
            <div className="ws-list-row" key={item.id}><span className="ws-time">{fmt(item.eatenAt,{timeStyle:'short'})}</span><strong>{item.foodName}</strong></div>)}</div>}
      </div>
      <div className="ws-column"><div className="ws-card"><h2>Next consultation</h2>
        {myVisits.length ? <p>{myVisits[0].title} — {fmt(myVisits[0].startsAt)}</p> :
        <Empty title="0 scheduled" description="Your next consultation will appear here." icon={CalendarDays}/>}</div>
        <div className="ws-card"><h2>Your nutrition plan</h2>
          {plans.length ? <p>{plans.length} published recommendations available in your calendar.</p> :
          <Empty title="No published plan" description="Recommendations from your dietitian will appear here." icon={BookOpen}/>}</div>
      </div>
    </div>
  </div> : <div className="ws-stack">
    {pageHeading('Practice insights','Good morning. Here’s your practice.',
      'Your workspace at a glance. Arrange the cards to suit your workflow.',
      <button className="ws-secondary" onClick={() => setEditingWidgets(!editingWidgets)}><GripVertical size={16}/> {editingWidgets ? 'Done editing' : 'Edit dashboard'}</button>)}
    {editingWidgets && <div className="ws-card ws-form"><div className="ws-section-title"><h2>Customize dashboard</h2><button className="ws-link" onClick={() => setWidgets(defaultWidgets)}>Reset layout</button></div>
      <p>Show, hide, or reorder widgets. Changes are saved only for your account.</p>
      {allWidgets.map(item => <div className="ws-widget-option" key={item.id}>
        <label><input type="checkbox" checked={widgets.includes(item.id)} onChange={e => setWidgets(current =>
          e.target.checked ? [...current,item.id] : current.filter(id => id !== item.id))}/>{item.label}</label>
        <button disabled={!widgets.includes(item.id) || widgets.indexOf(item.id) <= 0} onClick={() => setWidgets(current => {
          const list=[...current];const index=list.indexOf(item.id);if(index>0)[list[index-1],list[index]]=[list[index],list[index-1]];return list;
        })}>Move up</button>
        <button disabled={!widgets.includes(item.id) || widgets.indexOf(item.id) >= widgets.length-1} onClick={() => setWidgets(current => {
          const list=[...current];const index=list.indexOf(item.id);if(index>=0 && index<list.length-1)[list[index+1],list[index]]=[list[index],list[index+1]];return list;
        })}>Move down</button>
      </div>)}
      <button className="ws-primary" disabled={busy} onClick={() => void mutate('Dashboard layout saved.',()=>workspaceApi('layout','PUT',{widgets}))}><Check size={16}/> Save dashboard</button>
    </div>}
    {renderMetrics(widgets.map(id => allWidgets.find(w => w.id === id)).filter((w): w is typeof allWidgets[number] => Boolean(w)))}
    <div className="ws-grid-two"><div className="ws-card"><div className="ws-section-title"><h2>Patient activity</h2><span>Latest activity</span></div>
      <Empty title="0 activity events" description="Patient engagement charts will appear when activity analytics are available." icon={ChartNoAxesCombined}/></div>
      <div className="ws-card"><div className="ws-section-title"><h2>Upcoming consultations</h2><button className="ws-link" onClick={() => navigate('appointments')}>View calendar <ArrowRight size={14}/></button></div>
        {myVisits.length === 0 ? <Empty title="0 scheduled" description="Scheduled consultations appear here." icon={CalendarDays}/> :
          <div className="ws-list">{myVisits.slice(0,4).map(item => <div key={item.id} className="ws-list-row"><span className="ws-time">{fmt(item.startsAt)}</span><strong>{item.title}</strong></div>)}</div>}
      </div></div>
  </div>;

  const reportsPage = () => <div className="ws-stack">{pageHeading('Practice insights','Reports','Summary metrics from authorized data sources.')}
    {renderMetrics(allWidgets.slice(0,4))}<div className="ws-card"><Empty title="0 generated reports" description="Exportable reports will be available once report generation is integrated." icon={ClipboardList}/></div></div>;
  const insightsPage = () => <div className="ws-stack">{pageHeading('Nutrition insights','Your food insights',
    'Totals from food logs that reference recipes with recorded nutrient information.')}
    <div className="ws-metrics">
      <Metric name="Food entries today" value={int(stats?.values.entries)} note="All logged food events" icon={UtensilsCrossed}/>
      <Metric name="Known energy" value={int(stats?.values.calories) + ' kcal'} note="Unestimated foods excluded" icon={Activity}/>
      <Metric name="Known protein" value={int(stats?.values.protein) + ' g'} note="Unestimated foods excluded" icon={HeartPulse}/>
    </div>
    <div className="ws-card"><Empty title="0 trend charts" description="Trends will be displayed when enough validated nutrition data is available." icon={ChartNoAxesCombined}/></div>
  </div>;

  const content = () => {
    if (loading) return <div className="ws-card" role="status">Loading your data…</div>;
    const dependencies: Record<string, string[]> = {
      home: isPatient ? ['stats', 'entries', 'appointments', 'plans'] : ['stats', 'appointments'],
      'food-diary': ['entries'], 'my-diet-plan': ['plans'], 'nutrition-insights': ['stats'],
      progress: ['progress'], appointments: ['appointments'], patients: ['patients'],
      'patient-overview': ['patients', 'entries', 'plans', 'progress'],
      'diet-plan-builder': ['patients', 'plans'], recipes: libraryTab === 'recipes' ? ['recipes'] : [], reports: ['stats'],
    };
    const missing = (dependencies[validView] || []).filter(key => failedSections.includes(key));
    if (missing.length || (validView === 'home' && !stats)) return <div className="ws-card">
      <Empty title="Section data unavailable" description={'Could not load: ' + (missing.join(', ') || 'stats') + '. Please retry.'}/>
      <button className="ws-primary" onClick={() => void reload(user,selectedPatient)}>Retry</button>
    </div>;
    switch (validView) {
      case 'home': return homePage();
      case 'food-diary': return foodDiary(false);
      case 'my-diet-plan': return dietPlan(false);
      case 'nutrition-insights': return insightsPage();
      case 'progress': return progressPage(false);
      case 'patient-overview': return patientOverview();
      case 'patients': return patientsPage();
      case 'diet-plan-builder': return dietPlan(true);
      case 'recipes': return recipeLibrary();
      case 'appointments': return appointmentsPage();
      case 'reports': return reportsPage();
      case 'messages': return <div className="ws-stack">{pageHeading('Communications','Messages','Secure patient and practitioner messages.')}
        <div className="ws-card"><Empty title="0 conversations" description="Secure messaging is not yet connected. No sample messages are shown." icon={MessageCircle}/></div></div>;
      case 'settings': return <div className="ws-stack">{pageHeading('Your workspace','Settings','Account identity and access.')}
        <div className="ws-card"><h2>Account</h2><p>Email: {user.email}</p><p>Role: {user.role}</p>
          <button className="ws-secondary" onClick={() => void logoutNow()}>Sign out</button></div></div>;
      default: return homePage();
    }
  };

  return <div className="ws-shell">
    {menuOpen && <button className="ws-overlay" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <aside className={'ws-sidebar' + (menuOpen ? ' open' : '')}>
      <a className="ws-brand" href="/"><span><Leaf size={18}/></span>ayu<b>.</b></a>
      <div className="ws-sidebar-title">{role.toUpperCase()} WORKSPACE</div>
      <nav aria-label={role + ' dashboard navigation'}>
        {nav.map(item => { const Icon = item.icon; return <button type="button" key={item.id}
          onClick={() => navigate(item.id)} className={'ws-nav-item' + (item.id === validView ? ' active' : '')}>
          <Icon size={17}/>{item.label}</button>; })}
      </nav>
      <div className="ws-sidebar-account"><ShieldCheck size={17}/><div><strong>Secure workspace</strong><span>{user.email}</span></div></div>
    </aside>
    <div className="ws-content">
      <header className="ws-topbar">
        <button className="ws-menu" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21}/></button>
        <span>Ayu <ChevronRight size={13}/> {role === 'admin' ? 'Admin' : role === 'dietitian' ? 'Dietitian' : 'Patient'} <ChevronRight size={13}/> {title}</span>
        <div className="ws-top-actions">
          <button title="Refresh" aria-label="Refresh dashboard" onClick={() => void reload(user,selectedPatient)} disabled={loading}><RefreshCw size={17}/></button>
          <button onClick={() => void logoutNow()} disabled={busy}><ArrowLeft size={15}/> Sign out</button>
        </div>
      </header>
      <main className="ws-main">
        {error && stats && <div className="ws-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={16}/></button></div>}
        {notice && <div role="status" className="ws-notice"><Check size={16}/>{notice}</div>}
        {content()}
      </main>
    </div>
  </div>;
}

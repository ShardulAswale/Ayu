import React from 'react';
import { BookCopy, BookOpen, Check, ClipboardList } from 'lucide-react';
import { PlanEntry, workspaceApi } from './workspace-client';

export interface SavedPlanTemplate {
  id:string;name:string;createdAt:string;
  items: { title:string; weekday:number; time:string;notes?:string;recipeId?:string }[];
}
export function startMondayUTC(day:string) {
  const date = new Date(day+'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7));
  return date.toISOString().slice(0,10);
}
export function PlanWorkflowTools({ patientId, calendarDate, plans, onUpdated }: {
  patientId:string;calendarDate:string;plans:PlanEntry[];onUpdated:()=>void;
}) {
  const [templates,setTemplates] = React.useState<SavedPlanTemplate[]>([]);
  const [templateName,setTemplateName] = React.useState('');
  const [templateId,setTemplateId] = React.useState('');
  const [target,setTarget] = React.useState('');
  const [busy,setBusy] = React.useState(false);
  const [error,setError] = React.useState('');
  const [notice,setNotice] = React.useState('');
  const week = startMondayUTC(calendarDate);
  const targetWeek = startMondayUTC(target || calendarDate);
  const reloadTemplates=React.useCallback(()=>workspaceApi<SavedPlanTemplate[]>('plan-templates').then(setTemplates),[]);
  React.useEffect(()=>{void reloadTemplates().catch(()=>setError('Could not load plan templates'));},[reloadTemplates]);
  const work = async (success:string,action:()=>Promise<unknown>)=>{
    setBusy(true);setError('');setNotice('');
    try{await action();setNotice(success);onUpdated();}
    catch(cause){setError(cause instanceof Error?cause.message:'The plan operation failed');}
    finally{setBusy(false);}
  };
  const thisWeek = plans.filter(p=>{
    const utc=p.plannedAt.slice(0,10);
    return utc>=week&&utc < new Date(Date.parse(week+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);
  });
  const saveTemplate = () => void work('Reusable template saved.',async()=>{
    if(!templateName.trim())throw new Error('Enter a template name');
    if(!thisWeek.length)throw new Error('Add recommendations to the selected week first');
    if(thisWeek.length>28)throw new Error('Templates support up to 28 recommendations');
    const items=thisWeek.map(p=>{
      const date=new Date(p.plannedAt);
      return {title:p.title,weekday:(date.getUTCDay()+6)%7,
        time:String(date.getUTCHours()).padStart(2,'0')+':'+String(date.getUTCMinutes()).padStart(2,'0'),
        notes:p.notes||'',...(p.recipeId?{recipeId:p.recipeId}:{})};
    });
    await workspaceApi('plan-templates','POST',{name:templateName.trim(),items});
    setTemplateName('');await reloadTemplates();
  });
  return <section className="ws-card ws-care-panel" aria-label="Advanced diet plan workflows">
    <div className="ws-section-title"><h2>Weekly plan tools</h2><span>Week starting {week} (UTC)</span></div>
    <p>Templates and copied recommendations are always created as <strong>drafts</strong>.
      Review them before publishing. Time slots use UTC until patient time-zone scheduling is implemented.</p>
    {error&&<p role="alert" className="ws-care-error">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    <div className="ws-plan-tools-grid">
      <div>
        <h3>Save selected week as template</h3>
        <label>Template name<input maxLength={100} value={templateName} onChange={e=>setTemplateName(e.target.value)} placeholder="Vegetarian weekly plan"/></label>
        <button type="button" className="ws-secondary" disabled={busy||!templateName.trim()||!thisWeek.length} onClick={saveTemplate}>
          <BookOpen size={15}/> Save {thisWeek.length} items</button>
      </div>
      <div>
        <h3>Apply an existing template</h3>
        <label>Saved templates<select value={templateId} onChange={e=>setTemplateId(e.target.value)}>
          <option value="">Choose a template</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} ({t.items.length})</option>)}</select></label>
        <button type="button" className="ws-secondary" disabled={busy||!templateId} onClick={()=>void work('Template applied as drafts.',()=>workspaceApi('plans/apply-template','POST',{patientId,templateId,weekStart:week}))}>
          <BookCopy size={15}/> Apply to selected week</button>
        <small>Only templates saved by your account are shown.</small>
      </div>
      <div>
        <h3>Duplicate week</h3>
        <label>Target week (choose any date)<input type="date" value={target} onChange={e=>setTarget(e.target.value)}/></label>
        <button type="button" className="ws-secondary" disabled={busy||!target||targetWeek===week||!thisWeek.length}
          onClick={()=>void work('Recommendations copied as drafts.',()=>workspaceApi('plans/duplicate-week','POST',{
            patientId,sourceWeek:week,targetWeek}))}>
          <ClipboardList size={15}/> Duplicate this week</button>
      </div>
      <div>
        <h3>Publish selected week</h3>
        <p>{thisWeek.filter(p=>p.status==='draft').length} draft recommendations</p>
        <button type="button" className="ws-primary" disabled={busy||!thisWeek.some(p=>p.status==='draft')}
          onClick={()=>{if(window.confirm('Publish ALL drafts for this week to this patient?'))void work('Draft recommendations published.',()=>workspaceApi('plans/publish-week','POST',{patientId,weekStart:week}));}}>
          <Check size={15}/> Publish this week</button>
      </div>
    </div>
    {!!templates.length&&<details className="ws-plan-saved"><summary>Manage saved templates ({templates.length})</summary>
      {templates.map(t=><div key={t.id} className="ws-list-row"><span>{t.name} · {t.items.length} items</span>
        <button type="button" className="ws-secondary" disabled={busy} onClick={()=>{if(window.confirm('Delete this reusable template?'))void work('Template removed.',async()=>{await workspaceApi('plan-templates/'+t.id,'DELETE');await reloadTemplates();});}}>Remove</button>
      </div>)}</details>}
  </section>;
}
export function PlanHistoryButton({ id }: { id:string }) {
  const [open,setOpen]=React.useState(false);
  const [records,setRecords]=React.useState<{ id:string;operation:string;createdAt:string;before?:{title?:string;status?:string};after?:{title?:string;status?:string} }[]>([]);
  const [error,setError]=React.useState('');
  const show=async()=>{
    if(open){setOpen(false);return;}
    setError('');
    try{setRecords(await workspaceApi('plans/'+id+'/history'));setOpen(true);}
    catch(e){setError(e instanceof Error?e.message:'History unavailable');}
  };
  return <span className="ws-plan-history">
    <button type="button" onClick={()=>void show()}>History</button>
    {error&&<small role="alert">{error}</small>}
    {open&&<span className="ws-plan-revisions">{records.length?records.map(r=><small key={r.id}>
      {new Date(r.createdAt).toLocaleString()} · {r.operation} · {r.before?.status||'—'} → {r.after?.status||'—'}
    </small>):<small>No revisions yet.</small>}</span>}
  </span>;
}

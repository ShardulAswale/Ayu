import React from 'react';
import { workspaceApi } from './workspace-client';
type AuditEvent = { id: string; action: string; actorId: string|null; patientId: string|null; resourceId: string|null; createdAt: string };
export function AuditLogPanel() {
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let live = true;
    void workspaceApi<AuditEvent[]>('audit-events')
      .then(items=>{if(live)setEvents(items);})
      .catch(err=>{if(live)setError(err instanceof Error?err.message:'Audit events unavailable');})
      .finally(()=>{if(live)setLoading(false);});
    return ()=>{live=false;};
  }, []);
  return <section className="ws-card ws-care-panel" aria-label="Account access audit events">
    <h2>Security audit history</h2>
    <p>Latest 200 metadata events. Clinical note content and message text are never included in this view.</p>
    {loading && <p role="status">Loading audit events…</p>}
    {error && <p role="alert" className="ws-care-error">{error}</p>}
    {!loading && events.length===0 && <p>No audit events recorded.</p>}
    {!!events.length && <div className="ws-table-wrap"><table className="ws-table"><thead><tr><th>Time</th><th>Action</th><th>Patient ID</th><th>Actor ID</th></tr></thead><tbody>
      {events.map(e=><tr key={e.id}><td>{new Date(e.createdAt).toLocaleString()}</td><td>{e.action}</td>
        <td>{e.patientId||'—'}</td><td>{e.actorId||'—'}</td></tr>)}
    </tbody></table></div>}
  </section>;
}

import React from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { workspaceApi } from './workspace-client';

type CareMessage = { id: string; body: string; senderRole: string; createdAt: string };
type ClinicalNote = { id: string; title: string; body: string; createdAt: string };
const getError = (error: unknown) => error instanceof Error ? error.message : 'Request failed';
const pathFor = (path: string, patientId?: string) =>
  path + (patientId ? '?patientId=' + encodeURIComponent(patientId) : '');

export function MessagingPanel({ patientId, patientLabel }: { patientId?: string; patientLabel?: string }) {
  const [items, setItems] = React.useState<CareMessage[]>([]);
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setItems([]); setError(''); setLoading(true);
    void workspaceApi<CareMessage[]>(pathFor('messages', patientId))
      .then(data => { if (live) setItems(data); })
      .catch(cause => { if (live) setError(getError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [patientId, version]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() || saving) return;
    setSaving(true); setError('');
    try {
      await workspaceApi('messages', 'POST', { ...(patientId ? { patientId } : {}), body: body.trim() });
      setBody(''); setVersion(n => n + 1);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  };
  return <section className="ws-card ws-care-panel" aria-label="Patient conversation">
    <div className="ws-section-title"><h2>{patientLabel ? 'Messages with ' + patientLabel : 'Care team messages'}</h2>
      <button type="button" className="ws-secondary" disabled={loading} onClick={() => setVersion(n => n + 1)}><RefreshCw size={15}/> Refresh</button></div>
    <p>Messages are visible to the patient and authorised members of their care team. Do not use this conversation for emergencies.</p>
    {loading && <p role="status">Loading conversation…</p>}
    {error && <p role="alert" className="ws-care-error">{error}</p>}
    {!loading && items.length === 0 && <p>No messages yet.</p>}
    <div className="ws-care-thread" role="log" aria-label="Conversation history">
      {items.map(item => <article key={item.id} className="ws-care-message">
        <small>{item.senderRole === 'patient' ? 'Patient' : 'Care team'} · {new Date(item.createdAt).toLocaleString()}</small>
        <p>{item.body}</p>
      </article>)}
    </div>
    <form onSubmit={event => { void send(event); }} className="ws-care-compose">
      <label htmlFor="ayu-message">Message</label>
      <textarea id="ayu-message" rows={3} maxLength={2000} required value={body} onChange={e => setBody(e.target.value)} placeholder="Type a message to the care team…"/>
      <button type="submit" className="ws-primary" disabled={saving || !body.trim()}><Send size={15}/>{saving ? 'Sending…' : 'Send message'}</button>
    </form>
  </section>;
}

export function ClinicalNotesPanel({ patientId }: { patientId: string }) {
  const [items, setItems] = React.useState<ClinicalNote[]>([]);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setItems([]); setError(''); setLoading(true);
    void workspaceApi<ClinicalNote[]>(pathFor('notes', patientId))
      .then(data => { if (live) setItems(data); })
      .catch(cause => { if (live) setError(getError(cause)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [patientId, version]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true); setError('');
    try {
      await workspaceApi('notes', 'POST', { patientId, title: title.trim(), body: body.trim() });
      setTitle(''); setBody(''); setVersion(n => n + 1);
    } catch (cause) { setError(getError(cause)); }
    finally { setSaving(false); }
  };
  return <section className="ws-card ws-care-panel" aria-label="Private clinical notes">
    <h2>Private clinical notes</h2>
    <p>Practitioner-only notes. These are not shown in the patient account. Access and creation are audit logged.</p>
    {error && <p role="alert" className="ws-care-error">{error}</p>}
    <form className="ws-care-compose" onSubmit={event => { void save(event); }}>
      <label htmlFor="ayu-note-title">Title</label><input id="ayu-note-title" required maxLength={160} value={title} onChange={e => setTitle(e.target.value)}/>
      <label htmlFor="ayu-note-body">Note</label><textarea id="ayu-note-body" required rows={5} maxLength={10000} value={body} onChange={e => setBody(e.target.value)}/>
      <button className="ws-primary" type="submit" disabled={saving || !title.trim() || !body.trim()}>{saving ? 'Saving…' : 'Save clinical note'}</button>
    </form>
    {loading ? <p role="status">Loading notes…</p> : !items.length ? <p>No notes recorded.</p> :
      <div className="ws-care-thread">{items.map(item => <article className="ws-care-message" key={item.id}>
        <strong>{item.title}</strong><small>{new Date(item.createdAt).toLocaleString()}</small><p>{item.body}</p>
      </article>)}</div>}
  </section>;
}

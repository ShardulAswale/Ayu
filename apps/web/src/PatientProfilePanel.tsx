import React from 'react';
import { workspaceApi } from './workspace-client';
type Profile = { patientId: string; displayName: string; timezone: string };

export function PatientProfilePanel({ patientId, editable }: { patientId?: string; editable: boolean }) {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [name, setName] = React.useState('');
  const [timezone, setTimezone] = React.useState('UTC');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    setProfile(null);setError('');setNotice('');setLoading(true);
    const path = 'patient-profile' + (patientId ? '?patientId=' + encodeURIComponent(patientId) : '');
    void workspaceApi<Profile>(path).then(value => {
      if (!live) return;
      setProfile(value);setName(value.displayName);setTimezone(value.timezone);
    }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : 'Profile unavailable'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [patientId]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();setSaving(true);setError('');setNotice('');
    try {
      await workspaceApi('patient-profile','PATCH',{displayName:name.trim(),timezone});
      setProfile(p=>p ? {...p,displayName:name.trim(),timezone} : p);
      setNotice('Profile updated.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update profile'); }
    finally {setSaving(false);}
  };
  return <section className="ws-card ws-care-panel" aria-label="Patient profile">
    <h2>Patient profile</h2>
    <p>This profile contains non-clinical preferences only. Medical history and clinician assessments are managed separately.</p>
    {loading && <p role="status">Loading profile…</p>}
    {error && <p role="alert" className="ws-care-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {profile && (editable ?
      <form onSubmit={event=>{void save(event);}} className="ws-care-compose">
        <label htmlFor="ayu-profile-name">Preferred display name</label>
        <input id="ayu-profile-name" maxLength={120} value={name} onChange={e=>setName(e.target.value)}/>
        <label htmlFor="ayu-profile-tz">Time zone (IANA identifier)</label>
        <input id="ayu-profile-tz" maxLength={64} value={timezone} onChange={e=>setTimezone(e.target.value)}
          placeholder="Asia/Kolkata" required/>
        <button className="ws-primary" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
      </form> :
      <div><p><strong>Preferred name:</strong> {profile.displayName || 'Not set'}</p><p><strong>Time zone:</strong> {profile.timezone}</p></div>
    )}
  </section>;
}

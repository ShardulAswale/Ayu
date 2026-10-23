import React from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { workspaceApi } from './workspace-client';

type Day = { date: string; known: number; unknown: number;
  calories: number; protein: number; carbs: number; fat: number; fiber: number };
type Report = { days: number; timezone: string; truncated: boolean;
  known: number; unknown: number; items: Day[] };

export function NutritionReportPanel({ patientId }: { patientId?: string }) {
  const [days, setDays] = React.useState<7|30|90>(30);
  const [report, setReport] = React.useState<Report | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    setReport(null); setError(''); setLoading(true);
    const qs = new URLSearchParams({ days: String(days) });
    if (patientId) qs.set('patientId', patientId);
    void workspaceApi<Report>('nutrition-report?' + qs.toString())
      .then(data => { if (live) setReport(data); })
      .catch(cause => { if (live) setError(cause instanceof Error ? cause.message : 'Unable to load report'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [patientId, days, version]);

  const exportCsv = () => {
    if (!report) return;
    const fields = ['date','known','unknown','calories','protein','carbs','fat','fiber'] as const;
    const lines = [fields.join(','), ...report.items.map(day => fields.map(k => String(day[k])).join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'ayu-nutrition-report-' + report.days + 'd.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return <section className="ws-card ws-care-panel" aria-label="Nutrition report">
    <div className="ws-section-title"><h2>Nutrition report</h2>
      <div className="ws-inline-actions">
        <select aria-label="Report period" value={days} onChange={e=>setDays(Number(e.target.value) as 7|30|90)}>
          <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
        </select>
        <button type="button" className="ws-secondary" onClick={()=>setVersion(n=>n+1)}><RefreshCw size={15}/> Refresh</button>
        <button type="button" className="ws-secondary" disabled={!report || !report.items.length} onClick={exportCsv}><Download size={15}/> Export CSV</button>
      </div>
    </div>
    <p>Only diary items linked to recipes with recorded nutrient values are totalled. Unknown values are excluded, not treated as zero. Dates use UTC.</p>
    {loading && <p role="status">Loading report…</p>}
    {error && <p role="alert" className="ws-care-error">{error}</p>}
    {report && <>
      <p>{report.known} entries with nutrition · {report.unknown} without nutrient data</p>
      {report.truncated && <p role="alert">Report reached the 2,500-entry safety limit. Totals may be incomplete.</p>}
      {!report.items.length ? <p>No entries in this reporting period.</p> :
        <div className="ws-table-wrap"><table className="ws-table">
          <thead><tr><th>Date (UTC)</th><th>Known</th><th>Unknown</th><th>Energy (kcal)</th><th>Protein (g)</th><th>Carbs (g)</th><th>Fat (g)</th><th>Fibre (g)</th></tr></thead>
          <tbody>{report.items.map(day=><tr key={day.date}>
            <td>{day.date}</td><td>{day.known}</td><td>{day.unknown}</td>
            {(['calories','protein','carbs','fat','fiber'] as const).map(k=><td key={k}>{day.known ? day[k].toFixed(1) : '—'}</td>)}
          </tr>)}</tbody></table></div>}
    </>}
  </section>;
}

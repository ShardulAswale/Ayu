import React from 'react';
import type { ProgressEntry } from './workspace-client';

export function ProgressTrend({ entries }: { entries: ProgressEntry[] }) {
  const choices = React.useMemo(() => [...new Set(entries.map(e => e.metric + ' (' + e.unit + ')'))].sort(), [entries]);
  const [selected, setSelected] = React.useState('');
  const metric = choices.includes(selected) ? selected : choices[0] || '';
  const records = React.useMemo(() => entries.filter(e => e.metric + ' (' + e.unit + ')' === metric
    && Number.isFinite(e.value) && Number.isFinite(new Date(e.measuredAt).getTime()))
    .sort((a,b)=>new Date(a.measuredAt).getTime()-new Date(b.measuredAt).getTime()),[entries,metric]);
  if (!choices.length) return <section className="ws-card"><h2>Measurement trend</h2><p>No measurements to chart.</p></section>;
  const values = records.map(r=>r.value);
  const low = Math.min(...values), high = Math.max(...values);
  const min = low === high ? low - 1 : low;
  const max = low === high ? high + 1 : high;
  const first = records.length ? new Date(records[0].measuredAt).getTime() : 0;
  const last = records.length ? new Date(records[records.length-1].measuredAt).getTime() : 1;
  const point = (r: ProgressEntry, i: number) => ({
    x: last===first ? 330 : 40 + 580*(new Date(r.measuredAt).getTime()-first)/(last-first),
    y: 180-140*(r.value-min)/(max-min),
    key: r.id || String(i),
  });
  const points = records.map(point);
  return <section className="ws-card ws-care-panel" aria-label="Patient measurement trend">
    <div className="ws-section-title"><h2>Measurement trend</h2>
      <label>Metric <select aria-label="Chart metric" value={metric} onChange={e=>setSelected(e.target.value)}>{choices.map(x=><option key={x}>{x}</option>)}</select></label>
    </div>
    <p>Recorded measurements only; this chart does not assess health status.</p>
    {points.length > 0 && <svg viewBox="0 0 660 220" role="img" aria-label={metric + ' measurement values over time'} className="ws-progress-chart">
      <line x1="40" y1="180" x2="620" y2="180" stroke="#a5bcb0"/>
      <line x1="40" y1="40" x2="40" y2="180" stroke="#a5bcb0"/>
      <text x="40" y="30" fontSize="12" fill="#45695a">{max.toFixed(1)}</text>
      <text x="40" y="199" fontSize="12" fill="#45695a">{min.toFixed(1)}</text>
      {points.length>1 && <polyline points={points.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="#276747" strokeWidth="3"/>}
      {points.map(p=><circle key={p.key} cx={p.x} cy={p.y} r="5" fill="#276747"/>)}
      <text x="40" y="217" fontSize="11" fill="#45695a">{records[0] && new Date(records[0].measuredAt).toLocaleDateString()}</text>
      <text x="620" y="217" textAnchor="end" fontSize="11" fill="#45695a">{records.length && new Date(records[records.length-1].measuredAt).toLocaleDateString()}</text>
    </svg>}
    <div className="ws-table-wrap"><table className="ws-table"><thead><tr><th>Measured</th><th>Value</th></tr></thead>
      <tbody>{records.map(r=><tr key={r.id}><td>{new Date(r.measuredAt).toLocaleString()}</td><td>{r.value} {r.unit}</td></tr>)}</tbody>
    </table></div>
  </section>;
}

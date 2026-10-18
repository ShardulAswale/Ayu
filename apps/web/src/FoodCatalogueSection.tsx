import React from 'react';
import { Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { FoodCatalogPage, workspaceApi } from './workspace-client';
import { SessionExpiredError } from './auth-client';
import { nutritionLabel } from './catalogue-format.mjs';

const PAGE_SIZE = 25;

/** Paginated, read-only view of imported USDA foods; never downloads all 13k foods. */
export function FoodCatalogueSection() {
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [response, setResponse] = React.useState<FoodCatalogPage | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [retry, setRetry] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (query.trim()) params.set('q', query.trim());
        const data = await workspaceApi<FoodCatalogPage>('foods?' + params.toString());
        if (active) setResponse(data);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof SessionExpiredError) {
          window.location.replace('/login');
          return;
        }
        setResponse(null);
        setError(cause instanceof Error ? cause.message : 'Unable to load the food catalogue.');
      } finally {
        if (active) setLoading(false);
      }
    }, query.trim() ? 300 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, page, retry]);

  return <section className="ws-card" aria-label="USDA food catalogue">
    <div className="ws-toolbar">
      <label className="ws-search"><Search size={17}/>
        <input type="search" aria-label="Search individual foods" placeholder="Search apple, rice, spinach, paneer…"
          maxLength={100} value={query} onChange={event => {setQuery(event.target.value);setPage(1);}}/>
      </label>
      <span>{response ? response.total.toLocaleString() + ' foods' : 'Food catalogue'}</span>
    </div>
    <p>Verified catalogue entries from MongoDB. Nutrients are shown per 100 g; missing values are not estimated.</p>
    {loading && <div role="status" className="ws-catalogue-status">Loading foods…</div>}
    {!loading && error && <div role="alert" className="ws-catalogue-status">{error}
      <button type="button" className="ws-secondary" onClick={() => setRetry(n => n + 1)}>
        <RefreshCw size={14}/> Retry</button></div>}
    {!loading && !error && response && response.items.length === 0 && <div className="ws-catalogue-status">No foods matched your search.</div>}
    {!loading && !error && response && response.items.length > 0 && <>
      <div className="ws-table-wrap"><table className="ws-table">
        <thead><tr><th>Food and category</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Fibre</th></tr></thead>
        <tbody>{response.items.map(food => <tr key={food.id}>
          <td><strong>{food.name}</strong>
            {food.category?.label && <small>{food.category.label}</small>}
            {food.tags.length > 0 && <small>{food.tags.slice(0,4).map(tag => tag.label || tag.slug).filter(Boolean).join(' · ')}</small>}
          </td>
          <td>{nutritionLabel(food.nutrients.calories,'kcal')}</td>
          <td>{nutritionLabel(food.nutrients.protein,'g')}</td>
          <td>{nutritionLabel(food.nutrients.carbs,'g')}</td>
          <td>{nutritionLabel(food.nutrients.fat,'g')}</td>
          <td>{nutritionLabel(food.nutrients.fiber,'g')}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="ws-catalogue-pagination">
        <button type="button" className="ws-secondary" disabled={page <= 1 || loading} onClick={() => setPage(n => n - 1)}>
          <ChevronLeft size={14}/> Previous</button>
        <span>Page {response.page.toLocaleString()} of {response.pages.toLocaleString()}</span>
        <button type="button" className="ws-secondary" disabled={page >= response.pages || loading} onClick={() => setPage(n => n + 1)}>
          Next <ChevronRight size={14}/></button>
      </div>
    </>}
  </section>;
}

import { getCsrf, SessionExpiredError, SessionUser } from './auth-client';

export interface WorkspaceStats {
  role: SessionUser['role'];
  values: Record<string, number>;
}
export interface PatientRef { id: string; email: string; active: boolean }
export interface Recipe {
  id: string; name: string; ingredients: unknown; instructions?: unknown; source?: unknown; allergens?: unknown; tags?: string[];
  calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null;
}
export interface CatalogTag { id: string; slug: string | null; label: string | null }
export interface CatalogFood {
  id: string; name: string; foodType: string | null;
  category: CatalogTag | null; tags: CatalogTag[];
  nutrients: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
  source: { canonicalFdcId: number | null; dataset: string | null };
}
export interface FoodCatalogPage { items: CatalogFood[]; total: number; page: number; pages: number; limit: number }

export interface FoodEntry {
  id: string; foodName: string; eatenAt: string; quantity: number; unit: string;
  notes?: string; recipeId?: string; imageId?: string;
  nutrition?: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
}
export interface PlanEntry {
  id: string; patientId: string; title: string; plannedAt: string;
  notes?: string; status: 'draft' | 'published'; recipeId?: string;
}
export interface Appointment {
  id: string; patientId: string; dietitianId: string; startsAt: string;
  title: string; durationMinutes: number;
}
export interface ProgressEntry { id: string; metric: string; value: number; unit: string; measuredAt: string }

const root = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
export async function workspaceApi<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  if (!root) throw new Error('VITE_API_URL must be configured.');
  const changing = method !== 'GET';
  const csrf = changing ? await getCsrf() : undefined;
  const response = await fetch(root + '/workspace/' + path, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: changing ? {
      'content-type': 'application/json', 'x-ayu-csrf': csrf!,
    } : undefined,
    body: changing && data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!response.ok) {
    if (response.status === 401) throw new SessionExpiredError();
    if (response.status === 403) throw new Error('You do not have permission to access this resource.');
    const details = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const info = Array.isArray(details?.message) ? details.message.join('; ') : details?.message;
    throw new Error(info || 'The request failed. Please try again.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Authenticated multipart upload. Never submit patient images to a public storage URL. */
export async function mealImageRequest(entryId: string, method: 'GET'|'POST'|'DELETE', file?: Blob): Promise<Response> {
  if (!root) throw new Error('API is not configured');
  const csrf = method === 'GET' ? undefined : await getCsrf();
  const form = file ? new FormData() : undefined;
  if (form && file) form.append('image', file, 'sanitised-meal.webp');
  const response = await fetch(root + '/workspace/entries/' + encodeURIComponent(entryId) + '/image', {
    method, credentials:'include', cache:'no-store',
    headers:csrf ? { 'x-ayu-csrf':csrf } : undefined,
    body:form,
  });
  if (response.status === 401) throw new SessionExpiredError();
  if (!response.ok) {
    const info = await response.json().catch(()=>null) as { message?: string|string[] } | null;
    throw new Error(Array.isArray(info?.message) ? info.message.join('; ') :
      info?.message || 'Unable to process this meal image.');
  }
  return response;
}

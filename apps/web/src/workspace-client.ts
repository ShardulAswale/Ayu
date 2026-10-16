import { getCsrf, SessionExpiredError, SessionUser } from './auth-client';

export interface WorkspaceStats {
  role: SessionUser['role'];
  values: Record<string, number>;
}
export interface PatientRef { id: string; email: string }
export interface Recipe {
  id: string; name: string; ingredients: string; instructions?: string; source?: string; allergens?: string;
  calories: number; protein: number; carbs: number; fat: number; fiber: number;
}
export interface FoodEntry {
  id: string; foodName: string; eatenAt: string; quantity: number; unit: string;
  notes?: string; recipeId?: string;
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

import { singleFlight } from './single-flight.mjs';
export interface SessionUser { id: string; email: string; role: 'admin' | 'dietitian' | 'patient' }
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}
const api = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
const AUTH_TIMEOUT_MS = 60_000;

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(AUTH_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('Ayu server did not respond within a minute. The server may be waking after inactivity; please try again.');
    }
    throw new Error('Unable to reach Ayu server. Please check your connection and retry.');
  }
}
function endpoint(path: string) {
  if (!api) throw new Error('Authentication API is not configured. Set VITE_API_URL at build time.');
  return api + path;
}
async function parseError(response: Response): Promise<never> {
  if (response.status === 401) throw new SessionExpiredError('Authentication failed or session expired.');
  if (response.status === 403) throw new Error('Security verification failed. Your browser may not be retaining the session cookie needed for sign-in. Check third-party cookie restrictions for Ayu and retry.');
  if (response.status === 429) throw new Error('Too many attempts. Please try again later.');
  throw new Error('Unable to complete the request. Please try again.');
}
export async function getCsrf(): Promise<string> {
  const response = await authFetch(endpoint('/auth/csrf'), { credentials: 'include', cache: 'no-store' });
  if (!response.ok) return parseError(response);
  const data = await response.json() as { csrfToken: string };
  return data.csrfToken;
}
export async function login(email: string, password: string, csrfToken: string): Promise<{ user: SessionUser; csrfToken: string }> {
  const response = await authFetch(endpoint('/auth/login'), {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-ayu-csrf': csrfToken },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return parseError(response);
  const result = await response.json() as { user: SessionUser; csrfToken: string };
  // Discard any /auth/me started before the session cookie was rotated.
  sessionCheck.reset();
  return result;
}
async function retrieveCurrentUser(): Promise<SessionUser | null> {
  const response = await authFetch(endpoint('/auth/me'), { credentials: 'include', cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) return parseError(response);
  const data = await response.json() as { user: SessionUser };
  return data.user;
}
// Avoid duplicate session checks when Login/Dashboard mounts overlap.
const sessionCheck = singleFlight(retrieveCurrentUser);
export function currentUser(): Promise<SessionUser | null> {
  return sessionCheck();
}
export async function logout(csrfToken: string): Promise<void> {
  const response = await authFetch(endpoint('/auth/logout'), {
    method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'x-ayu-csrf': csrfToken },
  });
  if (!response.ok) return parseError(response);
  sessionCheck.reset();
}

export interface DashboardSummary {
  role: SessionUser['role'];
  metrics: { key: string; label: string; count: number; description: string }[];
  sections: { key: string; title: string; description: string; items: unknown[] }[];
}
export async function dashboardSummary(): Promise<DashboardSummary> {
  const response = await authFetch(endpoint('/dashboard/summary'), { credentials: 'include', cache: 'no-store' });
  if (!response.ok) return parseError(response);
  return response.json() as Promise<DashboardSummary>;
}

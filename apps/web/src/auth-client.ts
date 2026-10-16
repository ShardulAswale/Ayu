export interface SessionUser { id: string; email: string; role: 'admin' | 'dietitian' | 'patient' }
export class SessionExpiredError extends Error {
  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}
const api = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';
function endpoint(path: string) {
  if (!api) throw new Error('Authentication API is not configured. Set VITE_API_URL at build time.');
  return api + path;
}
async function parseError(response: Response): Promise<never> {
  if (response.status === 401) throw new SessionExpiredError('Authentication failed or session expired.');
  if (response.status === 403) throw new Error('Security verification failed. Refresh and try again.');
  if (response.status === 429) throw new Error('Too many attempts. Please try again later.');
  throw new Error('Unable to complete the request. Please try again.');
}
export async function getCsrf(): Promise<string> {
  const response = await fetch(endpoint('/auth/csrf'), { credentials: 'include', cache: 'no-store' });
  if (!response.ok) return parseError(response);
  const data = await response.json() as { csrfToken: string };
  return data.csrfToken;
}
export async function login(email: string, password: string, csrfToken: string): Promise<{ user: SessionUser; csrfToken: string }> {
  const response = await fetch(endpoint('/auth/login'), {
    method: 'POST', credentials: 'include', cache: 'no-store',
    headers: { 'content-type': 'application/json', 'x-ayu-csrf': csrfToken },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return parseError(response);
  return response.json() as Promise<{ user: SessionUser; csrfToken: string }>;
}
export async function currentUser(): Promise<SessionUser | null> {
  const response = await fetch(endpoint('/auth/me'), { credentials: 'include', cache: 'no-store' });
  if (response.status === 401) return null;
  if (!response.ok) return parseError(response);
  const data = await response.json() as { user: SessionUser };
  return data.user;
}
export async function logout(csrfToken: string): Promise<void> {
  const response = await fetch(endpoint('/auth/logout'), {
    method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'x-ayu-csrf': csrfToken },
  });
  if (!response.ok) return parseError(response);
}

export interface DashboardSummary {
  role: SessionUser['role'];
  metrics: { key: string; label: string; count: number; description: string }[];
  sections: { key: string; title: string; description: string; items: unknown[] }[];
}
export async function dashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch(endpoint('/dashboard/summary'), { credentials: 'include', cache: 'no-store' });
  if (!response.ok) return parseError(response);
  return response.json() as Promise<DashboardSummary>;
}

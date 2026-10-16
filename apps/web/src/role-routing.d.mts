export type AyuUserRole = 'admin' | 'dietitian' | 'patient';
export function dashboardPathForRole(role: AyuUserRole): string;
export function isDashboardPath(pathname: string): boolean;

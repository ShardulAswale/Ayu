// Pure routing helpers; never trust the URL as an authorization decision.
export function dashboardPathForRole(role) {
  switch (role) {
    case 'admin': return '/dashboard/admin';
    case 'dietitian': return '/dashboard/dietitian';
    case 'patient': return '/dashboard/patient';
    default: throw new Error('Unsupported account role');
  }
}

export function isDashboardPath(pathname) {
  return pathname === '/dashboard' ||
    pathname === '/dashboard/admin' ||
    pathname === '/dashboard/dietitian' ||
    pathname === '/dashboard/patient';
}

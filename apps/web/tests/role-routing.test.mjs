import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardPathForRole, isDashboardPath } from '../src/role-routing.mjs';

test('every authenticated role maps to exactly one dashboard', () => {
  assert.equal(dashboardPathForRole('admin'), '/dashboard/admin');
  assert.equal(dashboardPathForRole('dietitian'), '/dashboard/dietitian');
  assert.equal(dashboardPathForRole('patient'), '/dashboard/patient');
});

test('invalid roles cannot select a dashboard', () => {
  assert.throws(() => dashboardPathForRole('staff'), /Unsupported account role/);
  assert.throws(() => dashboardPathForRole(''), /Unsupported account role/);
});

test('only known dashboard URLs and the legacy route are recognized', () => {
  for (const role of ['admin', 'dietitian', 'patient']) {
    assert.equal(isDashboardPath(dashboardPathForRole(role)), true);
  }
  assert.equal(isDashboardPath('/dashboard'), true);
  assert.equal(isDashboardPath('/login'), false);
  assert.equal(isDashboardPath('/admin'), false);
  assert.equal(isDashboardPath('/dashboard/unknown'), false);
});

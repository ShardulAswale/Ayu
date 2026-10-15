import assert from 'node:assert/strict';
import test from 'node:test';
import { demoUsers } from './demo-users.mjs';

test('fictional demo accounts have unique normalized emails and supported roles', () => {
  assert.equal(demoUsers.length, 6);
  assert.equal(new Set(demoUsers.map(user => user.email)).size, demoUsers.length);
  assert.deepEqual(
    demoUsers.reduce((counts, user) => ({ ...counts, [user.role]: (counts[user.role] || 0) + 1 }), {}),
    { admin: 1, dietitian: 2, patient: 3 },
  );
  for (const user of demoUsers) {
    assert.match(user.email, /^[a-z0-9.]+@example\.com$/);
    assert.ok(['admin', 'dietitian', 'patient'].includes(user.role));
    assert.deepEqual(Object.keys(user).sort(), ['email', 'role']);
  }
});

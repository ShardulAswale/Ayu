import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes, createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { AuthController } = require('../dist/auth/auth.controller.js');
const { ActivatePatientDto } = require('../dist/auth/login.dto.js');
const { validateSync } = require('class-validator');
const { UnauthorizedException } = require('@nestjs/common');

const token = randomBytes(32).toString('base64url');
const userId = '507f1f77bcf86cd799439012';
function fakeAuth({ expired = false } = {}) {
  let used = false, activated = false, hashCalls = 0;
  const document = {
    tokenHash: createHash('sha256').update(token).digest('hex'),
    purpose: 'patient-invite', userId, expiresAt: new Date(Date.now() + (expired ? -1000 : 60_000)),
  };
  const allowed = filter => document.tokenHash === filter.tokenHash && document.purpose === filter.purpose &&
    document.expiresAt > filter.expiresAt.$gt && !used;
  const tokens = {
    findOne: async filter => allowed(filter) ? document : null,
    findOneAndUpdate: async (filter, patch) => {
      if (!allowed(filter)) return null;
      used = true;
      return document;
    },
  };
  const audit = { insertOne: async () => ({}) };
  const users = {
    updateOne: async (filter, update) => {
      assert.equal(filter.role, 'patient');
      assert.equal(filter.active, false);
      activated = Boolean(update.$set.active);
      return { matchedCount: 1 };
    },
  };
  const hashes = { hash: async () => { hashCalls++; return 'argon-hash-for-test'; } };
  const connection = { db: { collection: name => name === 'AccountTokens' ? tokens : audit } };
  return { controller: new AuthController(users, hashes, {}, connection),
    get used() { return used; }, get activated() { return activated; }, get hashCalls() { return hashCalls; } };
}

test('invalid invitation token is rejected before expensive password hashing', async () => {
  const ctx = fakeAuth();
  await assert.rejects(() => ctx.controller.activate({ token: randomBytes(32).toString('base64url'), password: 'SomeVeryLongPassword123!' }),
    UnauthorizedException);
  assert.equal(ctx.hashCalls, 0);
  assert.equal(ctx.activated, false);
});

test('valid invite activates once; replay is rejected', async () => {
  const ctx = fakeAuth();
  assert.deepEqual(await ctx.controller.activate({ token, password: 'SomeVeryLongPassword123!' }), { ok: true });
  assert.equal(ctx.activated, true);
  assert.equal(ctx.used, true);
  await assert.rejects(() => ctx.controller.activate({ token, password: 'SomeVeryLongPassword123!' }),
    UnauthorizedException);
  assert.equal(ctx.hashCalls, 1);
});

test('expired token never activates an account', async () => {
  const ctx = fakeAuth({ expired: true });
  await assert.rejects(() => ctx.controller.activate({ token, password: 'SomeVeryLongPassword123!' }),
    UnauthorizedException);
  assert.equal(ctx.activated, false);
});

test('activation DTO requires long tokens and passwords', () => {
  const dto = Object.assign(new ActivatePatientDto(), { token: 'short', password: 'short' });
  const errors = validateSync(dto);
  assert.ok(errors.some(x => x.property === 'token'));
  assert.ok(errors.some(x => x.property === 'password'));
});

test("reissuing an inactive patient's invite invalidates previous tokens", async () => {
  const { WorkspaceController } = require('../dist/workspace/workspace.controller.js');
  const { Types } = require('mongoose');
  let revoked = false;
  let issued;
  const users = { findOne: () => ({
    select: () => ({ lean: async () => ({ _id: new Types.ObjectId(userId) }) }),
  }) };
  const tokens = {
    updateMany: async (filter, patch) => { assert.equal(filter.purpose, 'patient-invite'); revoked = true; },
    insertOne: async doc => { issued = doc; return { insertedId: new Types.ObjectId() }; },
  };
  const audits = { insertOne: async () => ({}) };
  const c = new WorkspaceController({ db: { collection: name =>
    name === 'AccountTokens' ? tokens : audits } }, users, {});
  const result = await c.reissuePatientInvitation({ session: { userId: '507f1f77bcf86cd799439011' } }, userId);
  assert.equal(revoked, true);
  assert.ok(result.token.length > 40);
  assert.equal(issued.tokenHash, createHash('sha256').update(result.token).digest('hex'));
  assert.ok(issued.expiresAt.getTime() > Date.now());
});

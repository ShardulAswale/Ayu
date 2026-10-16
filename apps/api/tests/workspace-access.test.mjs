import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Types } = require('mongoose');
const { validateSync } = require('class-validator');
const { WorkspaceController } = require('../dist/workspace/workspace.controller.js');
const { FoodEntryDto, PlanEntryDto } = require('../dist/workspace/workspace.dto.js');
const { RolesGuard } = require('../dist/auth/roles.guard.js');

const uid = '507f1f77bcf86cd799439011';
const patient = '507f1f77bcf86cd799439012';
const other = '507f1f77bcf86cd799439013';
const req = { session: { userId: uid, sessionVersion: 1 } };
const query = object => ({ select: () => ({ lean: async () => object }) });

function mockController(role, assigned = false) {
  const users = {
    findById: id => query({ _id: new Types.ObjectId(id), role, active: true, sessionVersion: 1 }),
    findOne: ({ _id }) => query(
      String(_id) === patient || String(_id) === other
        ? { _id, role: 'patient', active: true } : null,
    ),
  };
  const connection = {
    db: {
      collection: () => ({
        findOne: async () => assigned ? { patientId: new Types.ObjectId(patient) } : null,
      }),
    },
  };
  return new WorkspaceController(connection, users);
}

test('patient can only access their own patient identity', async () => {
  const ownPatient = mockController('patient');
  assert.equal(String(await ownPatient.patientId({ session: { userId: patient } })), patient);
  await assert.rejects(() => ownPatient.patientId(req, other), { name: 'ForbiddenException' });
});

test('dietitian requires explicit patient assignment', async () => {
  await assert.rejects(() => mockController('dietitian', false).patientId(req, patient), { name: 'ForbiddenException' });
  assert.equal(String(await mockController('dietitian', true).patientId(req, patient)), patient);
});

test('admin can access valid patients and rejects invalid IDs', async () => {
  assert.equal(String(await mockController('admin').patientId(req, patient)), patient);
  await assert.rejects(() => mockController('admin').patientId(req, 'invalid'), { name: 'BadRequestException' });
});

test('the roles guard rejects a patient impersonating a dietitian', async () => {
  const users = {
    findById: () => query({ active: true, role: 'patient', sessionVersion: 1 }),
  };
  const reflector = { getAllAndOverride: () => ['dietitian'] };
  const guard = new RolesGuard(reflector, users);
  const context = {
    getHandler: () => ({}), getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  };
  await assert.rejects(() => guard.canActivate(context), { name: 'ForbiddenException' });
});

test('invalid food quantity and patient IDs are rejected by DTO validation', () => {
  const food = Object.assign(new FoodEntryDto(), {
    foodName: 'A meal', eatenAt: new Date().toISOString(), quantity: -1, unit: 'g',
  });
  assert.ok(validateSync(food).some(issue => issue.property === 'quantity'));
  const plan = Object.assign(new PlanEntryDto(), {
    patientId: 'not-an-id', title: 'Plan', plannedAt: new Date().toISOString(), status: 'draft',
  });
  assert.ok(validateSync(plan).some(issue => issue.property === 'patientId'));
});

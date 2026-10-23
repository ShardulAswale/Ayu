import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Types } = require('mongoose');
const { validateSync } = require('class-validator');
const { WorkspaceController } = require('../dist/workspace/workspace.controller.js');
const { PatientMessageDto, ClinicalNoteDto, AppointmentEditDto } = require('../dist/workspace/workspace.dto.js');

const patient = '507f1f77bcf86cd799439012';
const other = '507f1f77bcf86cd799439013';
const staff = '507f1f77bcf86cd799439011';
const obj = id => new Types.ObjectId(id);
const query = data => ({ select: () => ({ lean: async () => data }) });
const request = userId => ({ session: { userId, sessionVersion: 1 } });
function make(role, assigned = true) {
  const messages = [], notes = [], audits = [];
  const users = {
    findById: id => query({ _id: obj(id), role, sessionVersion: 1, active: true }),
    findOne: ({ _id }) => query(String(_id) === patient || String(_id) === other
      ? { _id, role: 'patient', active: true } : null),
  };
  const collections = {
    PatientAssignments: { findOne: async () => assigned ? { patientId: obj(patient) } : null },
    PatientMessages: { insertOne: async doc => {
      const insertedId = obj('507f1f77bcf86cd799439099');
      messages.push({ ...doc, _id: insertedId }); return { insertedId };
    }},
    ClinicalNotes: { insertOne: async doc => {
      const insertedId = obj('507f1f77bcf86cd799439098');
      notes.push({ ...doc, _id: insertedId }); return { insertedId };
    }},
    AuditEvents: { insertOne: async doc => { audits.push(doc); return { insertedId: obj('507f1f77bcf86cd799439097') }; } },
    FoodEntries: { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) }) },
  };
  const controller = new WorkspaceController({ db: { collection: name => collections[name] } }, users, {});
  return { controller, messages, notes, audits };
}

test('patient cannot send messages for a different patient', async () => {
  const m = make('patient');
  await assert.rejects(() => m.controller.sendMessage(request(patient), { patientId: other, body: 'Hi' }),
    { name: 'ForbiddenException' });
  assert.equal(m.messages.length, 0);
});

test('unassigned dietitian cannot message or record notes for patient', async () => {
  const m = make('dietitian', false);
  await assert.rejects(() => m.controller.sendMessage(request(staff), { patientId: patient, body: 'Hi' }),
    { name: 'ForbiddenException' });
  await assert.rejects(() => m.controller.addClinicalNote(request(staff), { patientId: patient, title: 'Visit', body: 'Reviewed' }),
    { name: 'ForbiddenException' });
  assert.equal(m.messages.length, 0);
  assert.equal(m.notes.length, 0);
});

test('authorised patient message is scoped and audit logged without storing message contents in audit', async () => {
  const m = make('patient');
  await m.controller.sendMessage(request(patient), { body: '  Discuss next appointment  ' });
  assert.equal(String(m.messages[0].patientId), patient);
  assert.equal(m.messages[0].body, 'Discuss next appointment');
  assert.equal(m.audits[0].action, 'message.sent');
  assert.equal('body' in m.audits[0], false);
});

test('authorised clinician can create private note and audit contains no clinical note text', async () => {
  const m = make('dietitian');
  await m.controller.addClinicalNote(request(staff), { patientId: patient, title: ' Follow-up ', body: ' Plan review ' });
  assert.equal(m.notes[0].title, 'Follow-up');
  assert.equal(m.audits[0].action, 'note.created');
  assert.equal('body' in m.audits[0], false);
});

test('messages, notes and appointment edits enforce length and ID validation', () => {
  const message = Object.assign(new PatientMessageDto(), { body: 'x'.repeat(2001), patientId: other });
  assert.ok(validateSync(message).some(x => x.property === 'body'));
  const note = Object.assign(new ClinicalNoteDto(), { patientId: 'invalid', title: 'x', body: 'content' });
  assert.ok(validateSync(note).some(x => x.property === 'patientId'));
  const edit = Object.assign(new AppointmentEditDto(), { durationMinutes: 5 });
  assert.ok(validateSync(edit).some(x => x.property === 'durationMinutes'));
});

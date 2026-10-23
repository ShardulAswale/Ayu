/**
 * Idempotent index migration for Ayu care workflows.
 * Run manually in an authorised environment: npm --prefix apps/api run db:indexes
 * Never run against unknown databases or in a browser.
 */
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;
if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri) || !/\/Ayu(?:\?|$)/.test(uri)) {
  throw new Error('A MongoDB URI explicitly targeting the Ayu database is required');
}
await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
try {
  const db = mongoose.connection.db;
  if (!db || db.databaseName !== 'Ayu') throw new Error('Unexpected database');
  await db.collection('AccountTokens').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('AccountTokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('PatientProfiles').createIndex({ patientId: 1 }, { unique: true });
  await db.collection('PatientMessages').createIndex({ patientId: 1, createdAt: -1 });
  await db.collection('ClinicalNotes').createIndex({ patientId: 1, createdAt: -1 });
  await db.collection('AuditEvents').createIndex({ patientId: 1, createdAt: -1 });
  await db.collection('FoodEntries').createIndex({ patientId: 1, eatenAt: -1 });
  console.log('Ayu indexes verified (no clinical records changed)');
} finally {
  await mongoose.disconnect();
}

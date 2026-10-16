#!/usr/bin/env node
// Explicitly opt-in, insert-only development seed. Never use for production data.
import { createHmac } from 'node:crypto';
import * as argon2 from 'argon2';
import mongoose from 'mongoose';
import { demoUsers } from './demo-users.mjs';

async function main() {
  const uri = process.env.MONGODB_URI;
  const pepper = process.env.AUTH_PASSWORD_PEPPER;
  const password = process.env.AYU_DEMO_PASSWORD;

  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Demo seeding requires NODE_ENV=development.');
  }
  if (process.env.AYU_DEMO_SEED_CONFIRM !== 'Ayu') {
    throw new Error('Set AYU_DEMO_SEED_CONFIRM=Ayu to acknowledge the target development database.');
  }
  if (!uri || !/^mongodb(\+srv)?:\/\//.test(uri) || !/\/Ayu(?:\?|$)/.test(uri)) {
    throw new Error('MONGODB_URI must explicitly select the Ayu database.');
  }
  if (!pepper || pepper.length < 32) {
    throw new Error('AUTH_PASSWORD_PEPPER must match the API and contain at least 32 characters.');
  }
  if (!password || password.length < 12) {
    throw new Error('Set AYU_DEMO_PASSWORD to a development-only password of at least 12 characters.');
  }
  if (!process.env.AYU_DEMO_SEED_CONFIRM_HOST || !uri.includes(process.env.AYU_DEMO_SEED_CONFIRM_HOST)) {
    throw new Error('Set AYU_DEMO_SEED_CONFIRM_HOST to a distinctive hostname fragment of the intended development MongoDB cluster.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    const users = mongoose.connection.db.collection('Users');
    let inserted = 0;
    let existing = 0;
    for (const { email, role } of demoUsers) {
      const digest = createHmac('sha256', pepper).update(password, 'utf8').digest();
      const passwordHash = await argon2.hash(digest, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
      });
      const now = new Date();
      try {
        const result = await users.updateOne(
          { email },
          {
            $setOnInsert: {
              email, passwordHash, role, active: true, sessionVersion: 0,
              createdAt: now, updatedAt: now,
            },
          },
          { upsert: true },
        );
        if (result.upsertedCount) inserted++;
        else existing++;
        process.stdout.write(`${result.upsertedCount ? 'Created' : 'Skipped existing'}: ${email} (${role})\n`);
      } catch (error) {
        if (error?.code === 11000) {
          existing++;
          process.stdout.write(`Skipped existing: ${email} (${role})\n`);
        } else {
          throw error;
        }
      }
    }
    process.stdout.write(`Done: ${inserted} created, ${existing} already present. No existing users modified.\n`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  process.stderr.write(`Demo seed failed: ${error.message}\n`);
  process.exitCode = 1;
});

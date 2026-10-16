import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RequestHandler } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';

// Use a separate host-only cookie for production to avoid collisions with
// earlier non-partitioned third-party session cookies.
export function sessionCookieName(isProduction: boolean): string {
  return isProduction ? '__Host-ayu.sid' : 'ayu.sid';
}

export function sessionCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' as const : 'lax' as const,
    // Chrome CHIPS: partitions the cookie by top-level Cloudflare site while
    // still allowing it on credentialed calls to the Render origin.
    partitioned: isProduction,
    priority: 'high' as const,
    maxAge: 1000 * 60 * 60 * 8,
    path: '/',
  };
}

export function sessionMiddleware(config: ConfigService): RequestHandler {
  const secret = config.get<string>('SESSION_SECRET');
  const uri = config.get<string>('MONGODB_URI');
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  if (!uri) throw new Error('MONGODB_URI is required for session storage');
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  return session({
    name: sessionCookieName(isProduction),
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    genid: () => randomBytes(32).toString('hex'),
    store: MongoStore.create({ mongoUrl: uri, collectionName: 'Sessions', ttl: 60 * 60 * 8, autoRemove: 'native' }),
    cookie: sessionCookieOptions(isProduction),
  });
}

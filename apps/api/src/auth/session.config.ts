import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RequestHandler } from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';

export function sessionMiddleware(config: ConfigService): RequestHandler {
  const secret = config.get<string>('SESSION_SECRET');
  const uri = config.get<string>('MONGODB_URI');
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  if (!uri) throw new Error('MONGODB_URI is required for session storage');
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  return session({
    name: 'ayu.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    genid: () => randomBytes(32).toString('hex'),
    store: MongoStore.create({ mongoUrl: uri, collectionName: 'Sessions', ttl: 60 * 60 * 8, autoRemove: 'native' }),
    cookie: { httpOnly: true, secure: isProduction, sameSite: isProduction ? 'none' : 'lax', maxAge: 1000 * 60 * 60 * 8, path: '/' },
  });
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { ConfigService } from '@nestjs/config';

/**
 * Binds a logged-in session to the client network address and User-Agent string.
 * req.ip MUST be resolved by Express after a correctly configured trusted proxy.
 * Never use a raw X-Forwarded-For or client-submitted "device" header.
 */
export function requestSignature(req: Request, secret: string): string {
  const ip = req.ip;
  if (!ip) throw new Error('Client IP unavailable');
  const agent = req.get('user-agent') ?? '';
  return createHmac('sha256', secret)
    .update('ayu-session-binding-v1\0')
    .update(ip)
    .update('\0')
    .update(agent)
    .digest('hex');
}

function matches(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === 32 && right.length === 32 && timingSafeEqual(left, right);
}

export function sessionBindingMiddleware(config: ConfigService): RequestHandler {
  const secret = config.get<string>('SESSION_SECRET');
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return (req, res, next) => {
    // Ignore unsigned / anonymous sessions; bind only after successful login.
    if (!req.session?.userId) return next();
    let signature: string;
    try {
      signature = requestSignature(req, secret);
    } catch {
      // Do not permit authenticated requests without a reliable client IP.
      return revoke();
    }
    if (req.session.clientSignature && matches(req.session.clientSignature, signature)) return next();
    return revoke();

    function revoke() {
      // Destroy the *server-side* session, not just the browser cookie.
      req.session.destroy((err: Error | null) => {
        if (err) return next(err);
        res.clearCookie('ayu.sid', {
          httpOnly: true,
          secure: config.get<string>('NODE_ENV') === 'production',
          sameSite: config.get<string>('NODE_ENV') === 'production' ? 'none' : 'lax',
          path: '/',
        });
        res.status(401).json({ statusCode: 401, message: 'Session revoked: client network or device changed.' });
      });
    }
  };
}

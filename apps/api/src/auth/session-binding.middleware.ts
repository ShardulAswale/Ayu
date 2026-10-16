import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { sessionCookieName } from './session.config';
import type { Request, RequestHandler } from 'express';
import type { ConfigService } from '@nestjs/config';

/**
 * Binds a logged-in session to the client network address and User-Agent string.
 * req.ip MUST be resolved by Express after a correctly configured trusted proxy.
 * Never use a raw X-Forwarded-For or client-submitted "device" header.
 */
function resolvedClientIp(req: Request): string {
  const ip = req.ip?.trim();
  if (!ip) throw new Error('Client IP unavailable');
  // Render may expose the same IPv4 address in an IPv4-mapped IPv6 format.
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) return ip.slice(7);
  return ip;
}

function fingerprint(secret: string, context: string, value: string): string {
  return createHmac('sha256', secret).update(context).update('\\0').update(value).digest('hex');
}

export function requestBinding(req: Request, secret: string) {
  const ip = resolvedClientIp(req);
  const agent = req.get('user-agent') ?? '';
  return {
    clientSignature: fingerprint(secret, 'ayu-session-v2-combined', ip + '\\0' + agent),
    clientIpSignature: fingerprint(secret, 'ayu-session-v2-ip', ip),
    clientAgentSignature: fingerprint(secret, 'ayu-session-v2-agent', agent),
  };
}

export function requestSignature(req: Request, secret: string): string {
  return requestBinding(req, secret).clientSignature;
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
    let binding: ReturnType<typeof requestBinding>;
    try {
      binding = requestBinding(req, secret);
    } catch {
      // Do not permit authenticated requests without a reliable client IP.
      return revoke('ip_unavailable');
    }
    if (req.session.clientSignature && matches(req.session.clientSignature, binding.clientSignature)) return next();
    const sameIp = req.session.clientIpSignature && matches(req.session.clientIpSignature, binding.clientIpSignature);
    const sameAgent = req.session.clientAgentSignature && matches(req.session.clientAgentSignature, binding.clientAgentSignature);
    const reason = !req.session.clientSignature ? 'legacy_session' :
      !sameIp ? 'client_ip_changed' : !sameAgent ? 'user_agent_changed' : 'signature_mismatch';
    return revoke(reason);

    function revoke(reason: string) {
      // Diagnostic reason only: never log IP addresses, session IDs or user IDs.
      console.warn('[SessionSecurity] session revoked: ' + reason);
      // Destroy the *server-side* session, not just the browser cookie.
      req.session.destroy((err: Error | null) => {
        if (err) return next(err);
        const production = config.get<string>('NODE_ENV') === 'production';
        res.clearCookie(sessionCookieName(production), {
          httpOnly: true,
          secure: production,
          sameSite: production ? 'none' : 'lax',
          partitioned: production,
          path: '/',
        });
        res.status(401).json({ statusCode: 401, message: 'Session revoked: client network or device changed.' });
      });
    }
  };
}

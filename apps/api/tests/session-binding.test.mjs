import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { requestSignature, requestBinding, sessionBindingMiddleware } = require('../dist/auth/session-binding.middleware.js');
const { sessionCookieName, sessionCookieOptions } = require('../dist/auth/session.config.js');
const secret = 'a-secure-development-only-secret-for-tests-1234';
const config = { get: key => ({SESSION_SECRET:secret, NODE_ENV:'production'})[key] };
const signature = (ip, ua) => requestSignature({ ip, get: () => ua }, secret);
const signatures = (ip, ua) => requestBinding({ip,get: () => ua}, secret);

function dispatch({ ip, agent, stored, authenticated = true, destroyFailure = null }) {
  let destroyed = false, cleared = false, nextCalled = false, error = null;
  const req = {
    ip, get: () => agent,
    session: {
      ...(authenticated ? {userId:'user-123'} : {}),
      ...(stored ? (typeof stored === 'string' ? {clientSignature:stored} : stored) : {}),
      destroy(cb) { destroyed = true; cb(destroyFailure); },
    },
  };
  const res = {
    statusCode: null, body:null,
    clearCookie(name, options) {
      assert.equal(name, '__Host-ayu.sid');
      assert.equal(options.partitioned,true);
      assert.equal(options.secure, true);
      cleared = true;
    },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  sessionBindingMiddleware(config)(req, res, err => {nextCalled = true; error = err;});
  return { destroyed, cleared, nextCalled, error, status: res.statusCode, body:res.body };
}
test('same IP and device signature is accepted', () => {
  const stored = signature('198.51.100.10','Browser A');
  const result = dispatch({ip:'198.51.100.10',agent:'Browser A',stored});
  assert.equal(result.nextCalled, true);
  assert.equal(result.destroyed,false);
});
test('changed IP destroys session and sends 401', () => {
  const stored = signatures('198.51.100.10','Browser A');
  const result = dispatch({ip:'203.0.113.9',agent:'Browser A',stored});
  assert.equal(result.status,401);
  assert.equal(result.destroyed,true);
  assert.equal(result.cleared,true);
});
test('changed user agent destroys session and sends 401', () => {
  const stored = signatures('198.51.100.10','Browser A');
  const result = dispatch({ip:'198.51.100.10',agent:'Browser B',stored});
  assert.equal(result.status,401);
  assert.equal(result.destroyed,true);
});
test('sessions missing the binding are rejected rather than silently grandfathered', () => {
  const result = dispatch({ip:'198.51.100.10',agent:'Browser A'});
  assert.equal(result.status,401);
  assert.equal(result.destroyed,true);
});
test('anonymous CSRF bootstrap proceeds without a signature', () => {
  const result = dispatch({ip:'198.51.100.10',agent:'Browser A',authenticated:false});
  assert.equal(result.nextCalled,true);
});
test('proxy spoof header is not trusted', () => {
  const req = {ip:'198.51.100.10',get:()=> 'Browser A',headers:{'x-forwarded-for':'203.0.113.200'}};
  assert.equal(requestSignature(req,secret),signature('198.51.100.10','Browser A'));
});
test('failed session store revocation blocks request and forwards error', () => {
  const err=new Error('store unavailable');
  const result=dispatch({ip:'203.0.113.9',agent:'Browser A',stored:signature('198.51.100.10','Browser A'),destroyFailure:err});
  assert.equal(result.nextCalled,true);
  assert.equal(result.error,err);
  assert.equal(result.status,null);
});

test('production cookie is host-only, secure and partitioned for cross-site Chrome', () => {
  assert.equal(sessionCookieName(true), '__Host-ayu.sid');
  assert.deepEqual(
    [sessionCookieOptions(true).secure, sessionCookieOptions(true).partitioned, sessionCookieOptions(true).sameSite,sessionCookieOptions(true).httpOnly,sessionCookieOptions(true).path],
    [true,true,'none',true,'/'],
  );
});
test('development cookie remains lax and non-partitioned', () => {
  assert.equal(sessionCookieName(false),'ayu.sid');
  assert.equal(sessionCookieOptions(false).partitioned,false);
  assert.equal(sessionCookieOptions(false).sameSite,'lax');
});
test('IPv4 and IPv4-mapped IPv6 produce the same signature', () => {
  assert.equal(signature('198.51.100.10','Browser A'),signature('::ffff:198.51.100.10','Browser A'));
});

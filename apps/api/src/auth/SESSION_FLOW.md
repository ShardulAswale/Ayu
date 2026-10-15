# Session authentication flow

1. Browser requests `GET /auth/csrf` with `credentials: 'include'`. Server establishes an anonymous MongoDB-backed session and returns a CSRF token.
2. Browser sends `POST /auth/login` with JSON email/password, `credentials: 'include'`, and `x-ayu-csrf` header.
3. On success, server regenerates the session ID, saves the authenticated user ID and session version, and rotates the CSRF token.
4. Browser requests `GET /auth/me` with credentials. Server validates active user and session version from MongoDB on every request.
5. Browser sends `POST /auth/logout` with the current CSRF token to destroy the server session.

Never persist the CSRF token in localStorage; keep it in application memory and obtain a fresh one after a reload.

## Required release gates

- Verify build and automated integration tests for login success/failure, CSRF rejection, session fixation, expiration, logout, inactive users, and sessionVersion revocation.
- Add account-aware login throttling with a shared/distributed rate limiter before any public deployment. Current in-memory per-IP throttling is only a development baseline.
- Add strict production proxy and cookie configuration appropriate to actual deployment topology. Cross-site frontend/API deployments may require SameSite=None; Secure and additional CSRF/origin protections.
- Enforce user-role and patient-resource authorization on each future protected endpoint; `/auth/me` is identity-only.
- Add safe audited account provisioning and pepper rotation procedures.
- Set `SESSION_SECRET`, `AUTH_PASSWORD_PEPPER`, `MONGODB_URI`, and `CORS_ORIGINS` in the backend secret manager.
- Use synthetic test accounts only. Do not enable public signup.
- MFA is deferred.

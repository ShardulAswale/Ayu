# Authentication security requirements

This milestone introduces user schema and Argon2id password primitives only. **No login, signup, password reset, or authenticated patient endpoints are enabled.**

Before enabling login:
- Use server-side sessions in MongoDB (never MemoryStore in production); regenerate session ID on login, rotate on privilege changes, destroy on logout, and expire sessions server-side.
- Require an independent, high-entropy `SESSION_SECRET` and `AUTH_PASSWORD_PEPPER` supplied by the backend secret manager. Never expose either in Vite variables.
- Use HttpOnly, Secure, SameSite cookies, trusted reverse proxy configuration, and an explicit session lifetime.
- Enforce CSRF protection on state-changing endpoints and strict CORS origin allowlists.
- Rate-limit login and password recovery by IP and account, with generic failure responses and audit events.
- Check active user, role, session version, and resource ownership on **every** protected request; deny access by default.
- Do not permit public admin account creation. Use an audited provisioning workflow.
- Define password change/reset, session revocation, pepper rotation, and account lockout procedures.
- Use only synthetic test identities. Do not log passwords, hashes, peppers, tokens or session IDs.
- MFA support is deferred.

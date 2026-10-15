# Ayu API foundation

NestJS API for the Ayu development environment. No patient records or authentication endpoints are implemented in this milestone.

## Local setup

1. Copy `.env.example` to `.env` and set a restricted MongoDB Atlas URI and trusted CORS origins.
2. Run `npm install` in `apps/api`.
3. Run `npm run dev`.
4. Verify `GET /health` and `GET /health/ready`.

Never commit `.env`, passwords, peppers, or real patient information. Use synthetic data only.

The production host must enforce HTTPS. Authenticated routes will require CSRF defenses, rate limiting, audit logs, role-based authorization and secure server-side sessions before activation. MFA remains deferred.

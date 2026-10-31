# Booking, payments and consultation integration — implementation backlog

Status: design / implementation pending. No API keys or patient data in this PR.

## Scope for a single cohesive implementation PR
- Consultation catalogue: duration, INR pricing, availability rules, cancellation policy.
- Slot availability: Google Calendar free/busy with OAuth2 offline consent; store refresh token only on backend; timezone-aware IST slots.
- MongoDB booking model: pending_payment, confirmed, cancelled, expired, payment_failed; unique slot reservations and expiry.
- Razorpay Orders API and Checkout: create orders server-side; verify checkout signature server-side; validate webhook signatures against raw body; deduplicate events; reconcile failed callbacks.
- Confirmation worker: only after verified payment, create Google Calendar event and Meet conference; store event ID and join URL; retry safely.
- Client/admin views: choose slot, pay, see status, reschedule/cancel; admin availability and appointment management.
- Notifications: confirmation and reminders; minimum necessary client data shared with Google.
- Security: authorization, rate limiting, encryption/secret handling, audit logs, consent and retention policies.

## Environment configuration (Oracle backend runtime only)
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, GOOGLE_CALENDAR_ID, APP_BASE_URL. Use test-mode credentials first. Never commit values.

## Acceptance tests
- Slot collision cannot result in two confirmed appointments.
- Unpaid/failed/expired orders never create Meet appointments.
- Replayed payment webhook cannot duplicate a booking or event.
- OAuth token refresh and Google API outage recover safely.
- Calendar events created once after verified payment.
- INR amount and payment status verified server-side.
- Sensitive health records never enter payment metadata or calendar description.
- Cancellation/refund policy and audit events tested.

## Dependencies / decisions
- Verify Razorpay onboarding and settlement eligibility for Shruti's Indian bank account; do not assume savings-account acceptance.
- Configure Google Cloud OAuth consent, Calendar API and account authorization.
- Confirm deployed source location and existing MongoDB schema, backend API and deployment pipeline before implementation.
- Confirm booking durations, working hours, cancellation rules and whether deposits or full payment are required.

## Keep outside this PR
- CGM integration, meal recognition, nutrition analytics, medical-record redesign, and Google Workspace migration. These require separate reviews and tests.

## Implementation checklist
- [ ] Locate deployed API source and current schemas
- [ ] Implement backend and migrations
- [ ] Implement checkout and booking UI
- [ ] Add integration tests and sandbox fixtures
- [ ] Configure runtime secrets on Oracle
- [ ] Test sandbox end-to-end and complete security review

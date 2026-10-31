# Scheduling, payments and notifications — consolidated implementation plan

## Evidence and baseline (31 October 2026)
- Reviewed Ayu project conversation history and `dev` branch README, NestJS `apps/api/src/app.module.ts`, and React `apps/web/package.json`.
- Existing foundation: React dashboard routes for admin/dietitian/patient, NestJS/Mongoose API, MongoDB Atlas, Cloudflare frontend, Dockerized Oracle AMD API. Prior chat reports API container healthy and `/auth/csrf` HTTP 200 on 28 October; this is not a fresh live verification.
- Existing dashboard appointment/messages/notes/plans UI reported in previous chats; exact implementation completeness and current deployed state require code and UI tests.
- Preserve soft deactivation only for participants; never hard-delete participant records.
- Source of truth for feature branches and PRs is `dev`, not `main`. PR #37 is planning-only against `main` and must not be treated as implemented.

## Delivery sequence (separate bounded implementation PRs)
1. Notifications foundation: MongoDB notifications collection, authenticated endpoints, admin and customer bell in top-right header near account/sign-out, unread badge, dropdown, notification centre, read/unread controls, accessible keyboard/mobile UI, role/recipient scoping, pagination and indexes.
2. Booking core: consultation catalogue, configurable durations, practitioner availability, IST timezone conversions, booking states, slot holds, collision-proof reservation and expiry.
3. Google integration: least-privilege OAuth, calendar free/busy, event creation with Google Meet, refresh/retry and cancellation reconciliation. Share minimal client data.
4. Razorpay integration: server-created INR orders, Checkout, HMAC signature verification, signed webhooks, deduplication, payment reconciliation, refund policy. Merchant KYC and settlement eligibility are external prerequisites.
5. Event-driven notifications: booking requested/confirmed/changed/cancelled, payment success/failure/refund, consultation reminders (e.g. 24h and 1h), practitioner daily schedule and actionable admin alerts; user notification preferences and quiet hours.
6. Hardening: monitoring, audit trail, accessibility, consent/retention, test coverage, staged rollout.

## MongoDB notifications collection
```ts
{
  _id: ObjectId,
  recipientUserId: ObjectId,
  actorUserId?: ObjectId,
  audience: 'admin'|'dietitian'|'patient',
  type: 'booking.created'|'booking.confirmed'|'booking.cancelled'|'booking.rescheduled'|'payment.succeeded'|'payment.failed'|'payment.refunded'|'appointment.reminder'|'system.alert',
  title: string,
  body: string, // no clinical details or sensitive payment data
  entityType?: 'appointment'|'payment'|'system',
  entityId?: ObjectId,
  actionUrl?: string, // validated internal route
  readAt?: Date,
  createdAt: Date,
  expiresAt?: Date,
  dedupeKey?: string,
  delivery: { inApp: 'pending'|'delivered', email?: 'pending'|'sent'|'failed' }
}
```
Indexes: `{recipientUserId:1,createdAt:-1}`, `{recipientUserId:1,readAt:1,createdAt:-1}`; unique partial `dedupeKey`; TTL only for eligible nonessential notifications after an approved retention period. Keep separate durable audit records.

## API contracts
- GET /notifications?cursor=&unreadOnly=; GET /notifications/unread-count
- PATCH /notifications/:id/read; POST /notifications/read-all
- GET/PATCH /notification-preferences
All require authenticated sessions, CSRF for writes, strict recipient authorization, and rate limits. Never accept recipient identity from the browser as authority.

## UI acceptance criteria
- Bell appears in both admin and customer header immediately beside the existing account/sign-out controls.
- Unread count remains consistent across reloads and devices.
- Dropdown shows recent notifications with date, type, and safe internal link; full centre supports pagination and filters.
- Empty/loading/error states, screen-reader labels, focus handling, mobile layout.
- Polling initially (e.g. 30–60s) with manual refresh; WebSocket/SSE only if justified later.

## Integration and reliability acceptance criteria
- No double bookings; timezone/DST tested for India and overseas clients.
- No confirmed appointment or Meet link before verified payment.
- Replayed Razorpay webhooks do not create duplicate bookings or notifications.
- Notification delivery failures do not roll back successful payments.
- Reschedule/cancel workflows update Google Calendar and notifications reliably.
- Tests for role isolation, inaccessible patient data, disabled users, retry behaviour, email opt-in, and accessibility.
- No secrets or health data in GitHub; runtime secrets remain in approved Oracle environment configuration after live verification.

## Follow-up decisions
- Consultation durations/prices, lead time, working days, buffer, cancellation/refund rules.
- Email versus in-app only for launch; reminder timing and preferred locale/timezone.
- Whether payments are required to hold every slot.

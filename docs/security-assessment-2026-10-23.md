# Ayu — Security assessment and release gates

**Assessment date:** 23 October 2026  
**Scope:** Feature branch `feature/core-care-workflows-security` and existing `dev` architectural controls.  
**Method:** Source review, role/assignment regression tests, invitation abuse-case tests, TypeScript compilation, npm production dependency audit (high+), GitHub CodeQL, and an OWASP ZAP passive baseline workflow (report not verified at the time of writing).

**This is NOT a production penetration-test certificate or GDPR compliance determination.** No authenticated destructive tests and no tests with real patient data were performed.

## Data and trust boundaries
- Browser (Cloudflare-hosted frontend) -> Render NestJS API -> Atlas MongoDB.
- Sensitive records: patient identity, clinical notes, food logs, care-team messages, appointments, progress and audit metadata.
- Requests authenticate using HttpOnly session cookies; writes use CSRF tokens. Server enforces role and patient-assignment scope.
- External email, calendar, CGM, AI image models and data providers are not wired to these new features.

## Controls implemented in the branch
1. **Invitation-only onboarding.** Admin generates 256-bit single-use invitation; SHA-256 hash stored (not raw token), 48-hour expiry, rate-limited anonymous activation protected by CSRF. User chooses password; Argon2id hashing with configured pepper. Atomic token claim prevents reuse. No automatic login on activation.
2. **Messaging.** Authenticated patient/team messages; patient self-scope and assigned-clinician scope enforced through common `patientId` policy. Text-only, max 2,000 chars and write rate-limited.
3. **Private clinical notes.** Practitioner-only read and create routes with assigned-patient checks; record access and creation write audit metadata. Notes are never returned in patient messaging or patient profile routes.
4. **Patient profile.** Patients may edit only their own non-clinical name/time-zone fields; staff read requires patient authorization.
5. **Report.** Nutrition totals count only recorded known nutrient values, never invent missing numbers. Date range bounded to 7, 30, 90 days. Export includes numerical aggregates only.
6. **UI.** React text nodes escape message and note text. No HTML/markdown execution or remote attachment rendering added.
7. **Automated gates.** API & frontend build/typecheck, care authorization tests, invite replay/expiry tests, dependency audit, CodeQL SAST.

## Observed or unresolved risks

| Severity | Risk | Required remediation |
|---|---|---|
| **Release blocking** | No documented clinical data retention/deletion/export procedure; soft deletion retains records. | Approved retention schedule, complete data-subject request/export/erasure workflow and verification tests. |
| **Release blocking** | No privacy notice versioning, lawful-basis mapping, DPIA/clinical consent review or processor agreements verified. | Formal compliance review before storing real patient medical information. |
| **High** | No MFA for staff/admin or complete password-recovery flow. | MFA, safe account recovery and administrator recovery process. |
| **High** | No independently validated Atlas backup/restore, disaster recovery or production secret rotation. | Restore drill, least-privilege database roles, secrets audit. |
| **High** | Clinical messages and notes rely on platform/database encryption; application-level encryption and log redaction have not been fully verified. | Verify transport, encryption-at-rest policy, cloud access, app/infra log redaction. |
| **High** | Full browser-based auth/CSRF/session binding and horizontal-IDOR suite has not been run against a staging environment. | Authenticated cross-role DAST and E2E regression test on synthetic data. |
| **Medium** | Invitations are manually copied by admins pending secure email delivery. | Use trusted email provider, no links in server or third-party analytics logs. |
| **Medium** | Token TTL/unique indexes and new collection indexes require the idempotent migration. | Run `npm --prefix apps/api run db:indexes` with a reviewed Atlas connection. |
| **Medium** | Messaging currently only returns the most recent 100 messages, no cursor pagination or edit/delete/redaction workflow. | Cursor pagination and a retention/redaction policy. |
| **Medium** | Nutrient report caps rows at 2,500; values are UTC-dated and may omit entries beyond cap. | Aggregation pagination, patient time-zone reports and clear completeness semantics. |
| **Medium** | No media upload pipeline yet; future image upload requires AV, MIME verification, object access, size limits and EXIF removal. | Design and test secure storage before permitting patient images. |
| **Medium** | Patient invitations cannot currently be safely reissued through the UI. | Expire old tokens and create controlled invitation recovery. |

## Security test plan after merging/deploying to a TEST environment
- Create synthetic patients A and B, assigned/unassigned clinicians and admin.
- Probe every patient-scoped GET/POST/PATCH/DELETE with another patient's ID; require 403/404 and no side effects.
- Verify unauthenticated 401; wrong-role 403; CSRF-less writes blocked; expired/inactive sessions rejected.
- Attempt invitation replay, expired token, token mismatch, brute-force threshold, duplicate email, soft-deleted account.
- Check content-length boundaries, malformed JSON/ObjectIds, reflected/stored XSS strings in React and CSV.
- Inspect actual response headers, CORS allowed origins, cookie `Secure`/`HttpOnly`/`SameSite` and cache-control.
- Run OWASP ZAP passive baseline (unauthenticated first) and authenticated **staging-only** scan using synthetic data.
- Verify exports/erasure and backup restore under approved retention obligations.

## Releasing to production
1. Complete CI and review all CodeQL/dependency findings.
2. Execute Mongo index migration and verify indexes.
3. Connect approved email delivery and review all clinic-facing wording.
4. Implement and validate legal privacy/consent/data-rights requirements.
5. Test complete patient and practitioner journeys, session boundaries and disaster recovery.
6. Deploy to test with synthetic data, execute authenticated security review, obtain clinical and product sign-off.

Do not create real-patient accounts until all release-blocking controls are resolved.

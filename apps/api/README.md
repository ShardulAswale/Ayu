# Ayu API

NestJS API with secure sessions, role-based access and nutritional care workspaces.

## Local setup

1. Copy `.env.example` to `.env` and supply a development-only MongoDB URI selecting the `Ayu` database, a unique password pepper, and allowed CORS origins. Never put secrets in Git or frontend environment variables.
2. Run `npm install` from `apps/api`.
3. Run `npm run dev`.
4. Verify `GET /health` and `GET /health/ready` and log in with a **separately provisioned** development account. Ayu does not contain a test-user seeder.

## Authenticated nutrition workspaces

All `/workspace/*` routes require an authenticated, active session validated by `RolesGuard`. Mutating routes also require the session's `x-ayu-csrf` token from `GET /auth/csrf`.

| Endpoint | Access and behavior |
| --- | --- |
| `GET /workspace/stats?offset=<minutes>` | Per-role real counts; offset is the browser's `Date.getTimezoneOffset()` |
| `GET /workspace/patients` | Admin: active patients; dietitian: active assigned patients only |
| `GET /workspace/dietitians` | Admin only |
| `POST /workspace/assignments` | Admin assigns an active dietitian to an active patient |
| `GET /workspace/entries?patientId=&from=&to=` | Patient's own diary; dietitians only assigned patients; admins authorized patients |
| `POST/PATCH/DELETE /workspace/entries` | Patient's own food entries only; entry timestamp, food, quantity and optional recipe |
| `GET /workspace/recipes` | All authenticated roles |
| `POST/PATCH/DELETE /workspace/recipes` | Admin/dietitian manage the shared recipe library |
| `GET /workspace/plans?patientId=&from=&to=` | Patient sees published plans only; assigned practitioners see drafts too |
| `POST/PATCH/DELETE /workspace/plans` | Admin/dietitian edit assigned patient's calendar recommendations |
| `GET /workspace/appointments` | Patient: own; dietitian: own; admin: all (with optional patient scope) |
| `POST/DELETE /workspace/appointments` | Authorized staff schedule and remove appointments |
| `GET/POST /workspace/progress` | Read within patient scope; patient writes own measurements |
| `GET/PUT /workspace/layout` | Practitioner saves order and visibility of approved dashboard widgets |

The server chooses the effective role from the current session's database user record. Dietitian access to patient-scoped resources requires a `PatientAssignments` record and cannot be bypassed by guessing patient IDs. Food entry and plan records are individually ownership-checked for mutations.

New collections are created by MongoDB on first authorized write: `PatientAssignments`, `FoodEntries`, `Recipes`, `DietPlans`, `Appointments`, `ProgressEntries`, `DashboardLayouts`. The existing `Users` collection is unchanged.

Nutrition fields on a recipe represent **one standard serving**. Logging multiple recipe servings snapshots nutrients multiplied by quantity. A manually logged food without a linked recipe has **unknown** nutritional values; the UI displays this explicitly instead of inventing calorie or macro numbers. Plans are separate from consumed food entries.

When no records exist, the dashboard shows zero counts and contextual empty states. API errors are displayed rather than disguised as zero.

## Checks

Run `npm run typecheck`, `npm run build`, and `npm run test:workspace`. Validate against an isolated development database with all three roles, including attempts to read an unrelated patient or mutate another patient's resource. API audit failures must be addressed before production deployment.

## Deliberately deferred

Clinical notes and sensitive clinical measurements require further privacy/storage design, retention policy and audit trail; do not treat this implementation as a production clinical records system. AI food recognition, photo uploads, CGM, real-time messaging, report export and external calendar integrations are not yet implemented. Use HTTPS, least-privilege MongoDB credentials, backups, server-side monitoring and restricted CORS origins.

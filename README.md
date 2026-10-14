# Ayu

Ayu is a local-first nutrition and patient-management platform for Dietitian Shruti Aswale.

## Product direction

The platform is being designed around two primary experiences:

- **Dietitian/Admin:** patient management, appointments, notes, recipes, nutrition review, CGM review, reports, and practice operations.
- **Patient/Customer:** secure access, meal logging, local AI-assisted food recognition, nutrition tracking, CGM integration, appointments, and shared recommendations.

### Privacy principle

Clinical data, meal images, nutrition analytics, CGM data, and AI inference should remain local/private wherever technically possible. External services such as Google Meet, Google Calendar, email, or CGM-provider APIs must be treated as explicit integration boundaries and receive only the minimum data required.

---

## SDLC

Ayu follows a controlled Software Development Life Cycle:

1. **Requirements** — define the business requirement, acceptance criteria, privacy/security impact, and dependencies.
2. **Design** — confirm architecture, data model, API contracts, UI/UX, and threat considerations.
3. **Implementation** — develop on an isolated feature branch.
4. **Verification** — run linting, automated tests, security checks, and feature-specific validation.
5. **Review** — review code and acceptance criteria before integration.
6. **Integration** — merge the completed, reviewed and verified feature into `dev`.
7. **Testing/Release** — deploy the integrated `dev` branch to the development environment after CI succeeds. `test` and `prod` branches are reserved for later release workflows.
8. **Operations** — monitor, document, and maintain released functionality when deployment begins.

---

## Branch strategy

Long-lived branches:

- `main` — documentation/bootstrap baseline; no feature merges during the current phase.
- `dev` — active feature integration branch and source for development deployments.
- `test` — reserved QA/UAT branch; leave untouched for now.
- `prod` — reserved production branch; leave untouched for now.

### Feature development

Every feature must be developed in its own branch created from the latest `dev`.

Naming convention:

```text
feature/<short-feature-name>
```

Examples:

```text
feature/authentication
feature/admin-dashboard
feature/patient-meal-log
feature/local-food-ai
feature/cgm-integration
```

Required flow:

```text
dev
  └── feature/<feature-name>
          ├── implementation
          ├── tests
          ├── review
          └── pull request and merge back to dev
```

For the current phase, do **not** promote changes to `main`, `test` or `prod`. Deploy only from `dev`, with CI success required. The deployment workflow will be implemented once a hosting target and credentials are selected.

---

## Engineering rules

- Never develop a product feature directly on `main` or `dev`.
- Keep feature branches focused on one bounded change.
- Require a pull request to `dev`, code review, passing lint/type checks, relevant unit/integration tests, and security checks before merging.
- Run deployment only after the merge to `dev` and successful post-merge checks; never deploy from an unreviewed feature branch.
- Keep `main`, `test` and `prod` unchanged until an explicit release-strategy decision.
- Define acceptance criteria before implementation.
- Add or update automated tests with each feature.
- Do not commit credentials, API keys, connection strings, tokens, or patient data.
- Configuration must come from environment variables.
- Secrets must be stored in an approved secret store such as GitHub Actions secrets/environment secrets and injected at runtime.
- Keep `.env` files local and excluded from source control when application code is introduced.
- Apply least-privilege access to external integrations.
- Treat patient and CGM information as sensitive health data.
- Require explicit consent and auditable access for health-data integrations.
- Prefer deterministic nutrition calculations from structured food/recipe data; AI should assist recognition rather than invent clinical values.

---

## Initial architecture scope

Planned capability areas include:

- Authentication and role-based access
- Dietitian/admin dashboard
- Patient dashboard
- Patient records
- Appointments and Google Meet integration
- Shared and practitioner-only notes
- Meal photo capture
- Local AI food recognition
- Food and recipe database
- Nutrition calculation
- CGM integration
- Combined meal + glucose timelines
- Reports and progress tracking
- Privacy, consent, audit, and integration controls

Architecture and implementation decisions will evolve through feature-level SDLC work.

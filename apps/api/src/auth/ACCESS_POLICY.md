# Patient access policy

This change introduces authorization primitives, not patient endpoints.

- **Admin** may access patient records within the practice, subject to future tenant scoping.
- **Dietitian** may read patient records and edit plans only when a verified patient assignment matches their authenticated user ID.
- **Patient** may read only their own patient record. Patients cannot edit clinician-managed diet plans.
- Every protected endpoint must use an authenticated session and an explicit role policy. Missing role metadata is denied by default by `RolesGuard`.
- Resource access must be checked against trusted database fields, not a patient ID, role or assignment supplied by the browser.
- A future multi-practice deployment must add tenant scoping to every query, including admins, before handling real data.

## Integration gate

These helpers are not automatically applied to future routes. Route owners must wire guards and call patient access checks **after loading assignment information from the database**. Add tests for cross-patient access, unassigned dietitians, inactive users, revoked sessions, missing role metadata and role changes. No real patient data is permitted.

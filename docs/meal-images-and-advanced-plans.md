# Ayu: Private Meal Photographs, Local Recognition and Advanced Diet Plans

## Scope and maturity
This change supplies executable groundwork, not clinical production sign-off. It does **not** bundle an AI model, connect a commercial vision service, or give clinical dietary advice.

### Meal-image data flow
1. A patient creates a food diary entry. Images belong to existing entries, not unsaved forms.
2. In the browser, the selected JPEG/PNG/WebP (maximum 5 MB) is decoded and re-encoded to WebP at up to 1,024 pixels, stripping browser-side EXIF/GPS metadata.
3. The same transformation is independently enforced on the API using **Sharp**, validating actual content rather than trusting the filename/MIME. The server caps input bytes (5 MB), pixels (20 million) and stored WebP bytes (2 MB).
4. Sanitised WebP bytes are stored in MongoDB Atlas private GridFS bucket `PrivateMealImages` with patient and entry references; no public URL or raw original photo is stored.
5. Access to the photo requires an authenticated session and checks the entry's patient owner or the clinician's patient assignment. Admins can view a patient's image. Upload, replace, deletion and local recognition requests require patient ownership and CSRF.
6. The image is served with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`; client uses an authenticated Blob URL which is revoked when the component unmounts.
7. Deleting a meal entry deletes the linked GridFS file. **Soft-deleting a patient does not erase clinical records or photos**; clinician-approved retention/erasure controls are still required.

**Storage caveat:** Atlas is cloud-based private storage, *not on-device storage*. Image bytes leave the patient's device to reach the configured Ayu backend. Review region, encryption keys, processor terms, backups and legal basis before storing actual patient photographs.

### Recognition connector contract (disabled by default)
The API will only call a service configured via `AYU_LOCAL_VISION_URL` when it points to loopback (`http://127.0.0.1:<port>/...`, `http://localhost:<port>/...` or IPv6 loopback). It **never** sends images to a third-party recognition service or accepts a URL supplied by the patient. The HTTP request is a POST containing sanitized `image/webp` bytes. It times out after 8 seconds and forbids redirects.

The model response must be small (at most 16 KB) JSON:
```json
{
  "candidates": [
    {"label": "Poha", "confidence": 0.84},
    {"label": "Upma", "confidence": 0.12}
  ]
}
```
Only 0–1 scores and <=120-character labels are accepted, at most five suggestions. The user must explicitly choose a label; calorie estimates, health conclusions and ingredient quantities are never generated from recognition output.

**Required later:** choose/test a properly licensed Indian-food-aware recognition model; deploy it on the same trusted host (loopback) with resources and CPU/GPU limits, model version tracking, inference logs without images, dataset bias evaluation, accuracy thresholds, and clinically reviewed failure handling. Until this service is configured the UI reports that local recognition is unavailable; users can log foods manually.

### Advanced weekly plan workflows
- Dietitians/admins can save up to 28 recommendations from the current week as a practitioner-owned template.
- Templates can be reused for a selected patient and selected week, **always creating drafts**.
- A week can be duplicated into another week, again **as drafts**. Duplicate planned time+name combinations are skipped in normal sequential use; simultaneous batch requests need stronger server-side idempotency before production.
- An explicit confirmation is required to publish the selected week's drafts.
- Individual edits and week publishing create plan revision documents for authorised practitioner inspection.
- Date/time scheduling is currently explicit **UTC**; patient-facing local time zones and daylight-saving time-aware recurrence remain future work.

### Mandatory review gates
- Run `npm --prefix apps/api run db:meal-plan-indexes` only after reviewing Atlas credentials and indexes.
- Verify private read/write/delete and cross-patient access restrictions in a seeded *test* database.
- Verify file-size limits, spoofed MIME, SVG/polyglots, decompression bombs, GPS EXIF stripping, concurrent replace/delete races, orphan cleanup, and safe download headers.
- Review sharp/libvips advisories and refuse release if `npm audit --omit=dev --audit-level=high` fails.
- Check plan cloning around midnight, weekends, timezone boundaries, DST, multiple clinicians, duplicate runs, and patient activation/deactivation.
- Perform clinical and privacy review (consent, retention, erasure, data rights) before patient data.
- Run authenticated OWASP ZAP testing **only in staging using synthetic patients**, after merging and deploying a reviewed build.

## Deferred improvements
A quota for stored images per user, secure anti-malware processing where needed, attachment retention/erasure process, request-wide content limits, transactional upserts for concurrent plan batches, historical snapshots for deleted plans, API pagination, and patient-local time-zone plan scheduling are not yet production hardened.

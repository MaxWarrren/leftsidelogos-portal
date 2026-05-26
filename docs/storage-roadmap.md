# Storage Roadmap

This document tracks the canonical Supabase Storage layout for Left Side Logos
and the migration plan for cleaning up legacy buckets.

> Project: `LeftSideLogos-Portal` (`fijepyoxxfjjyynuwdmr`)

---

## Canonical bucket map

| Bucket               | Public | Use                                                              | Path pattern                                                                                                                       |
| -------------------- | ------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `product-images`     | yes    | Catalog photos (admin-managed)                                   | `ssa/{styleId}/{timestamp}/{color}/{angle}.{ext}` <br/> `products/{slug}/{colorSlug}/{filename}`                                   |
| `organization-assets`| no     | Per-org media (Brand Assets, Mockups, Final Designs)             | `{orgId}/Brand Assets/{filename}` <br/> `{orgId}/Mockups/{filename}` <br/> `{orgId}/Final Designs/{filename}`                      |
| `contracts`          | yes    | Signed PDFs                                                      | `{orgId}/{timestamp}.pdf`                                                                                                          |
| `leads-attachments`  | yes    | Pre-conversion lead uploads (Website OrderBuilder)               | `leads/{leadId}/{filename}` (going forward) <br/> Legacy: flat `{timestamp}-name.ext` + `mockups/...` + `order-attachments/...`    |
| `user-uploads`       | yes    | **DEPRECATED** — being merged into `organization-assets`         | `{userId}/mockup-logos/{filename}`                                                                                                 |

### Bucket-level rules

- **`organization-assets` is the canonical brand-asset bucket.** MockupStudio
  uploads, MediaPicker reads, and admin-managed Brand Assets all live here.
  RLS: any `organization_members` member of `{orgId}` may read/write that
  org's prefix.
- **Never write to `user-uploads` from new code.** Code paths that used to
  upload there (e.g. MockupStudio's saved logos) now route to
  `organization-assets/{orgId}/Brand Assets/mockup-{userId}-{ts}-{name}.{ext}`.
- **`leads-attachments` writes go under `leads/{leadId}/`.** The flat-rooted
  legacy files will be moved under `leads/legacy/` in a one-off cleanup.
- **`product-images`** has an empty placeholder folder (`products/.emptyFolderPlaceholder`)
  that should be removed during the next cleanup pass.

---

## Migration plan

### `user-uploads` deprecation (queued for after Phase 3 ships)

1. **Verify the new MockupStudio upload path works end-to-end** — confirm
   uploads land in `organization-assets/{orgId}/Brand Assets/...` and a row
   appears in `public.media_items` with `category='Brand Assets'`.
2. **Run `Portal/scripts/migrate-user-uploads.ts`** (currently a stub) to
   copy the 10 legacy files into their owners' org buckets.
3. **Confirm in the Supabase Storage UI** that every copied file is present
   under its new path and that a matching `media_items` row exists.
4. **Drop the `user-uploads` bucket** along with its 3 RLS policies
   (`user_uploads_read_public`, plus the insert/update policies).
5. **Remove any remaining `user-uploads` string references** from the codebase
   (grep the Portal + Website repos for the literal `'user-uploads'`).

### `leads-attachments` flat-file cleanup (separate one-off)

Move every object at the bucket root (matching `^[0-9]+-.*$`) into
`leads/legacy/{originalName}`. No code reads these paths directly, but
preserving them under a known prefix keeps the audit trail intact while
freeing up the root for the new `leads/{leadId}/` convention.

### `product-images` cleanup

Delete `products/.emptyFolderPlaceholder` — it was a Supabase Studio artifact
from when the prefix was first created.

---

## Related migrations

| Date              | Migration name                  | Notes                                                                  |
| ----------------- | ------------------------------- | ---------------------------------------------------------------------- |
| 2026-05-26        | `tighten_org_user_cascades`     | Org/user FK chain so deletes don't fail; unrelated to storage but ran in the same round. |
| _Pending_         | `cleanup_user_uploads_bucket`   | Drops the bucket + policies once the migration script confirms files moved. |
| _Pending_         | `cleanup_leads_attachments_root`| Moves flat-rooted legacy files under `leads/legacy/`.                  |

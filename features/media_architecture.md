# Portal — Media & Files Feature Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** File storage, media gallery, and document/contract management.

---

## Overview

The Portal has two related but distinct file management systems:
1. **Media Hub** — Brand assets, mockups, and design files (organized by category)
2. **Document Vault** — Contracts, invoices, and legal documents (with status tracking)

---

## Routes

| Route | Role | Description |
|---|---|---|
| `/(dashboard)/media/page.tsx` | Customer | View and upload org media assets |
| `/admin/media/page.tsx` | Admin | Global media management across all orgs |
| `/admin/files/page.tsx` | Admin | Contracts and document management |

---

## Media Hub

### Component: `components/media/media-gallery.tsx` (~28KB)

A full-featured media gallery with:
- **Categorized folders:** Brand Assets, Mockups, Final Designs
- **Upload:** Clients upload brand assets; Admins upload mockups/deliverables
- **Download:** Both roles can download files
- **Preview:** Image previews with metadata (size, type, upload date)
- **Organization scoping:** Files isolated by `organization_id`

### Storage

Uses **Supabase Storage** buckets:
- Files are organized by organization ID within buckets
- Access controlled by Supabase Storage policies
- `formatBytes()` utility (`lib/utils.ts`) renders file sizes

---

## Document Vault

### Data Model (`contracts` Table)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Document identifier |
| `organization_id` | UUID | Owning organization |
| `title` | TEXT | Document name |
| `type` | TEXT | Category (invoice, contract, agreement) |
| `status` | TEXT | Current state |
| `created_at` | TIMESTAMPTZ | Upload/creation time |

### Document Statuses
| Status | Meaning | Badge Color |
|---|---|---|
| `pending` | Awaiting action | Amber |
| `unpaid` | Invoice not yet paid | Orange/Red |
| `paid` | Invoice paid | Green |
| `completed` | Fully executed | Green |

### Customer View
- Dashboard "Pending Files" card shows contracts with `pending` or `unpaid` status
- Links to files page for full list

### Admin View
- Full document management at `/admin/files/`
- Create, upload, and manage contracts/invoices per organization
- Update status labels

---

## Lead Attachments

Separate from the media hub, lead submissions include file uploads:

### Storage Bucket: `leads-attachments`
- Files uploaded during lead creation via `/api/leads`
- Named with timestamp prefix: `{timestamp}-{sanitized_filename}`
- Referenced in `leads.file_paths` TEXT array
- Uploaded via admin client (bypasses RLS)

---

## Realtime Behavior

Customer dashboard subscribes to `contracts` table changes:
```typescript
.on('postgres_changes', {
    event: '*',
    table: 'contracts',
    filter: `organization_id=eq.${activeOrgId}`
}, () => fetchData())
```

Media uploads trigger sidebar notification badges when new files are uploaded by the opposite party.

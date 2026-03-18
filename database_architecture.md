# Portal — Database Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** Supabase PostgreSQL schema, table structure, relationships, RLS policies, and storage.  
> **Note:** This document is inferred from the application code. Update when schema changes are made.

---

## Database Provider

- **Supabase** (PostgreSQL)
- **Accessed via:** `@supabase/ssr` (browser, server, middleware) and `@supabase/supabase-js` (admin)
- **RLS:** Row-Level Security enforced on all tables (bypassed only by admin/service-role client)

---

## Core Tables

### `profiles`
User profile data, linked to Supabase Auth `auth.users`.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Matches `auth.users.id` |
| `full_name` | TEXT | User's display name |
| `role` | TEXT | `'admin'` or `'customer'` |

**Used by:** Dashboard layouts (role check), sidebar (display name), messaging (sender info)

---

### `organizations`
Client organizations / companies.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Organization identifier |
| `name` | TEXT | Organization display name |
| `access_code` | TEXT | Unique joinable code (e.g., `NIKE-7721`) |

**Used by:** Org switcher, dashboard context, data scoping

---

### `organization_members`
Join table linking users to organizations (many-to-many).

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID (FK → profiles) | User reference |
| `organization_id` | UUID (FK → organizations) | Org reference |

**Used by:** Dashboard layout (check membership), join flow (access code → membership)

---

### `orders`
Order records for apparel production.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Order identifier |
| `organization_id` | UUID (FK → organizations) | Owning organization |
| `name` | TEXT | Order display name |
| `status` | TEXT | `'pending'`, `'design'`, `'production'`, `'shipped'`, `'completed'` |
| `timeline_step` | INT | Progress step (1–4) for visual timeline |
| `details` | JSONB | Array of order line items (type, qty, etc.) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Used by:** Customer/Admin dashboards, order pages, production status

---

### `messages`
Chat messages between admins and client organizations.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Message identifier |
| `organization_id` | UUID (FK → organizations) | Chat channel (org-scoped) |
| `sender_id` | UUID (FK → profiles) | Message author |
| `content` | TEXT | Message body |
| `created_at` | TIMESTAMPTZ | Sent timestamp |

**Used by:** Messaging pages, unread message counts, activity feeds

---

### `message_reads`
Read receipts tracking last-read timestamp per user per org channel.

| Column | Type | Description |
|---|---|---|
| `user_id` | UUID (FK → profiles) | Reader |
| `organization_id` | UUID (FK → organizations) | Chat channel |
| `last_read_at` | TIMESTAMPTZ | Last time user viewed this channel |

**Used by:** Unread message count calculation (dashboard, sidebar badges)

---

### `contracts`
Documents, invoices, and contracts associated with organizations.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Document identifier |
| `organization_id` | UUID (FK → organizations) | Owning organization |
| `title` | TEXT | Document name |
| `type` | TEXT | Document type (invoice, contract, etc.) |
| `status` | TEXT | `'pending'`, `'unpaid'`, `'paid'`, `'completed'` |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

**Used by:** Files page, dashboard pending files card

---

### `leads`
Incoming sales leads from the public website.

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Lead identifier |
| `name` | TEXT | Contact name |
| `email` | TEXT | Contact email |
| `company` | TEXT | Company name |
| `summary` | TEXT | Brief description of request |
| `details` | JSONB | Structured order/project details |
| `file_paths` | TEXT[] | Uploaded file references in storage |
| `status` | TEXT | `'new'`, `'contacted'`, `'qualified'`, `'converted'`, `'lost'` |
| `created_at` | TIMESTAMPTZ | Submission timestamp |

**Used by:** CRM leads table, admin dashboard stats, lead conversion API

---

## Relationships (Entity Diagram)

```
auth.users
    │
    └──→ profiles (1:1, id = auth.users.id)
            │
            ├──→ organization_members (1:N, user_id)
            │        │
            │        └──→ organizations (N:1, organization_id)
            │                 │
            │                 ├──→ orders (1:N, organization_id)
            │                 ├──→ messages (1:N, organization_id)
            │                 ├──→ message_reads (1:N, organization_id)
            │                 └──→ contracts (1:N, organization_id)
            │
            └──→ messages (1:N, sender_id)

leads (standalone, linked to organizations post-conversion)
```

---

## Storage Buckets

| Bucket | Purpose | Access |
|---|---|---|
| `leads-attachments` | Files uploaded with lead submissions | Admin client (write), public read (via signed URLs) |
| *(media bucket)* | Organization media assets (brand files, mockups, designs) | RLS-scoped per organization |

---

## Row-Level Security (RLS)

RLS policies enforce data isolation at the database level:

- **Organization scoping:** Customers can only query rows where `organization_id` matches their membership
- **Profile scoping:** Users can only read/update their own profile
- **Admin bypass:** The admin client (`SUPABASE_SERVICE_ROLE_KEY`) bypasses all RLS for management operations

### Key Policy Patterns
```sql
-- Customers see only their org's data
CREATE POLICY "Users can view own org orders"
ON orders FOR SELECT
USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
));

-- Admins see everything (via separate admin client that bypasses RLS)
```

---

## Realtime Subscriptions

Supabase Realtime is enabled on these tables:

| Table | Events | Subscribers |
|---|---|---|
| `orders` | INSERT, UPDATE, DELETE | Customer dashboard, Admin dashboard |
| `messages` | INSERT | Customer dashboard, Admin dashboard, message pages |
| `contracts` | INSERT, UPDATE, DELETE | Customer dashboard |
| `organizations` | INSERT, UPDATE, DELETE | Admin dashboard |
| `leads` | INSERT, UPDATE | Admin dashboard |

# Portal — Backend Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** API routes, server actions, middleware, and server-side logic.

---

## Backend Overview

The Portal's backend is built entirely within **Next.js App Router** conventions:

| Pattern | Technology | Location |
|---|---|---|
| **API Routes** | Next.js Route Handlers | `app/api/` |
| **Server Actions** | `'use server'` functions | `app/*/actions.ts` |
| **Middleware** | Next.js Middleware | `middleware.ts` → `utils/supabase/middleware.ts` |
| **Database** | Supabase (PostgreSQL) | Accessed via Supabase clients |
| **Auth** | Supabase Auth | Managed via middleware + server clients |
| **Storage** | Supabase Storage | File uploads via admin client |

---

## Middleware (`middleware.ts`)

The root middleware intercepts all requests (except static files) and delegates to `updateSession()`:

### Request Flow
```
Browser Request
  → middleware.ts (entry point)
  → utils/supabase/middleware.ts (updateSession)
      → Creates Supabase ServerClient with cookie-based auth
      → Calls supabase.auth.getUser() to validate session
      → Redirects:
          • Unauthenticated → /login (except /login, /signup, /auth, /api, /images, /public)
          • Authenticated on /login or /signup → / (home)
      → Passes supabaseResponse with refreshed cookies
```

### Matcher Pattern
```
/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)
```
Matches all routes except static assets, images, and favicon.

---

## API Routes

### `POST /api/leads` — Public Lead Submission (**DEPRECATED**)
- **File:** `app/api/leads/route.ts`
- **Status:** ⚠️ Deprecated — website now submits leads through n8n webhook → `/api/leads/create`
- **Auth:** None (public endpoint, CORS enabled with `*`)
- **Client:** Admin client (Service Role Key — bypasses RLS)
- Can be removed once n8n flow is fully verified

### `POST /api/leads/create` — Lead Creation via n8n
- **File:** `app/api/leads/create/route.ts`
- **Auth:** `x-api-key` header (validated against `LEADS_API_KEY` env var)
- **Client:** Server client
- **Flow:**
  1. Validate API key from request header
  2. Parse JSON body (name, email, company, phone, summary, source, details, file_paths)
  3. Insert lead record into `leads` table with status `new` and `file_paths` array
  4. Return `{ success: true, lead: data }`
- **Called by:** n8n workflow after receiving webhook from website
- **File paths:** Supabase Storage public URLs uploaded by the website before the webhook is triggered

### `POST /api/admin/convert-lead` — Convert Lead to Client
- **Auth:** Admin only (validated server-side)
- Creates organization from lead data, generates access code

### `POST /api/admin/delete-user` — Delete Portal User
- **Auth:** Admin only
- Removes user from the system

### `POST /api/admin/invite-user` — Invite User to Organization
- **Auth:** Admin only
- Sends invitation for user to join an organization

---

## Server Actions

Server Actions use `'use server'` directive and are called from client components:

### Global Actions (`app/actions.ts`)
| Action | Purpose |
|---|---|
| `setActiveOrganization(orgId)` | Sets `active_org_id` cookie and redirects to `/` |

### Auth Actions
| Route | Action | Purpose |
|---|---|---|
| `/login/actions.ts` | `login()` | Authenticate user with email/password |
| `/signup/actions.ts` | `signup()` | Register new user account |
| `/join/actions.ts` | `joinOrganization()` | Link user to org via access code |
| `/forgot-password/actions.ts` | `forgotPassword()` | Send password reset email |
| `/reset-password/actions.ts` | `resetPassword()` | Update password with reset token |

---

## Supabase Client Strategy

Four distinct Supabase clients are used depending on the context:

### 1. Browser Client (`utils/supabase/client.ts`)
```typescript
createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```
- Used in: Client Components (`"use client"`)
- Auth: User's JWT via browser cookies
- RLS: **Enforced** — only accesses data user has permission to see
- Use cases: Dashboard data fetching, realtime subscriptions

### 2. Server Client (`utils/supabase/server.ts`)
```typescript
createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies })
```
- Used in: Server Components, Server Actions
- Auth: User's JWT via `next/headers` cookies
- RLS: **Enforced**
- Use cases: Layout auth checks, data fetching in Server Components

### 3. Admin Client (`utils/supabase/admin.ts`)
```typescript
createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
```
- Used in: API Routes only
- Auth: Service Role Key — **no user session**
- RLS: **Bypassed** — full database access
- Use cases: Lead creation (public API), admin operations (user management, org creation)

### 4. Middleware Client (`utils/supabase/middleware.ts`)
```typescript
createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookies: request.cookies })
```
- Used in: Next.js Middleware only
- Auth: Reads/refreshes tokens from request cookies
- Purpose: Session refresh, authentication redirects

---

## External Integrations

| Service | Purpose | Endpoint |
|---|---|---|
| **n8n Webhook (Production)** | Receives lead submissions from website | `https://n8n.maxwellwarren.dev/webhook/76e4d8b0-...` |
| **n8n Webhook (Test)** | Fallback webhook for development | `https://n8n.maxwellwarren.dev/webhook-test/76e4d8b0-...` |
| **Supabase** | Database, Auth, Realtime, Storage | `NEXT_PUBLIC_SUPABASE_URL` |

---

## Scripts

| Script | Language | Purpose |
|---|---|---|
| `scripts/seed-users.js` | JavaScript | Seeds database with test user data |
| `scripts/test_leads_api.py` | Python | Tests the `/api/leads` endpoint |

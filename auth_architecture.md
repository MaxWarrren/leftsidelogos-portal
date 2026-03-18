# Portal — Authentication Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** Auth flows, session management, role/org resolution, and access control.

---

## Auth Provider

**Supabase Auth** via `@supabase/ssr` — supports email/password and OAuth (OIDC).

---

## Auth Flow Diagrams

### Login Flow
```
User → /login page
     → login-form.tsx (client component)
     → login() server action (app/login/actions.ts)
         → supabase.auth.signInWithPassword({ email, password })
         → On success: redirect to /
         → On error: return error message to form
```

### Signup Flow
```
User → /signup page
     → signup-form.tsx (client component)
     → signup() server action (app/signup/actions.ts)
         → supabase.auth.signUp({ email, password, options: { data } })
         → Creates auth.users record + profiles row (via trigger)
         → Redirect to /join (to enter access code)
```

### Organization Join Flow
```
User → /join page (redirected here if no org memberships)
     → join-form.tsx (client component)
     → joinOrganization() server action (app/join/actions.ts)
         → Lookup org by access_code
         → Insert into organization_members (user_id, organization_id)
         → Set active_org_id cookie
         → Redirect to / (dashboard)
```

### Password Reset Flow
```
User → /forgot-password
     → forgotPassword() → supabase.auth.resetPasswordForEmail()
     → User receives email with reset link
     → /reset-password (with token in URL)
     → resetPassword() → supabase.auth.updateUser({ password })
     → Redirect to /login
```

### OAuth Callback
```
OAuth Provider → /auth/callback
              → Exchange code for session
              → Redirect to /
```

---

## Session Management

### Middleware Session Refresh (`middleware.ts` → `utils/supabase/middleware.ts`)

Every request passes through middleware that:
1. Creates a Supabase server client using request cookies
2. Calls `supabase.auth.getUser()` to validate/refresh the JWT
3. Sets refreshed cookies on the response
4. Redirects unauthenticated users to `/login`
5. Redirects authenticated users away from `/login` and `/signup`

### Public Routes (No Auth Required)
- `/login`
- `/signup`
- `/auth/*`
- `/api/*`
- `/images/*`
- `/public/*`

---

## Role-Based Access Control

### Role Resolution
```
Middleware: Session is valid?
  └── Layout: Fetch profile from DB
       └── Check profile.role
            ├── 'admin'    → Render admin layout (or redirect from customer layout)
            └── 'customer' → Check org membership
                 ├── Has orgs → Render customer dashboard
                 └── No orgs  → Redirect to /join
```

### Layout-Level Guards

| Layout | File | Check | Redirect |
|---|---|---|---|
| Customer Dashboard | `app/(dashboard)/layout.tsx` | `profile.role === 'admin'` → redirect `/admin`; No memberships → redirect `/join` |
| Admin | `app/admin/layout.tsx` | `profile.role !== 'admin'` → redirect `/` |

### API-Level Guards
- Admin API routes validate the calling user's role server-side
- Public API routes (`/api/leads`) use the admin Supabase client (no user context)

---

## Organization Context

The active organization is determined by a cookie:

```
Cookie: active_org_id = <UUID>
```

- **Set by:** `setActiveOrganization()` server action (when user selects org in switcher)
- **Read by:** Dashboard layout (server-side via `cookies()`), Dashboard page (client-side via `document.cookie`)
- **Fallback:** First organization in user's membership list
- **Effect:** Scopes all data queries to the selected organization

---

## Auth Page Structure

Each auth page follows a consistent pattern:

```
app/<auth-route>/
├── page.tsx         # Minimal server component that renders the form
├── <name>-form.tsx  # Client component with form UI and validation
└── actions.ts       # Server actions for the auth operation
```

---

## Security Considerations

1. **Service Role Key** is only used in API routes (server-side), never exposed to the client
2. **RLS policies** enforce data isolation even if auth is bypassed
3. **Middleware** runs on every non-static route to prevent unauthorized access
4. **Admin role** is stored in the database, not in the JWT — validated via DB query in layouts

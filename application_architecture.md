# Left Side Logos — Portal Architecture

> **Last Updated:** 2026-03-18  
> **App Type:** Full-Stack SaaS Portal  
> **Framework:** Next.js 16 (App Router) + TypeScript  
> **Backend:** Supabase (Auth, Database, Realtime, Storage)  
> **Purpose:** Private client workspace for managing custom apparel orders, communication, and media assets.

---

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js (App Router) | 16.1.4 |
| **UI Framework** | React | 19.2.3 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS v4 + PostCSS | 4.x |
| **Component Library** | ShadCN UI (New York style) | — |
| **Icons** | Lucide React | 0.563 |
| **Backend / BaaS** | Supabase | SSR 0.8 / JS 2.91 |
| **Auth** | Supabase Auth (Email/OIDC) | via `@supabase/ssr` |
| **Notifications** | Sonner | 2.x |
| **Date Utils** | date-fns | 4.x |
| **Theming** | next-themes | 0.4 |
| **Command Palette** | cmdk | 1.x |

---

## Application Structure

```
Portal/
├── app/                          # Next.js App Router
│   ├── layout.tsx                    # Root layout (Geist fonts, Sonner Toaster)
│   ├── globals.css                   # Global CSS (Tailwind v4, CSS variables)
│   ├── actions.ts                    # Server Actions (setActiveOrganization)
│   ├── icon.png                      # Favicon
│   │
│   ├── (dashboard)/                  # Customer route group (grouped layout)
│   │   ├── layout.tsx                    # Dashboard layout — auth check, org membership, sidebar
│   │   ├── page.tsx                      # Customer dashboard (orders, messages, files overview)
│   │   ├── orders/page.tsx               # Customer order tracking
│   │   ├── messages/page.tsx             # Customer messaging
│   │   └── media/page.tsx                # Customer media/asset library
│   │
│   ├── admin/                        # Admin route group
│   │   ├── layout.tsx                    # Admin layout — admin role check, AdminSidebar
│   │   ├── page.tsx                      # Admin dashboard (stats, activity, production status)
│   │   ├── clients/                      # Client management
│   │   │   ├── page.tsx                      # Client list / CRM
│   │   │   └── [id]/                         # Individual client detail
│   │   ├── crm/                          # CRM module
│   │   │   ├── layout.tsx                    # CRM sub-layout with tabs
│   │   │   ├── page.tsx                      # CRM overview (customers tab)
│   │   │   └── leads/                        # Lead management sub-page
│   │   ├── orders/                       # Admin order management
│   │   │   ├── page.tsx                      # All orders list
│   │   │   └── [id]/                         # Order detail/edit
│   │   ├── messages/page.tsx             # Global messaging (all orgs)
│   │   ├── media/page.tsx                # Global media management
│   │   └── files/page.tsx                # Document & contracts vault
│   │
│   ├── auth/callback/                # OAuth callback handler
│   ├── login/                        # Login page + actions
│   ├── signup/                       # Registration page + actions
│   ├── join/                         # Org join page (access code entry) + actions
│   ├── forgot-password/              # Password reset request + actions
│   └── reset-password/               # Password reset completion + actions
│
│   ├── api/                          # API Routes
│   │   ├── leads/                        # Public leads endpoint
│   │   │   ├── route.ts                      # POST: create lead + file uploads + webhook
│   │   │   └── create/                       # (Additional lead creation)
│   │   └── admin/                        # Admin-only API routes
│   │       ├── convert-lead/                 # Convert lead to client org
│   │       ├── delete-user/                  # Delete portal user
│   │       └── invite-user/                  # Invite user to org
│
├── components/                   # React components
│   ├── app-sidebar.tsx               # Customer sidebar (~14KB)
│   ├── admin-sidebar.tsx             # Admin sidebar (~14KB)
│   ├── org-switcher.tsx              # Organization switcher dropdown
│   ├── logout-button.tsx             # Logout button component
│   ├── crm/                          # CRM-specific components
│   │   ├── customers-table.tsx           # Customer data table (~38KB)
│   │   ├── leads-table.tsx               # Leads data table (~9KB)
│   │   └── portal-users-table.tsx        # Portal users management (~5KB)
│   ├── media/
│   │   └── media-gallery.tsx             # Media gallery component (~28KB)
│   └── ui/                           # ShadCN UI primitives (21 components)
│       ├── avatar.tsx, badge.tsx, button.tsx, card.tsx
│       ├── command.tsx, dialog.tsx, dropdown-menu.tsx
│       ├── input.tsx, label.tsx, popover.tsx
│       ├── scroll-area.tsx, select.tsx, separator.tsx
│       ├── sheet.tsx, sidebar.tsx, skeleton.tsx
│       ├── sonner.tsx, switch.tsx, table.tsx
│       ├── tabs.tsx, tooltip.tsx
│
├── hooks/
│   └── use-mobile.ts                # Mobile detection hook
│
├── lib/
│   └── utils.ts                     # cn() utility + formatBytes()
│
├── utils/supabase/               # Supabase client configurations
│   ├── client.ts                     # Browser client (createBrowserClient)
│   ├── server.ts                     # Server Component client (createServerClient)
│   ├── admin.ts                      # Admin client (Service Role Key — bypasses RLS)
│   └── middleware.ts                 # Middleware client (session refresh + auth redirects)
│
├── scripts/                      # Utility scripts
│   ├── seed-users.js                 # Database seeding script
│   └── test_leads_api.py            # API testing script (Python)
│
├── middleware.ts                 # Next.js middleware entry point → updateSession()
├── next.config.ts                # Next.js configuration
├── components.json               # ShadCN UI configuration
├── postcss.config.mjs            # PostCSS config (Tailwind v4)
├── eslint.config.mjs             # ESLint configuration
├── tsconfig.json                 # TypeScript configuration
├── PRD.md                        # Product Requirements Document
└── public/images/                # Static image assets
```

---

## Dual-Role Architecture

The Portal serves two distinct user roles with completely separate interfaces:

### Role A: Admin ("Pilot View")
- **Route:** `/admin/*`
- **Layout:** `app/admin/layout.tsx` — validates `profile.role === 'admin'`, uses `AdminSidebar`
- **Dashboard:** Stats overview (total clients, active orders, new messages, new leads), recent activity, production status
- **Capabilities:** Manage all organizations, orders, messages, media, files, CRM (leads + customers), user invitations

### Role B: Customer ("Collaborator View")
- **Route:** `/(dashboard)/*`
- **Layout:** `app/(dashboard)/layout.tsx` — validates org membership, redirects admins to `/admin`, uses `AppSidebar`
- **Dashboard:** Org-scoped view of recent orders, unread messages, pending files/contracts
- **Capabilities:** View own orders, chat with admin, upload/download media, view contracts

### Role Determination Flow
```
User logs in → middleware refreshes session → layout checks profile.role
  ├── role === 'admin'  → redirect to /admin (from dashboard layout)
  └── role !== 'admin'  → check org membership
       ├── has memberships → render customer dashboard
       └── no memberships → redirect to /join (enter access code)
```

---

## Key Architectural Patterns

### 1. Organization-Based Data Isolation
- All data (orders, messages, media, contracts) is scoped by `organization_id`
- Active org is stored in a cookie (`active_org_id`) set via server action
- Customers only see their own org's data; admins see across all orgs

### 2. Supabase Client Strategy
| Client | File | Use Case | Auth Level |
|---|---|---|---|
| Browser | `utils/supabase/client.ts` | Client components, realtime subscriptions | Anon key (RLS enforced) |
| Server | `utils/supabase/server.ts` | Server Components, data fetching | Anon key (RLS enforced) |
| Admin | `utils/supabase/admin.ts` | API routes, admin operations | Service Role Key (bypasses RLS) |
| Middleware | `utils/supabase/middleware.ts` | Session refresh, auth redirects | Anon key |

### 3. Realtime Subscriptions
Both admin and customer dashboards use Supabase Realtime to auto-refresh data:
- Customer dashboard: listens to `orders`, `messages`, `contracts` changes for active org
- Admin dashboard: listens to `messages`, `orders`, `organizations`, `leads` globally

### 4. Server Actions
- `app/actions.ts` — `setActiveOrganization()` sets cookie + redirects
- Auth pages use per-route server actions (login, signup, join, forgot-password, reset-password)

---

## Environment Variables

| Variable | Purpose | Used By |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | All clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Browser, Server, Middleware clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin) | Admin client only (API routes) |

---

## Build & Development

| Command | Action |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint check |

---

## Connection to Website

The Portal receives data from the public-facing Website:

1. **Leads API (`/api/leads`):** The Website's order builder submits form data (name, email, company, summary, details JSON, file attachments) via POST. The Portal stores leads in the `leads` table and triggers an n8n webhook for automation.
2. **Lead-to-Client Pipeline:** Admins manage incoming leads in the CRM module, converting qualified leads into full client organizations with access codes.
3. **Shared brand assets** and design language are consistent across both applications.

---

## See Also
- [Frontend Architecture](./frontend_architecture.md) — Component details, layout system, UI patterns
- [Backend Architecture](./backend_architecture.md) — API routes, server actions, middleware
- [Database Architecture](./database_architecture.md) — Supabase schema, tables, RLS policies
- [Auth Architecture](./auth_architecture.md) — Authentication flows, session management
- [API Architecture](./api_architecture.md) — API endpoint documentation
- [Features: CRM](./features/crm_architecture.md) — Lead management, customer tables
- [Features: Messaging](./features/messaging_architecture.md) — Realtime chat system
- [Features: Orders](./features/orders_architecture.md) — Order lifecycle management
- [Features: Media](./features/media_architecture.md) — File storage and gallery

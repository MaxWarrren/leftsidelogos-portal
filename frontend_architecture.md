# Portal — Frontend Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** Component hierarchy, layout system, UI patterns, and client-side data flow.

---

## Layout System

Next.js App Router uses nested layouts. The Portal has three layout levels:

```
app/layout.tsx                    (Root — fonts, Toaster, HTML shell)
├── app/(dashboard)/layout.tsx    (Customer — auth check, sidebar, org context)
├── app/admin/layout.tsx          (Admin — admin role check, AdminSidebar)
└── app/admin/crm/layout.tsx      (CRM — sub-navigation tabs)
```

### Root Layout (`app/layout.tsx`)
- Loads **Geist** (sans) and **Geist Mono** (monospace) fonts via `next/font/google`
- Renders `<Toaster position="top-right" richColors />` from Sonner for notifications
- Sets metadata: title "Left Side Logos Portal"

### Customer Dashboard Layout (`app/(dashboard)/layout.tsx`)
- **Server Component** — runs auth checks server-side
- Fetches user profile from `profiles` table
- Redirects admins to `/admin`, unauthenticated users to `/login`, users without orgs to `/join`
- Loads user's organizations via `organization_members` join query
- Reads `active_org_id` from cookies (falls back to first org)
- Renders: `SidebarProvider` → `AppSidebar` + `SidebarInset` (header + main content)

### Admin Layout (`app/admin/layout.tsx`)
- **Server Component** — validates `profile.role === 'admin'`
- Non-admin users redirected to `/`
- Renders: `SidebarProvider` → `AdminSidebar` + `SidebarInset` (header with "Live Production" badge)

---

## Sidebar Architecture

### Customer Sidebar (`components/app-sidebar.tsx` ~14KB)
- Organization switcher (top) via `OrgSwitcher` component
- Navigation links: Dashboard, Orders, Messages, Media
- Organization-aware — highlights active org, allows switching
- Uses `SidebarProvider` context for collapse/expand state

### Admin Sidebar (`components/admin-sidebar.tsx` ~14KB)
- Fixed admin navigation: Dashboard, Clients, CRM, Orders, Messages, Media, Files
- "Live Production" indicator
- No org switcher (admin sees all orgs)

### Organization Switcher (`components/org-switcher.tsx` ~4KB)
- Dropdown with searchable organization list
- Calls `setActiveOrganization()` server action on selection
- Sets `active_org_id` cookie and redirects to `/`

---

## Page Components

### Customer Pages (Client-Side Components)

| Page | File | Key Features |
|---|---|---|
| Dashboard | `(dashboard)/page.tsx` | Orders summary, unread messages count, pending files; realtime subscriptions |
| Orders | `(dashboard)/orders/page.tsx` | Order list with status badges and timeline progress bars |
| Messages | `(dashboard)/messages/page.tsx` | Chat interface scoped to active org |
| Media | `(dashboard)/media/page.tsx` | Media gallery with upload/download capabilities |

### Admin Pages (Client-Side Components)

| Page | File | Key Features |
|---|---|---|
| Dashboard | `admin/page.tsx` | Stats cards (clients, orders, messages, leads), recent activity feed, production status |
| Clients | `admin/clients/page.tsx` | Client org management, detail view at `[id]` |
| CRM | `admin/crm/page.tsx` | Tabbed view: Customers, Leads, Portal Users |
| CRM/Leads | `admin/crm/leads/` | Lead management sub-page |
| Orders | `admin/orders/page.tsx` | All orders management, detail at `[id]` |
| Messages | `admin/messages/page.tsx` | Global chat across all org channels |
| Media | `admin/media/page.tsx` | All organization media management |
| Files | `admin/files/page.tsx` | Contracts and documents vault |

---

## ShadCN UI Component Library

The Portal uses **ShadCN UI** (New York style) with 21 installed components:

| Component | Source | Description |
|---|---|---|
| `avatar` | Radix | User/org avatars with fallback |
| `badge` | — | Status badges (order status, contract status) |
| `button` | Radix Slot | Primary, secondary, outline, ghost variants |
| `card` | — | Dashboard cards, stat cards |
| `command` | cmdk | Command palette / search |
| `dialog` | Radix | Modal dialogs (create order, invite user) |
| `dropdown-menu` | Radix | Context menus, action menus |
| `input` | — | Form text inputs |
| `label` | Radix | Form field labels |
| `popover` | Radix | Floating content panels |
| `scroll-area` | Radix | Custom scrollable areas (sidebar, chat) |
| `select` | Radix | Dropdown selects (status, org picker) |
| `separator` | Radix | Visual dividers |
| `sheet` | Radix | Slide-out panels |
| `sidebar` | — | Full sidebar component system (~22KB) |
| `skeleton` | — | Loading state placeholders |
| `sonner` | Sonner | Toast notification wrapper |
| `switch` | Radix | Toggle switches |
| `table` | — | Data tables (CRM, orders) |
| `tabs` | Radix | Tab navigation (CRM sub-sections) |
| `tooltip` | Radix | Hover tooltips |

### ShadCN Config (`components.json`)
- Style: `new-york`
- RSC: `true` (React Server Components enabled)
- Base color: `neutral`
- CSS variables: `true`
- Icon library: `lucide`
- Path aliases: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`

---

## CRM Components (`components/crm/`)

| Component | Size | Description |
|---|---|---|
| `customers-table.tsx` | ~38KB | Full-featured customer data table with search, sorting, filtering, inline editing, org creation |
| `leads-table.tsx` | ~9KB | Leads management table with status updates, lead-to-client conversion |
| `portal-users-table.tsx` | ~5KB | Portal user management with role assignment |

---

## Realtime Data Patterns

Both dashboards use Supabase Realtime via `postgres_changes`:

```typescript
// Pattern: Subscribe to table changes, re-fetch all data on any change
const channel = supabase
    .channel('channel-name')
    .on('postgres_changes', {
        event: '*',            // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'table_name',
        filter: `organization_id=eq.${orgId}`  // Scoped filtering
    }, () => fetchData())   // Re-fetch pattern
    .subscribe();

// Cleanup on unmount
return () => supabase.removeChannel(channel);
```

---

## Styling

- **Tailwind CSS v4** via PostCSS (build-time, not CDN)
- **CSS Variables** defined in `app/globals.css` for theming
- **`cn()` utility** from `lib/utils.ts` for conditional class merging
- **Responsive** — mobile detection via `hooks/use-mobile.ts`
- **Color palette:** Slate/Indigo theme — professional, high-contrast light mode

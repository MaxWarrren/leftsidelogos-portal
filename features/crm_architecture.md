# Portal — CRM Feature Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** Lead management, customer management, and user administration.

---

## Overview

The CRM module is **admin-only** and provides tools to manage the full sales pipeline — from incoming website leads to active client organizations with portal access.

---

## Routes

```
app/admin/crm/
├── layout.tsx       # CRM sub-layout with tab navigation
├── page.tsx         # Default CRM view — Customers tab
└── leads/           # Leads management tab
```

---

## Components

### `components/crm/customers-table.tsx` (~38KB)
The largest CRM component — a full-featured data table for managing customer organizations.

**Capabilities:**
- View all organizations with member counts, order counts
- Inline search, sorting, and filtering
- Create new organizations (generate access code)
- Edit organization details
- View organization members
- Navigate to individual client detail pages

### `components/crm/leads-table.tsx` (~9KB)
Manages incoming sales leads from the Website.

**Capabilities:**
- View all leads with status, company, summary
- Update lead status (`new` → `contacted` → `qualified` → `converted` / `lost`)
- Convert qualified leads to organizations via `/api/admin/convert-lead`
- View lead details and attached files

### `components/crm/portal-users-table.tsx` (~5KB)
Manages portal user accounts.

**Capabilities:**
- View all registered users with roles and org assignments
- Delete users via `/api/admin/delete-user`
- Invite users via `/api/admin/invite-user`

---

## Data Flow: Lead Pipeline

```
Website Order Form → POST /api/leads → leads table (status: 'new')
                                         │
                                         ↓
          Admin CRM Leads Tab ← realtime subscription on leads table
                │
                ├── Update status: new → contacted → qualified
                │
                └── Convert Lead → POST /api/admin/convert-lead
                                      │
                                      ├── Create organization (generate access code)
                                      ├── Update lead status → 'converted'
                                      └── Now visible in Customers Table
                                              │
                                              └── Admin shares access code with client
                                                     │
                                                     └── Client joins at /join → enters code → member of org
```

---

## CRM Layout Tabs

The CRM sub-layout (`app/admin/crm/layout.tsx`) provides tab navigation:

| Tab | Route | Component |
|---|---|---|
| Customers | `/admin/crm` | `customers-table.tsx` |
| Leads | `/admin/crm/leads` | `leads-table.tsx` |
| Portal Users | *(within CRM page)* | `portal-users-table.tsx` |

---

## Related Tables

| Table | Role in CRM |
|---|---|
| `leads` | Incoming prospects from Website |
| `organizations` | Active client companies |
| `organization_members` | User-to-org assignments |
| `profiles` | User accounts with roles |

# Portal — Orders Feature Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** Order creation, lifecycle management, and production timeline tracking.

---

## Overview

Orders track the full production lifecycle of custom apparel jobs — from initial request to delivery. They use a **4-step visual timeline** and support structured item details.

---

## Routes

| Route | Role | Description |
|---|---|---|
| `/(dashboard)/orders/page.tsx` | Customer | View own org's orders with status and progress |
| `/admin/orders/page.tsx` | Admin | Manage all orders across all organizations |
| `/admin/orders/[id]/` | Admin | Individual order detail and editing |

---

## Data Model (`orders` Table)

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Order identifier |
| `organization_id` | UUID | Owning organization |
| `name` | TEXT | Order display name |
| `status` | TEXT | Current status label |
| `timeline_step` | INT | Visual progress (1–4) |
| `details` | JSONB | Array of line items `[{ type, qty, ... }]` |
| `created_at` | TIMESTAMPTZ | Creation time |

---

## Order Lifecycle

### Status Values
| Status | Meaning | Timeline Step |
|---|---|---|
| `pending` | Order received, awaiting review | 1 |
| `design` | Design work in progress | 2 |
| `production` | In production / printing | 3 |
| `shipped` | Shipped to client | 3–4 |
| `completed` | Delivered and finalized | 4 |

### Visual Timeline
```
Step 1       Step 2       Step 3       Step 4
[Pending] → [Design] → [Production] → [Completed]
   ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
   25%         50%         75%         100%
```

Rendered in the UI as a progress bar: `width: ${(timeline_step / 4) * 100}%`

---

## Customer View

- **Dashboard card:** Shows 3 most recent orders with name, status badge, total quantity, and step
- **Orders page:** Full list of org's orders with sorting and filtering
- **Realtime:** Subscribes to `orders` table changes for active org — auto-refreshes on any update

---

## Admin View

- **Dashboard card:** Production Status section showing active (non-completed) orders with progress bars
- **Orders page:** All orders across all organizations with management controls
- **Order detail (`[id]`):** Edit order status, advance timeline step, modify details
- **Realtime:** Subscribes to all `orders` table changes globally

---

## Order Details Structure (JSONB)

```typescript
// Each order's `details` field is an array of line items:
[
    { type: "T-Shirt", qty: 50, size: "L", color: "Black" },
    { type: "Hoodie", qty: 25, size: "XL", color: "Navy" },
    ...
]

// Total quantity calculated client-side:
details.reduce((sum, d) => sum + (d.qty || 0), 0)
```

---

## Realtime Subscriptions

```typescript
// Customer: scoped to active org
.on('postgres_changes', {
    event: '*',
    table: 'orders',
    filter: `organization_id=eq.${activeOrgId}`
}, () => fetchData())

// Admin: global
.on('postgres_changes', {
    event: '*',
    table: 'orders'
}, fetchStats)
```

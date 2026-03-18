# Portal — Messaging Feature Architecture

> **Last Updated:** 2026-03-18  
> **Scope:** Realtime chat system between admins and client organizations.

---

## Overview

The messaging system provides a **Slack-style chat interface** scoped to organizations. Each organization has one shared channel that all its members and admins can communicate through.

---

## Routes

| Route | Role | Description |
|---|---|---|
| `/(dashboard)/messages/page.tsx` | Customer | Chat with admin, scoped to active org |
| `/admin/messages/page.tsx` | Admin | Global chat — all org channels visible |

---

## Data Model

### `messages` Table
| Column | Description |
|---|---|
| `id` | Message UUID |
| `organization_id` | Chat channel (one per org) |
| `sender_id` | FK → profiles (message author) |
| `content` | Message text body |
| `created_at` | Timestamp |

### `message_reads` Table
| Column | Description |
|---|---|
| `user_id` | FK → profiles |
| `organization_id` | Chat channel |
| `last_read_at` | Timestamp of last viewed message |

---

## Unread Message Calculation

```typescript
// 1. Get user's last read timestamp for this org
const receipt = message_reads.where(org_id, user_id).last_read_at;

// 2. Count messages after that timestamp, not sent by current user
const unread = messages
    .where(org_id)
    .where(sender_id != current_user)
    .where(created_at > receipt.last_read_at)
    .count();
```

**Customer view:** Counts admin messages not yet read  
**Admin view:** Counts customer messages not yet read per org

---

## Realtime Behavior

### Customer Dashboard
```typescript
supabase.channel('customer-dashboard')
    .on('postgres_changes', {
        event: 'INSERT',
        table: 'messages',
        filter: `organization_id=eq.${activeOrgId}`
    }, () => fetchData())
```

### Admin Dashboard
```typescript
supabase.channel('admin-dashboard-updates')
    .on('postgres_changes', {
        event: '*',
        table: 'messages'
    }, fetchStats)  // Global, no org filter
```

---

## Notification System

- **Sonner toasts** fire on new message events for desktop-style notifications
- **Sidebar badges** show unread indicator dots (red) when new messages exist
- **Read receipt sync** clears indicators when user opens the messages page

---

## Chat Architecture

### Customer View (`/(dashboard)/messages/`)
- Shows single channel (active org)
- Scrollable message list
- Text input with send functionality
- Updates `message_reads.last_read_at` on page open

### Admin View (`/admin/messages/`)
- Left panel: Organization list with unread badges
- Right panel: Active org's message thread
- Can switch between org channels
- Updates `message_reads.last_read_at` per org on view

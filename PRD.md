# Product Requirements Document (PRD) - Left Side Logos Portal

## Project Vision
Left Side Logos Portal is a premium, private SaaS workspace designed for custom apparel clients. It centralizes designs, communication, and order tracking into a single professional dashboard, eliminating messy email threads and providing clients with a "concierge-level" experience.

---

## Technology Stack
- **Frontend:** Next.js (App Router, TypeScript)
- **Backend:** Supabase (Auth, Database, Realtime, Storage)
- **Styling:** Tailwind CSS / Shadcn UI
- **Notifications:** Sonner (Real-time Toasts)
- **Icons:** Lucide React

---

## User Roles & Permissions

### Role A: The Admin (Pilot View)
*The Pilot has a "God-view" of the entire system and manages the production floor.*
- **Dashboard Control:** Overview of total clients, pending orders, global unread messages, and pending contracts.
- **Org Management:** Create organizations and generate unique Access Codes for client onboarding.
- **Production Truth:** Manage order timelines, update production steps, and post status updates.
- **Global Communication:** Access a unified chat interface to talk to any individual client organization.
- **Media Master:** Upload final mockups/designs and view all client-uploaded brand assets.

### Role B: The Customer (Collaborator View)
*The Collaborator represents a client company (e.g., Nike). Multiple users can join one organization.*
- **Organization Isolation:** Clients only see their own designs, messages, and orders. Total privacy from other clients.
- **Order Tracking:** View a visual progress timeline for active orders.
- **Support Hub:** Access a dedicated chat window to talk directly to the Admin support team.
- **Asset Library:** Upload brand assets (logos, inspiration) and download final mockups provided by the Admin.

---

## Key Functional Modules

### 1. Authentication & Onboarding
- **The Access Gate:** New users sign up via Email/OIDC. If they are not linked to an organization, they are presented with an onboarding screen.
- **Access Codes:** Entering a specific code (e.g., `NIKE-7721`) permanently links the user to that organization’s workspace.
- **Session Persistence:** Users remain logged in for seamless access to updates.

### 2. Real-Time Communication Hub
- **Unified Messaging:** A Slack-style chat interface for both Admins (Global view) and Customers (Org view).
- **Notification Engine:** 
    - **Real-time Toasts:** Desktop-style notifications appear when new messages arrive.
    - **Unread Indicators:** Dynamic red dots appear on the "Global Chat" and specific client avatars when new content is pending.
- **Read Receipt Sync:** Tracking of the last read message per user/org, ensuring unread states clear accurately across different browsers.

### 3. Production & Order Management
- **Visual Timeline:** Orders move through four defined steps tracking the journey from request to delivery.
- **Stages:** Status labels include `Pending`, `Design`, `Production`, `Shipped`, and `Completed`.
- **Granular Control:** Admins manually advance the `timeline_step` (1-4) to provide visual progress bars for clients.
- **Order Details:** Each order supports structured metadata including item types, quantities, and specific design requirements.

### 4. Media & Asset Hub
- **Categorized Storage:** Assets are organized into folders: Brand Assets, Mockups, and Final Designs.
- **Collaborative Uploads:** Clients upload requirements (SVG logos, photos); Admins upload deliverables.
- **Unread Media Alerts:** Notification indicators appear when new files are uploaded by the opposite party.

### 5. Document & Contract Vault
- **Official Records:** Secure storage for invoices, licensing agreements, and print contracts.
- **Status Tracking:** Labels for "Paid," "Pending Signature," "Unpaid," or "Completed."

---

## User Flows

### Flow A: Client Onboarding
1. Admin creates "Organization X" in the Admin Dashboard.
2. System generates code `ORGX-1234`.
3. Client signs up at the portal and enters `ORGX-1234`.
4. Client is redirected to the Organization X private dashboard.

### Flow B: Order Progression
1. Client uploads brand assets to the Media Hub.
2. Admin receives a "New Upload" notification.
3. Admin creates an Order and updates the status as design work begins.
4. Admin uploads a Mockup for client approval.
5. Client receives a notification, views the mockup, and approves via Chat.

### Flow C: Real-Time Support
1. Client sends a message in the Chat Hub.
2. Admin (anywhere in the portal) sees a toast: "New message from [Client Name]".
3. Admin clicks "View Chat" in the toast or follows the red dot in the sidebar.
4. Admin replies; Client’s sidebar "Messages" icon lights up with a red dot.

---

## Visual & UX Principles
- **Modern & Professional:** Slate/Indigo color palette with a clean, high-contrast light mode.
- **Micro-Animations:** Subtle transitions for status updates and notification popups.
- **Sidebar-Focused Navigation:** Fixed left sidebar for rapid task switching.
- **Responsive Design:** Fully functional on mobile for on-the-go order checks and chatting.

---

## Security & Data Privacy
- **Row-Level Security (RLS):** Policies enforced at the database level to ensure clients can never query data belonging to other organizations.
- **Role Validation:** Middleware checks for `admin` role before granting access to `/admin/*` routes.
- **Isolated Storage:** Supabase Storage buckets partitioned by Organization ID.
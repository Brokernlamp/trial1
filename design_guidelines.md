# Gym Management Dashboard - Design Guidelines

## Design Approach

**Selected System:** Material Design with dashboard-optimized patterns
**Justification:** This data-intensive admin application requires proven patterns for complex information hierarchies, multiple data tables, and real-time metrics. Material Design provides robust components for enterprise dashboards while maintaining modern aesthetics.

**Key References:** Linear (clean data presentation), Asana (sidebar navigation), Stripe Dashboard (financial metrics layout)

**Core Principles:**
1. Information density over decorative elements
2. Scannable layouts with clear visual hierarchy
3. Immediate access to critical metrics
4. Consistent patterns for predictability

---

## Typography System

**Font Stack:**
- Primary: Inter (Google Fonts) - UI text, body content
- Monospace: JetBrains Mono - numerical data, timestamps, IDs

**Type Scale:**
- Hero Metrics: text-4xl/font-bold (48px) - dashboard stat numbers
- Section Headers: text-2xl/font-semibold (24px) - major sections
- Card Titles: text-lg/font-semibold (18px) - panel headers
- Body Text: text-sm/font-normal (14px) - general content, table cells
- Labels: text-xs/font-medium (12px) - form labels, metadata
- Captions: text-xs/font-normal (12px) - helper text, timestamps

**Special Typography:**
- Metric numbers use tabular-nums for alignment
- Status badges use text-xs/font-semibold with uppercase tracking

---

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Tight spacing: p-2, gap-2 (component internal padding)
- Standard spacing: p-4, gap-4, mb-4 (card content, form fields)
- Section spacing: p-6, mb-6 (panel padding, section margins)
- Page-level spacing: p-8, gap-8 (main content areas)

**Grid Structure:**
- Sidebar: fixed w-64 (256px) on desktop, collapsible drawer on mobile/tablet
- Main content: flex-1 with max-w-7xl container
- Dashboard cards: grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4
- Data tables: full-width within container with horizontal scroll on mobile

**Responsive Breakpoints:**
- Mobile: Single column, hamburger menu, stacked cards
- Tablet (768px+): Two-column grids, persistent sidebar toggle
- Desktop (1024px+): Full multi-column layouts, persistent sidebar

---

## Component Library

### Navigation
**Sidebar (Primary):**
- Fixed left sidebar with logo at top (h-16 with p-4)
- Nav items: p-3 with icon (w-5 h-5) + label, gap-3
- Active state: distinct visual treatment
- Collapsible groups for nested sections (Members, Financial, Reports)
- User profile at bottom with role indicator

**Top Bar:**
- h-16 with shadow-sm
- Left: Breadcrumb navigation (Dashboard > Members > Profile)
- Right: Search bar (w-96), notification bell with badge, dark mode toggle, user avatar
- Sticky positioning for scroll contexts

### Dashboard Cards
**Metric Cards (Real-Time Stats):**
- Elevated card with p-6
- Large number display (text-4xl) with icon
- Trend indicator: up/down arrow + percentage change (text-sm)
- Subtitle explaining metric (text-xs)
- Optional sparkline chart for inline trend

**Data Panel Cards:**
- Standard elevation with p-6
- Header: title (text-lg) + action buttons on right
- Content area with appropriate spacing
- Footer for pagination or summary stats where relevant

### Data Display
**Tables:**
- Striped rows for readability
- Sticky header on scroll
- Row height: h-12 for density
- Cell padding: px-4 py-3
- Action buttons: icon-only (w-8 h-8) aligned right
- Hover state on rows
- Empty state: centered icon + text + CTA

**Charts:**
- Recharts library with consistent color palette
- Card container with p-6
- Chart title + time period selector in header
- Responsive sizing maintaining aspect ratio
- Tooltips on hover with formatted data

**Status Badges:**
- Pill-shaped with px-3 py-1
- text-xs/font-semibold uppercase
- Semantic states: Active, Expired, Pending, Frozen
- Icon prefix for quick scanning

### Forms & Inputs
**Text Inputs:**
- h-10 with px-3
- Border with focus ring
- Label above (mb-2)
- Helper text below (text-xs, mt-1)
- Error state with red border + error message

**Select Dropdowns:**
- Consistent h-10 height
- Chevron icon on right
- Custom styled with proper focus states

**Date Pickers:**
- Inline calendar component
- Range selection for reports
- Quick presets: Today, This Week, This Month, Last 30 Days

**Buttons:**
- Primary: px-4 py-2, font-medium
- Secondary: same size, different treatment
- Icon-only: w-10 h-10 square or circular
- Button groups for related actions (gap-2)

### Modals & Overlays
**Modal Dialogs:**
- Centered overlay with backdrop blur
- Max width: max-w-2xl for forms, max-w-4xl for detailed views
- Header: title + close button (p-6)
- Content: p-6 with max-h-[calc(100vh-200px)] overflow-y-auto
- Footer: actions right-aligned (p-6)

**Slide-Over Panels:**
- Right-side slide for member details, quick edits
- w-full sm:max-w-md
- Full-height with internal scroll

**Alerts/Toasts:**
- Fixed position top-right
- Auto-dismiss after 5s
- Stacked for multiple notifications
- Icon + message + close button

### Lists & Search
**Member List:**
- Avatar (w-10 h-10) + name + metadata in compact rows
- Quick action buttons visible on hover
- Virtual scrolling for 500+ records performance

**Search & Filters:**
- Prominent search bar (h-10) with icon prefix
- Filter chips below showing active filters (dismissible)
- Advanced filters in dropdown panel

---

## Specialized Sections

### Dashboard Overview
- 4-column grid on desktop for key metrics
- Revenue chart: full-width below metrics
- Two-column layout for pending payments + today's attendance

### Calendar/Schedule Views
- Weekly calendar grid for classes
- Color-coded by class type
- Time slots on Y-axis, days on X-axis
- Click to view/edit class details

### WhatsApp Automation Panel
- Message template selector (sidebar-style)
- Preview pane showing formatted message
- Recipient selection (individual/bulk)
- Schedule controls for automated sends
- Sent history table below

---

## Animations

**Minimal, Purpose-Driven Only:**
- Sidebar collapse/expand: 200ms ease transition
- Modal/drawer entry: 250ms slide + fade
- Notification toasts: 300ms slide-in from top-right
- Chart data updates: 400ms ease
- NO decorative animations, page transitions, or scroll effects

---

## Accessibility

- All interactive elements keyboard navigable
- Focus indicators on all inputs/buttons
- ARIA labels for icon-only buttons
- Screen reader announcements for dynamic updates (new notifications)
- Color never sole indicator of status (use icons + text)
- Minimum touch target: 44x44px for mobile

---

## Images

**No hero images** - this is a data-focused admin dashboard.

**Avatar/Profile Images:**
- Member photos: circular, w-10 h-10 in lists, w-24 h-24 in profiles
- Fallback: initials on colored background
- Trainer photos: w-12 h-12 in class cards

**Empty States:**
- Simple icon illustrations (not photos)
- Centered with helpful text + CTA button
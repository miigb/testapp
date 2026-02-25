# Mobile Responsive Design

Date: 2026-02-25

## Goal

Improve the mobile experience (screens <= 768px) without changing the desktop UI or any feature behaviour.

## Approach

**CSS-only responsive layer** (Approach A — least disruptive).

- Single `@media (max-width: 768px)` block appended to `src/index.css`
- Zero changes to component logic, hooks, or state management
- Only JSX addition: one `<nav className="mobile-module-bar">` in App.tsx (hidden on desktop)
- One optional JS line: `scrollIntoView()` on tab change for the scrollable tab strip

## Breakpoint

768px — below existing 720px breakpoint. All mobile rules scoped here.

## Layout changes

### 1. Topbar collapse

- `.topbar.unified`: switch from `grid-template-columns: 320px 1fr` to single-column vertical stack
- `.brand-block`: shrink from 136px tall module cards to compact ~48px header row showing only active module name
- `.topbar-command`: full-width below brand row
- Search bar, action buttons, notification bell, user menu wrap into tighter row

### 2. Sub-tab scrollable strip

- `.tab-nav-inline`: `overflow-x: auto`, `flex-wrap: nowrap`, `-webkit-overflow-scrolling: touch`
- Tab buttons: `white-space: nowrap` with touch-adequate padding
- Optional: `scroll-snap-type: x mandatory` or `scrollIntoView()` on tab change

### 3. Bottom tab bar (module switcher)

- New `<nav className="mobile-module-bar">` in App.tsx
- Desktop: `display: none`
- Mobile: `display: flex; position: fixed; bottom: 0; left: 0; right: 0; height: 56px`
- 3 icons (Recibos, DS, Penhoras) with labels, active module highlighted
- Reuses existing `switchModule()` handler
- `.app-shell` gets `padding-bottom: 56px` on mobile

### 4. Sidebar as full-width drawer

- `.sidebar` on mobile: `width: 100vw` instead of 340px
- Overlay backdrop via `::before` on `.app-shell.sidebar-open` or simple div
- Close button enlarged to 44px touch target

### 5. Tables — horizontal scroll

- `.table-wrapper` / `<table>` inside `.main-grid`: `overflow-x: auto`, `-webkit-overflow-scrolling: touch`
- No column hiding — all data accessible via scroll
- Sticky first column deferred to v2

### 6. Touch targets & spacing

- All buttons, tab items, interactive elements: `min-height: 44px; min-width: 44px`
- Form inputs: `font-size: 16px` (prevents iOS auto-zoom)
- Padding bumps on cards/sections for thumb comfort

## What stays the same

- All component logic and hooks
- Desktop styles (above 768px)
- All feature behaviour and data flow
- No new dependencies

## Risks

- Long `index.css` gets longer (~200-300 lines of mobile rules). Acceptable for v1; CSS split is a future track-2 item.
- Scrollable tab strip may need the one-line JS `scrollIntoView()` call — minimal invasion.

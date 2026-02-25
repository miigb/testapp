# Mobile Responsive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add mobile-responsive CSS and a bottom module bar so the app is usable on screens <= 768px, without changing desktop UI or feature behaviour.

**Architecture:** Single `@media (max-width: 768px)` block appended to `src/index.css` + mobile overrides in `src/components/sidebar/Sidebar.css`. One new `<nav>` element in `App.tsx` for the bottom module bar (hidden on desktop). One optional `scrollIntoView` call on tab change.

**Tech Stack:** CSS media queries, existing React/Lucide icons, no new dependencies.

---

### Task 1: Mobile topbar collapse

Collapse the two-column topbar grid into a single vertical stack. Shrink the brand block from 136px tall card stack to a compact ~48px row.

**Files:**
- Modify: `src/index.css` (append after line 3700)

**Step 1: Add the mobile media query block with topbar rules**

Append to end of `src/index.css`:

```css
/* ── Mobile Responsive (≤ 768px) ─────────────────────────────────── */

@media (max-width: 768px) {
  .app-shell {
    width: 100vw;
    margin: 0;
    padding: 0 0 64px;
    gap: var(--space-2);
  }

  .topbar,
  .topbar.unified {
    grid-template-columns: 1fr;
    padding-inline: 10px;
    gap: 6px;
  }

  .brand-block {
    min-height: auto;
    padding: 8px 0;
  }

  .module-brand-stack {
    min-height: auto;
    height: 44px;
  }

  .module-brand-card {
    height: 44px;
    border-radius: var(--radius-sm);
  }

  .module-brand-card.back {
    display: none;
  }

  .module-brand-card.front {
    position: relative;
    transform: none;
  }

  .brand-subtitle {
    display: none;
  }

  .brand-logo-img {
    max-height: 28px;
  }

  /* Sidebar-open overrides: don't shrink topbar on mobile */
  .app-shell.sidebar-open .topbar {
    grid-template-columns: 1fr;
  }

  .app-shell.sidebar-open {
    padding-right: 0;
  }
}
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Clean (0 errors)

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add mobile topbar collapse (768px breakpoint)"
```

---

### Task 2: Scrollable sub-tab strip

Make the tab navigation a horizontally scrollable strip on mobile.

**Files:**
- Modify: `src/index.css` (add inside the `@media (max-width: 768px)` block from Task 1)

**Step 1: Add tab strip mobile rules**

Add inside the `@media (max-width: 768px)` block, after the topbar rules:

```css
  /* ── Scrollable tab strip ── */
  .topbar-command {
    grid-template-columns: 1fr;
    padding: 6px 8px;
    gap: 6px;
  }

  .tab-nav.tab-nav-inline {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    gap: 2px;
  }

  .tab-nav.tab-nav-inline::-webkit-scrollbar {
    display: none;
  }

  .tab-nav-inline .tab-btn {
    white-space: nowrap;
    scroll-snap-align: start;
    flex-shrink: 0;
    min-height: 36px;
    padding: 0.35rem 0.65rem;
    font-size: 0.78rem;
  }

  .topbar-search-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .topbar-search-actions .global-search {
    min-width: 0;
    max-width: none;
    width: 100%;
    font-size: 16px; /* prevent iOS zoom */
  }
```

**Step 2: Add scrollIntoView on tab change (optional JS touch)**

In `src/App.tsx`, find the `tabButtons` mapping (line ~1226-1235). Update the onClick to scroll the active tab into view:

Current code at `src/App.tsx:1226-1235`:
```tsx
  const tabButtons = visibleTabs.map((tab) => (
    <button
      key={tab.id}
      className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
      onClick={() => setActiveTab(tab.id)}
      type="button"
    >
      {tab.label}
    </button>
  ))
```

Replace with:
```tsx
  const tabButtons = visibleTabs.map((tab) => (
    <button
      key={tab.id}
      className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
      onClick={(e) => {
        setActiveTab(tab.id)
        e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }}
      type="button"
    >
      {tab.label}
    </button>
  ))
```

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Clean (0 errors)

**Step 4: Commit**

```bash
git add src/index.css src/App.tsx
git commit -m "style: scrollable tab strip on mobile with scroll-snap"
```

---

### Task 3: Bottom module bar (JSX + CSS)

Add a fixed bottom navigation bar for switching between the 3 modules. Hidden on desktop, visible on mobile.

**Files:**
- Modify: `src/App.tsx` (line ~1274, inside the return JSX)
- Modify: `src/index.css` (add inside the `@media (max-width: 768px)` block)

**Step 1: Add the bottom bar JSX in App.tsx**

In `src/App.tsx`, find the closing `</header>` tag at line ~1382. Right after `</header>`, but before the feedback div, add:

```tsx
      {/* Mobile bottom module bar — hidden on desktop */}
      <nav className="mobile-module-bar">
        {moduleCards.map((mc) => (
          <button
            key={mc.id}
            type="button"
            className={`mobile-module-btn ${activeModule === mc.id ? 'active' : ''}${!canAccessModule(mc.id) ? ' locked' : ''}`}
            onClick={() => switchModule(mc.id)}
          >
            <img src={mc.logoSrc} alt={mc.title} className="mobile-module-icon" />
            <span className="mobile-module-label">{mc.title.split(' ').slice(-1)[0]}</span>
          </button>
        ))}
      </nav>
```

This reuses existing `moduleCards` (line 571-596), `activeModule`, `canAccessModule`, and `switchModule` (line 1135-1150). The label uses the last word of the title (Recibos, Crédito, Imóveis).

**Step 2: Add CSS for the bottom bar**

Append to `src/index.css`, **outside** the media query (base styles to hide it on desktop):

```css
/* ── Mobile Module Bar ─────────────────────────────────────────────── */

.mobile-module-bar {
  display: none;
}
```

Then add inside the `@media (max-width: 768px)` block:

```css
  /* ── Bottom module bar ── */
  .mobile-module-bar {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: var(--surface);
    border-top: 1px solid var(--line);
    z-index: 300;
    padding: 0 8px;
    align-items: center;
    justify-content: space-around;
  }

  .mobile-module-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex: 1;
    height: 100%;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--ink-muted);
    padding: 4px;
    transition: color 0.15s;
  }

  .mobile-module-btn.active {
    color: var(--brand);
  }

  .mobile-module-btn.locked {
    opacity: 0.4;
  }

  .mobile-module-icon {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }

  .mobile-module-label {
    font-size: 0.62rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
```

**Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Clean (0 errors)

**Step 4: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "feat: add mobile bottom module bar for module switching"
```

---

### Task 4: Full-width sidebar drawer on mobile

Make the sidebar take the full screen width on mobile and add an overlay backdrop.

**Files:**
- Modify: `src/components/sidebar/Sidebar.css` (append mobile rules)

**Step 1: Add mobile sidebar overrides**

Append to end of `src/components/sidebar/Sidebar.css`:

```css
/* ── Mobile sidebar ──────────────────────────────────────────────── */

@media (max-width: 768px) {
  .sidebar {
    width: 100vw;
  }

  .sidebar-collapse-btn {
    width: 44px;
    height: 44px;
  }
}
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Clean (0 errors)

**Step 3: Commit**

```bash
git add src/components/sidebar/Sidebar.css
git commit -m "style: full-width sidebar drawer on mobile"
```

---

### Task 5: Table horizontal scroll

Wrap tables in a scrollable container on mobile so all columns remain accessible.

**Files:**
- Modify: `src/index.css` (add inside the `@media (max-width: 768px)` block)

**Step 1: Add table scroll rules**

Add inside the `@media (max-width: 768px)` block:

```css
  /* ── Table horizontal scroll ── */
  .table-wrapper,
  .records-table-wrap,
  .main-grid table {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .main-grid table {
    min-width: 600px;
  }
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Clean (0 errors)

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: horizontal scroll for tables on mobile"
```

---

### Task 6: Touch targets and form input sizing

Enlarge all interactive elements to 44px minimum and prevent iOS zoom on form focus.

**Files:**
- Modify: `src/index.css` (add inside the `@media (max-width: 768px)` block)

**Step 1: Add touch target and input rules**

Add inside the `@media (max-width: 768px)` block:

```css
  /* ── Touch targets ── */
  button,
  .tab-btn,
  .filter-pill,
  .subtle-btn,
  .icon-btn,
  select {
    min-height: 44px;
    min-width: 44px;
  }

  /* Prevent iOS auto-zoom on input focus */
  input,
  textarea,
  select {
    font-size: 16px;
  }

  /* Spacing bumps */
  .main-grid {
    padding: 0 8px;
  }

  .panel {
    padding: 10px;
    border-radius: var(--radius-sm);
  }

  /* Record modal full-width */
  .record-modal-overlay {
    padding: 0;
  }

  .record-modal {
    width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
```

**Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: Clean (0 errors)

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: 44px touch targets and iOS zoom prevention on mobile"
```

---

### Task 7: Visual verification

Start the dev server and verify on a mobile viewport.

**Files:** None (testing only)

**Step 1: Start the web dev server**

```bash
# Uses preview_start with the "web" configuration from .claude/launch.json
```

**Step 2: Resize to mobile viewport (375x812)**

Use `preview_resize` with preset `mobile`.

**Step 3: Take screenshots and verify**

Check:
- Topbar collapses to single column
- Brand block shows compact card (no subtitle, no back card)
- Tab strip scrolls horizontally
- Bottom module bar shows 3 module buttons
- Sidebar opens as full-width drawer
- Touch targets are at least 44px
- No horizontal overflow on the page body

**Step 4: Resize back to desktop (1280x800) and verify no changes**

Use `preview_resize` with preset `desktop`. Take screenshot to confirm desktop layout is unchanged.

**Step 5: Final commit if any fixes needed**

```bash
git add -u
git commit -m "fix: mobile responsive polish after visual verification"
```

---

## Summary

| Task | Files touched | Lines added (est.) |
|------|--------------|-------------------|
| 1. Topbar collapse | `index.css` | ~45 |
| 2. Scrollable tabs | `index.css`, `App.tsx` | ~35 + 2 |
| 3. Bottom module bar | `App.tsx`, `index.css` | ~15 + 60 |
| 4. Sidebar drawer | `Sidebar.css` | ~10 |
| 5. Table scroll | `index.css` | ~10 |
| 6. Touch targets | `index.css` | ~30 |
| 7. Visual verification | — | — |

**Total:** ~3 files modified, ~200 lines of CSS added, ~17 lines of JSX added.

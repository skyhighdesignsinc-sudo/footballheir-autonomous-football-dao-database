# Design Brief

## Purpose & Context
**Part 1:** Developer Portal — isolated, zero-leakage API consumer dashboard with key management, analytics, and billing. Productivity tool UI.
**Part 2:** Public Documentation Portal — accessible, searchable reference covering DAO governance, developer onboarding, and API integration. Educational/reference UI.

## Tone & Aesthetic
Technical clarity, confident hierarchy, no decoration. Data-first interface emphasizing metrics and control.

## Differentiation
Real-time rate limit gauge + pie/bar charts for usage breakdown. Multi-tab interface (Overview, My Keys, Usage Analytics, Billing) with responsive stacking.

## Color Palette

| Token                | Light OKLCH      | Dark OKLCH       | Usage                                 |
|----------------------|------------------|------------------|---------------------------------------|
| primary              | 0.55 0.18 142    | 0.75 0.22 142    | Active states, voting, accent CTAs    |
| chart-1 (primary)    | 0.55 0.18 142    | 0.75 0.22 142    | Primary chart color, key metric       |
| chart-2 (gold)       | 0.6 0.15 220     | 0.78 0.18 85     | Treasury, balance, power highlight    |
| chart-3 (red)        | 0.65 0.2 85      | 0.6 0.22 27      | Rate limits, warnings, overages       |
| chart-4 (blue)       | 0.7 0.15 30      | 0.65 0.15 220    | Secondary metrics, API calls          |
| chart-5 (purple)     | 0.6 0.18 280     | 0.65 0.18 280    | Tertiary object types, category       |
| destructive          | 0.577 0.245 27   | 0.6 0.22 27      | Revoke, delete, error states          |
| success (derived)    | 0.65 0.2 85      | n/a              | Active key, healthy balance           |

## Typography
- Display: Space Grotesk (600/700 for headings, tab titles)
- Body: Inter (400/500/600 for tables, metrics, descriptions)
- Mono: JetBrains Mono (400 for API keys, balances, technical data)

## Shape Language
- Border-radius: 4px base (minimal, technical feel)
- Spacing: 8px grid (tight density for data UI)
- Shadows: portal (`0 4px 6px -1px rgba(0,0,0,0.1)`) for card elevation

## Elevation & Depth
- Tab bar: border-b on card background
- Content panels: subtle shadow-portal for card lift
- Rate limit gauge: SVG overlay, no shadow (flat)
- Table rows: no elevation, hover state via background color shift

## Structural Zones

| Zone         | Light Background | Dark Background | Border              | Purpose                      |
|--------------|------------------|------------------|---------------------|------------------------------|
| Header/Tab   | card (1 0 0)     | card (0.14 0 0)  | border (0.9/0.22)   | Tabbed navigation            |
| Content      | background       | background (0.1) | none                | Main panel content           |
| Card         | card             | card (0.14)      | border              | Stats, key list, charts      |
| Footer/Billing| muted/40%        | muted/20%        | border-t            | Low-balance warning, history |

## Component Patterns
- **Tabs**: Semantic tab bar with focus indicators (ring), aria-selected, keyboard nav (arrow keys)
- **Key Management**: Table with status badge (active/revoked), inline actions (rename, rotate, revoke modals)
- **Gauge**: Circular SVG, 75px radius, stroke-dasharray animation, percentage labels
- **Charts**: Recharts Pie + Bar, custom tooltip, responsive container, dark mode colors
- **Forms**: Deposit input + token select, withdrawal form, date range picker
- **Modals**: Confirm dialogs for revoke/rotate, copy-to-clipboard for new keys
- **Status Badges**: Green (active), amber (warning), red (revoked/overused)

## Motion & Interaction
- Tab switch: instant, no fade
- Gauge fill: 0.3s ease-out stroke-dashoffset animation on balance/limit change
- Hover states: background color shift on table rows, button state changes
- Focus: ring-2 ring-primary on all interactive elements
- Reduced motion: all animations respect prefers-reduced-motion

## Constraints
- WCAG 2.1 AA contrast minimum on all text/backgrounds
- Keyboard navigation: Tab order logical, arrow keys for tabs
- Dark mode: default, all components tested
- Accessibility: semantic HTML, aria-labels for gauges/charts, form labels, error states
- Mobile: responsive stacking at 375px (cards full-width), 768px (tab bar reflow), 1024px+ (full grid)

## Signature Detail
Rate limit gauge as visual anchor — circular SVG progress indicator showing % consumption with color coding (green <50%, amber 50-80%, red >80%). Provides at-a-glance awareness of API quota usage vs. typical dashboard numeric display.

## Responsive Breakpoints
- **sm (640px)**: Single column, full-width cards, charts stack vertically
- **md (768px)**: Two-column for stats, pie + bar charts side-by-side begin
- **lg (1024px)**: Full layout, three-column stats, pie + bar charts side-by-side
- **xl (1280px)**: Full-featured portal with sidebar or expanded header space

---

# Public Documentation Portal Design

## Purpose & Context
Public-facing documentation system covering DAO governance, developer standards, and API integration. Accessible via `/docs` route with persistent left sidebar (desktop) and collapsible drawer (mobile). Content served from `/docs/*.md` files, managed by DAO via `#NewDynamicDoc` and `#EditDynamicDoc` proposals.

## Tone & Aesthetic
Technical clarity, educational hierarchy, governance-first tone. Clear navigation with category grouping (DAO, Developer, API). Zero marketing language — pure reference.

## Layout Architecture

| Zone | Desktop | Mobile | Purpose |
|------|---------|--------|---------|
| Header (top) | Fixed; above sidebar | Fixed; above content | Logo + sticky nav reference |
| Sidebar | Fixed left, w-64, sticky top-14 | Slide-out drawer on menu trigger | Navigation tree, search |
| Main | Responsive max-w-4xl, px-8 | Responsive px-4 | Markdown content |
| Info banner | Above content, bg-muted/30 | Above content, bg-muted/30 | DAO edit banner + suggest button |

## Color Palette (Dark Mode)

| Element | Color Token | OKLCH | Usage |
|---------|-------------|-------|-------|
| Sidebar bg | sidebar | 0.14 0 0 | Left nav background |
| Sidebar text | sidebar-foreground | 0.95 0 0 | Nav link text |
| Active nav | sidebar-primary | 0.75 0.22 142 | Selected doc highlight + border-l |
| Active nav bg | sidebar-primary/10 | blend | Subtle highlight for active state |
| Badge: DAO | primary/10 + primary text | 0.75/10% + 0.75 | Category badge for DAO docs |
| Badge: Developer | chart-2/10 + chart-2 text | 0.78/10% + 0.78 | Category badge for developer docs |
| Badge: API | chart-1/10 + chart-1 text | 0.75/10% + 0.75 | Category badge for API docs |
| Search input | sidebar-accent/50 | 0.2/50% | Search box background |
| Info banner bg | muted/30 | 0.18/30% | DAO edit notification panel |

## Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Doc title | Space Grotesk | 3xl/4xl | 700 | foreground |
| Section heading | Space Grotesk | 2xl | 600 | foreground |
| Body text | Inter | base | 400 | foreground |
| Code/keys | JetBrains Mono | sm | 400 | card + mono styling |
| Category badge | Inter | xs | 600 | token-specific |
| Sidebar heading | Inter | xs | 600 | sidebar-foreground/60 uppercase |
| Sidebar link | Inter | sm | 400/500 selected | sidebar-foreground |

## Sidebar Navigation Structure

```
📄 Documentation [Search input]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏛️ DAO
  ├─ DAO Governance Overview
  └─ Bootstrap Guide

👨‍💻 Developer
  ├─ ICP Coding Standards
  └─ Project Conventions

⚙️ API Reference
  ├─ API Basics
  └─ Authentication & Keys
```

Sections auto-collapse if no matching docs in filtered results.

## Component Patterns

| Component | Style | Behavior |
|-----------|-------|----------|
| **Sidebar** | Fixed left on desktop; w-64; overflow-y-auto; sticky top-14 | Slides out as drawer on mobile; triggers from hamburger menu |
| **Search box** | Input; pl-9 (search icon); bg-sidebar-accent/50 | Real-time filter; clear button appears when query exists |
| **Nav item** | `text-left px-3 py-2 rounded-sm`; hover states | Active: border-l-2 primary, bg-primary/10, font-medium; aria-current="page" when selected |
| **Section title** | `text-xs font-semibold uppercase tracking-wide` | Fixed at top of category; no scroll |
| **Info banner** | `bg-muted/30 p-4 md:p-6`; border-b | Contains 💡 icon + text + "Suggest an edit" link |
| **Markdown renderer** | `prose prose-invert` (from @tailwindcss/typography) | Code blocks: bg-card, border-border; tables: border-border; links: text-primary; headings: font-display |
| **Category badge** | Badge component; variant="outline"; token-specific colors | Displayed in doc header above title |
| **"Suggest edit" button** | Button variant="outline" size="sm"; gap-2 + ChevronRight icon | Triggers SuggestEditModal |
| **Edit modal** | Dialog; heading "Suggest an Edit"; textarea + submit; tracks docTitle | Sends message to DAO forum or governance |

## Mobile Responsiveness

| Breakpoint | Sidebar | Content | Navigation |
|------------|---------|---------|-----------|
| sm (375px) | Drawer (hidden by default) | px-4, full-width | Hamburger menu in sticky bar below header |
| md (768px) | Fixed left, w-64 | px-8, max-w-4xl centered | Hamburger hidden; sidebar visible |
| lg (1024px) | Fixed left, w-64 | px-8, max-w-4xl centered | Same as md |

Mobile sticky bar (below header) shows:
- "Documentation" label on left
- Menu icon on right (opens Sheet drawer)
- Closes drawer automatically when doc is selected

## Accessibility

- **Keyboard nav**: Tab through sidebar items, arrow keys cycle sections (optional enhancement), Enter to select
- **Focus states**: ring-2 ring-sidebar-ring on nav items
- **Headings**: Proper hierarchy (h1 title, h2 sections, h3 subsections)
- **ARIA**: `aria-current="page"` on active nav item, `aria-label` on search + menu buttons, `alt` on images
- **Color contrast**: WCAG AA on all text/background combos; badges use token colors with sufficient contrast
- **Search**: Real-time results update; no loading spinners (instant filter)
- **Screen readers**: Semantic HTML (nav, article, section); form labels; skip-to-content link inherited from main app

## Motion & Interaction

- **Sidebar open/close**: Sheet animation (Radix UI default, ~200ms)
- **Search filter**: Instant; no debounce; shows/hides sections dynamically
- **Nav item hover**: Background color shift to sidebar-accent/50; text brightens to foreground
- **Nav item active**: Border-l-2 primary animates in on selection
- **Link hover**: text-primary underlines on markdown links
- **Reduced motion**: All Radix Sheet/Dialog transitions respect prefers-reduced-motion

## Constraints

- WCAG 2.1 AA: All text meets 4.5:1 contrast on dark mode
- Dark mode required; no light mode
- Markdown parsing: Support `# h1` through `#### h4`, **bold**, *italic*, `code`, ```language code blocks, | tables |, - lists, links
- No scrolljacking; native scroll on sidebar and content
- No animations for users with prefers-reduced-motion
- Mobile-first: 375px minimum (iPhone SE)
- All external links: open in new tab with aria-label hint

## Signature Detail

**Live search filtering** — As user types, sidebar nav sections auto-collapse if no matching docs, maintaining visual hierarchy. Section headers remain sticky at top of sidebar overflow zone, providing context as user scrolls filtered results. "Suggest an edit" affordance available on every doc and in info banner, lowering friction for community contributions to governance-maintained documentation.

## Data Flow

1. **Page load**: DocsPage fetches all `.md` files from `/docs/` folder
2. **Search**: Client-side filter on title/description/category; instant re-render
3. **Doc select**: Content fetched (if not already cached) and MarkdownRenderer parses to HTML
4. **Edit suggestion**: Modal captures user input (name, email optional, suggestion text, docId) → sends to backend via proposal system or forum
5. **DAO update**: Admin uses `#NewDynamicDoc` or `#EditDynamicDoc` proposal to update `/docs/*.md`; page auto-refreshes on next visit (or via polling)

---

# Implementation Specification

## Files to Create

### 1. `/src/frontend/src/pages/DocsPage.tsx` (Main Container)

**Role:** Orchestrate doc loading, search filtering, sidebar/content layout, mobile responsiveness

**Key features:**
- State: selectedDocId, searchQuery, mobileOpen, docContents[], loading
- Effect: Fetch all `.md` files from DOC_SECTIONS on mount
- Memoize: filteredDocs based on searchQuery
- Render: Desktop sidebar (fixed) + mobile drawer, main content pane, info banner, edit modal
- Search: Real-time filter by title/description/category
- Mobile: Hamburger menu triggers Sheet drawer; closes on selection

**Dependencies:**
- Import from `@/components/ui/{button,input,sheet,badge}`
- Import from `lucide-react`
- Import `MarkdownRenderer` and `SuggestEditModal` from `@/components/docs/`

### 2. `/src/frontend/src/components/docs/MarkdownRenderer.tsx`

**Role:** Parse markdown string to styled HTML with syntax highlighting

**Key features:**
- Input: `content: string` (raw markdown)
- Output: JSX with `<div className="prose prose-invert dark:prose-invert">`
- Support: headings (h1-h4), bold, italic, code, code blocks, tables, lists, links, images
- Syntax highlighting: Prism (recommend `prism-react-renderer` or `highlight.js`)
- Custom styling: Code blocks bg-card, tables border-border, links text-primary

**Libraries:**
- Use `markdown-it` (lightweight) or `marked` for parsing
- Use `prism-react-renderer` for syntax highlighting
- Rely on Tailwind `@tailwindcss/typography` (already installed)

**Custom CSS (add to `index.css` @layer utilities):**
```css
.prose-code {
  @apply bg-card px-1.5 py-0.5 rounded text-xs font-mono border border-border;
}
.prose-pre {
  @apply bg-card border border-border rounded-sm p-4 overflow-x-auto;
}
.prose-table {
  @apply border-collapse w-full;
}
.prose-th, .prose-td {
  @apply border border-border px-3 py-2;
}
.prose-a {
  @apply text-primary hover:underline;
}
```

### 3. `/src/frontend/src/components/docs/SuggestEditModal.tsx`

**Role:** Dialog for users to suggest improvements to documentation

**Key features:**
- Props: `docTitle: string`, `onClose: () => void`
- Form fields: Name (optional), Email (optional), Suggestion (required textarea), Checkbox for credit
- Submit: POST to backend or generate forum link
- Validation: Suggestion required, email format if provided
- Success toast on submission

**Libraries:**
- Use `Dialog` from `@/components/ui/dialog`
- Use `Button`, `Input`, `Textarea` from shadcn
- Use `toast` from `sonner` for notifications

### 4. `/src/frontend/src/components/docs/SidebarNav.tsx` (Optional, can inline)

**Role:** Searchable, categorized navigation sidebar

**Key features:**
- Props: `docs: DocSection[]`, `selectedId: string`, `onSelect: (id: string) => void`
- Search box: Real-time input, clear button
- Sections: Auto-collapse if 0 matching docs
- Nav items: Active state has border-l-2 primary, bg-primary/10, aria-current="page"
- Mobile: Closes drawer on selection

**Or:** Inline into DocsPage.tsx to keep components minimal

## Integration Steps

### 1. Update App.tsx

```typescript
// Add to Page type
type Page = "home" | "proposals" | "governance" | "forum" | "api" | "docs";

// Add import
import { DocsPage } from "./pages/DocsPage";

// In AppInner JSX main element
{currentPage === "docs" && <DocsPage />}
```

### 2. Update Header.tsx

```typescript
// In navItems array, add:
{ id: "docs", label: t("nav.docs") },

// Update the onNavigate handlers to include "docs" page
```

### 3. Update i18n.ts

```typescript
// Add to translations
"nav.docs": "Docs",
```

### 4. Ensure `/docs/` directory exists with markdown files

- `/docs/dao-bootstrap-guide.md`
- `/docs/icp-coding-standards.md`
- `/docs/project-conventions.md`

(These files already exist in the repo)

### 5. Update Vite config (if needed)

Ensure static `/docs/` folder is copied to dist during build:
```javascript
// vite.config.ts
export default {
  // ... existing config
  publicDir: 'public',
  // Docs served from /docs/ endpoint
};
```

## Code Structure Reference

**DocsPage.tsx structure:**
```typescript
export function DocsPage() {
  // State: selectedDocId, searchQuery, mobileOpen, showEditModal, docContents, loading
  
  // Effect: Load all .md files on mount
  
  // Computed: filteredDocs = memoized filter by searchQuery
  
  // Render:
  // - Mobile sticky bar (hamburger menu)
  // - Main flex layout:
  //   - Sidebar (desktop fixed, mobile drawer via Sheet)
  //     - Search box
  //     - NavSection × 3 (DAO, Developer, API)
  //   - Main content
  //     - Info banner (DAO docs + Suggest edit)
  //     - Article header (Badge + Title + Description)
  //     - MarkdownRenderer(content)
  //     - Footer (Suggest edit button)
  // - SuggestEditModal (if showEditModal)
}

function NavSection({ title, docs, selectedId, onSelect }) {
  // Filter empty sections
  // Render section header + nav items
  // Nav item: onClick sets selectedDocId, closes mobile sidebar
}
```

**SidebarContent component (for reuse in desktop + mobile):**
```typescript
const SidebarContent = () => (
  <div className="flex flex-col h-full">
    {/* Search input */}
    {/* NavSection × 3 */}
  </div>
);

// Used in:
// - Desktop: <aside className="hidden md:flex"> <SidebarContent /></aside>
// - Mobile: <Sheet><SheetContent><SidebarContent /></SheetContent></Sheet>
```

## Styling Classes (add to index.css)

```css
@layer utilities {
  /* Prose overrides for dark mode */
  .prose-invert h1 { @apply text-foreground; }
  .prose-invert h2 { @apply text-foreground; }
  .prose-invert p { @apply text-foreground; }
  .prose-invert a { @apply text-primary hover:underline; }
  
  /* Custom doc-specific utilities */
  .doc-nav-active { @apply border-l-2 border-sidebar-primary bg-sidebar-primary/10 font-medium pl-2.5; }
  .doc-search-input { @apply bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground; }
  .doc-info-banner { @apply bg-muted/30 border-b border-border; }
}
```

## Testing Checklist

- [ ] Docs page loads at `/docs` route (controlled by currentPage state)
- [ ] All .md files fetch without 404 errors
- [ ] Search filters docs correctly (live, no debounce)
- [ ] Active doc highlighted in sidebar (border-l-2 + bg highlight)
- [ ] Mobile: Hamburger menu opens/closes drawer
- [ ] Mobile: Selecting doc closes drawer automatically
- [ ] Markdown renders with proper headings, code, tables, links
- [ ] Code blocks have syntax highlighting
- [ ] "Suggest edit" modal opens, accepts input, submits
- [ ] Mobile responsive at 375px, 768px, 1024px breakpoints
- [ ] WCAG AA: All text meets 4.5:1 contrast ratio
- [ ] Keyboard: Tab through nav items, Focus visible on all interactive elements
- [ ] aria-current="page" on active nav item
- [ ] Links in markdown open in new tab (target="_blank")
- [ ] No layout shift or scroll jank on mobile

## Optional Enhancements (Future)

1. Table of contents auto-generated from H2/H3 headings
2. "Previous/Next Doc" navigation at footer
3. Full-text search backend (if 50+ docs)
4. PDF export per doc
5. Version switcher for docs (v1.0, v2.0)
6. Breadcrumb navigation
7. Analytics: Track which docs are viewed most
8. Suggested related docs based on links

# Shared Layout, Navigation & Reusable Frontend UI — Ownership

**Migration identifier:** CR-ARCH-4F  
**Branch:** `refactor/batch4-shared-layout`  
**Closes:** #75  
**Prerequisites merged:** #71 (4B), #72 (4C), #73 (4D), #74 (4E)

---

## Overview

This document describes the final placement of shared layout primitives, navigation
shells and generic UI utilities inside `apps/web/src/components/`.

Before this change all shared components lived flat inside `components/` or in the
ad-hoc `components/student/` subfolder. After this change there are two clearly
scoped subdirectories:

| Directory | Purpose |
|---|---|
| `components/layout/` | Application shells — sidebars, navigation bars, theme wrappers, back-link navigation |
| `components/ui/` | Reusable UI primitives — modals, overlays, tables, animated counters, etc. |

No page routes, no API endpoints, and no package boundaries were changed. All moves
are pure file renames (tracked by git mv) with import-path updates only.

---

## Final component ownership

### `components/layout/` — Application shells & navigation

| File | Description | Consumers |
|---|---|---|
| `AdminSidebar.js` | Admin-role sidebar shell. Wraps `Sidebar`/`SidebarBody` provider from `ui/sidebar.tsx` for desktop hover-expand + mobile drawer. Includes role guard, nav links, identity block, change-password and logout actions. | `app/admin/layout.js` |
| `FacultySidebar.js` | Faculty-role sidebar shell. Custom aside + mobile bar; uses `useSearchParams` (must be wrapped in `<Suspense>` by its layout). | `app/faculty/layout.js` |
| `WorkspaceReturn.js` | Role-aware back-link navigation. Reads role from `localStorage` via `useSyncExternalStore`. Renders "← Dashboard" or "← Home" link; non-compact mode adds a secondary "CodeRank home" link. | `app/faculty/layout.js`, `app/profile/[username]/layout.js`, `features/coding-workspace/components/WorkspaceLayout.js` (compact), `features/practicals/components/StudentPracticals.js`, `features/practice/components/PythonDashboard.js`, `features/dashboard/components/StudentDashboard.js` |
| `WorkspaceReturn.module.css` | CSS module for WorkspaceReturn. | — |
| `StudentTheme.js` | Student theme context. `StudentThemeProvider` wraps children in a `data-student-theme` div; `useStudentTheme` reads context; `StudentThemeToggle` renders a light/dark toggle button. All use `useSyncExternalStore` with localStorage for reactive theme sync. | `app/student/layout.js`, `features/coding-workspace/components/WorkspaceLayout.js`, `features/practicals/components/StudentPracticals.js`, `features/dashboard/components/StudentDashboard.js` |

### `components/ui/` — Generic UI primitives

| File | Description | Consumers |
|---|---|---|
| `LogoutConfirmModal.js` | Native `<dialog>`-based logout confirmation. Traps focus, locks body scroll, restores previous focus on close. Props: `{ isOpen, onConfirm, onCancel }`. | `components/layout/AdminSidebar.js`, `components/layout/FacultySidebar.js`, `features/dashboard/components/StudentDashboard.js` |
| `LoadingOverlay.js` | Full-screen fixed overlay with spinner. Used as a processing indicator. | `app/faculty/page.js`, `features/auth/components/AccountSettings.js`, `features/courses/*`, `features/mapping/*`, `features/operations/*`, `features/profile/*`, `features/users/*` |
| `RefreshButton.js` | Accessible refresh button. 450ms minimum visual duration, `running` ref prevents double-invoke, `mounted` ref prevents setState-after-unmount. `aria-busy` and `aria-live` for accessibility. | `features/courses/*`, `features/mapping/*`, `features/profile/components/AdminProfileOverview.js`, `features/users/*` |
| `RefreshButton.module.css` | CSS module for RefreshButton. | — |
| `sidebar.tsx` | Tri-state sidebar provider/primitives (`Sidebar`, `SidebarBody`, `SidebarLink`, `useSidebar`). Desktop hover-expand + mobile drawer + keyboard trap. Used exclusively by `AdminSidebar`. | `components/layout/AdminSidebar.js` |
| `AnimatedNumber.tsx` | Animated counter. | dashboard and stats pages |
| `TextType.tsx` | Typewriter text animation. | home page |
| `data-table/` | Admin data table family (pagination, column header, status badge, skeleton, empty state). | admin feature pages |

---

## Import path mapping (before → after)

| Old import | New import |
|---|---|
| `@/components/AdminSidebar` | `@/components/layout/AdminSidebar` |
| `@/components/FacultySidebar` | `@/components/layout/FacultySidebar` |
| `@/components/WorkspaceReturn` | `@/components/layout/WorkspaceReturn` |
| `@/components/student/StudentTheme` | `@/components/layout/StudentTheme` |
| `@/components/LogoutConfirmModal` | `@/components/ui/LogoutConfirmModal` |
| `@/components/LoadingOverlay` | `@/components/ui/LoadingOverlay` |
| `@/components/RefreshButton` | `@/components/ui/RefreshButton` |

---

## What did NOT change

- No page routes were added, removed, or moved.
- No API endpoints were added, removed, or modified.
- No CSS class names or component APIs changed.
- `components/student/QuestionList.js` stays in `components/student/` — it is a
  student-feature-specific list renderer, not a shared primitive.
- `components/ui/sidebar.tsx` stays in `components/ui/` — it is a generic sidebar
  provider used by `AdminSidebar`; it is not an application shell itself.
- No backend packages, secrets, or database references were added to the web
  workspace.

---

## Verification

```
npm ci                            # workspace-level install
npm run lint:critical             # ESLint fast checks
npm test -- tests/architecture.test.mjs
npm test -- tests/final-separation.test.mjs
cd apps/web && npm run build      # production build
```

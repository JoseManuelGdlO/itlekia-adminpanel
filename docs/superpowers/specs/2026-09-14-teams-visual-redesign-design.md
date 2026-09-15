# Portal Admin Intelekia — Teams-inspired visual redesign

**Date:** 2026-09-14
**Status:** Approved
**Scope:** Visual layer only. No API, auth, role, or data-model changes.

## Purpose

The portal already works. The UI reads as an unstyled scaffold: a gray sidebar, loose headings, and bordered lists. This redesign gives it a Microsoft Teams–inspired shell (icon rail + labeled sidebar + top bar + canvas) using Intelekia Cloud brand colors so it feels like an Intelekia product, not a Teams clone and not generic shadcn gray.

Audience: internal admins and developers using the portal all day to manage projects, kanban tasks, users, and notes.

Single job of the visual system: make orientation instant (where am I, what can I do) and make the product recognizable as Intelekia.

## Brand source

Colors, wordmark, and isotipo come from [intelekia.cloud](https://intelekia.cloud), not intelekia.com.mx (that site uses a different, older mark).

Assets to vendor into `front/public/`:

- Isotipo (circuit-brain): `https://intelekia.cloud/assets/intelekia-isotipo-BtCdCoph.png`
- Horizontal logo: `https://intelekia.cloud/assets/intelekia-horizontal-BTcBo7Qz.png`

Do not hotlink these at runtime.

## Visual tokens

Map these into CSS variables in `front/src/index.css` (`:root` and shadcn theme hooks). All UI color must come from these tokens, not ad-hoc Tailwind palettes like `bg-gray-200` or `text-gray-600`.

| Token | Hex | Role |
|---|---|---|
| Ink navy | `#06212C` | Rail background, strong headings, wordmark |
| Teal | `#198F70` | Primary: buttons, active indicator, focus ring, links |
| Teal soft | `#3FA486` | Hover fills, secondary accent, “in progress” |
| Canvas | `#F2F5FF` | Main content background |
| Panel | `#FFFFFF` | Cards, sidebar, top bar, dialogs |
| Text | `#172033` | Body copy |
| Muted | `#667085` | Secondary copy, captions, timestamps |
| Line | `#DFE7F7` | Borders, table rules, column chrome |
| Danger | existing destructive token | Delete / destructive only |

Radius: 12px for cards and dialogs, 8px for controls, 999px for pills and avatars.

Shadows: one soft elevation for cards (`0 8px 24px rgba(23, 32, 51, 0.06)`). No stacked glow.

**Type**

- Headings / brand moments: **Space Grotesk** (weights 500–700), matching intelekia.cloud.
- UI / body: **Inter** (400–600). Replace Geist as the sans stack.
- Page title in the top bar: Space Grotesk 20px / 600.
- Sidebar labels: Inter 14px / 500.
- Captions / table meta: Inter 12px / 400, muted.

**Signature**

The thing this portal should be remembered by: the circuit-brain isotipo sitting in the navy rail, plus a 3px teal bar on the active nav item (Teams’ purple pill, recolored to Intelekia teal). Spend boldness there. Everything else stays quiet.

Do not use Teams purple. Do not use the coral from intelekia.com.mx.

## Shell architecture

`AppShell` becomes a three-zone chrome. Existing routes and role gating stay as they are.

```
+------+------------------+--------------------------------+
| Rail | Sidebar          | Top bar (title + user chip)    |
| 48px | ~220px           +--------------------------------+
| navy | white            | Canvas #F2F5FF                 |
| icons| labels           | padded content / white cards   |
+------+------------------+--------------------------------+
```

### Rail (48px, `#06212C`)

- Top: isotipo, 28px, linked to `/`.
- Nav icons (lucide-react), vertically stacked, 20px icons, 40px hit targets, centered.
- Active: 3px teal bar on the left of the rail button, icon in teal. Inactive icons are white at ~70% opacity.
- Bottom: circular avatar with user initials (from `user.name`). Logout is **not** in the rail.

Sidebar footer (always visible, keyboard-accessible): labeled **Salir** button. Do not hide logout behind hover or a nested menu.
- Same `NAV_ITEMS` and role filter as today. Developers still do not see Usuarios.

### Sidebar (~220px, white, right border `#DFE7F7`)

- Header: “Intelekia” in Space Grotesk + a muted “Portal” caption.
- Same nav items as the rail, with Spanish labels already in the app: Dashboard, Kanban, Proyectos, Usuarios, Notas y Recordatorios.
- Active row: background teal at ~12% (`#3FA486` @ 12%), text navy, optional matching small icon.
- This is not a second information architecture. It is the labeled twin of the rail so the product is usable without relying on icon memory.

### Top bar (48px, white)

- Left: current page title (derived from the route, not a second H1 competing with page content — pages keep a short heading or drop the duplicate if the top bar already names the page; prefer one visible H1 in the document, which can live in the top bar).
- Right: `{user.name}` + role chip (`Admin` | `Developer`) + avatar initials.
- No search field. There is no search API; a dead search box is out of scope.

### Canvas

- `main` scrolls independently; rail/sidebar/top bar stay fixed.
- Page padding 24px.
- Primary surfaces are white cards on the canvas, not raw bordered lists on white.

### Login (`/login`, no shell)

- Split layout: left pane navy with isotipo + “Intelekia” + one-line “Portal administrativo”. Right pane white form (email, password, teal **Ingresar**).
- Error: “Email o contraseña incorrectos” under the form, destructive color, no native `alert()`.
- After success, still `navigate('/')`.

### Responsive

- ≥1024px: full three-zone shell.
- <1024px: rail remains; sidebar collapses behind a menu button in the top bar. Overlay/drawer, not a permanent second column. Login stacks: brand strip on top, form below.

## Page treatments

Logic, API calls, and role checks stay as they are. Only structure and classes change.

### Dashboard

- Greeting: “Hola, {name}” + the existing role sentence as muted copy.
- 3 tiles for everyone (Kanban, Proyectos, Notas); 4th tile Usuarios if `role === 'admin'`. Each tile is a `Link` card: lucide icon in teal, label, one-line description. No invented metrics.

### Kanban

- Toolbar row: page context + project `<select>` + admin “Nueva tarea”.
- Columns as canvas cards (`#F2F5FF` / white), not `bg-gray-100`. Header = status label + count.
- Status dots on cards: todo muted, in_progress teal, review navy, done teal-soft.
- Task cards: white, 8px radius, title as link. Drag handle remains the card.

### Proyectos / Usuarios / Notas

- Create form in a white card above the list (admin-only where it already is).
- Collection in a white card: projects as rows with name, description, status pill (Activo / Archivado), archive action; users as a real table with header row on `#F2F5FF`; notes as rows with title, content, reminder badge, delete.
- Status pills: Activo = teal soft fill; Archivado = muted.
- Destructive buttons stay `variant="destructive"` but sit as outline/small, not a loud default block.

### Project / task detail

- Breadcrumb above the title: `Proyectos / {name}` or `Kanban / {title}`, linking back.
- Meta block (description) then a notes card.
- Empty notes: “Aún no hay notas” + existing create modal trigger. Never a blank list.

### Loading / empty / motion

- Replace bare “Cargando...” with a 3-line skeleton in the canvas.
- Focus ring: teal, 3px, offset 2px.
- Hover on nav/tiles: 120ms background transition.
- Honor `prefers-reduced-motion: reduce` (no transform/opacity transitions).

## Components and files

Create or restyle, nothing else.

| File | Responsibility |
|---|---|
| `front/src/index.css` | Tokens, fonts, base canvas/body |
| `front/src/components/AppShell.jsx` | Rail + sidebar + top bar |
| `front/src/pages/LoginPage.jsx` | Split branded login |
| `front/src/pages/DashboardPage.jsx` | Greeting + tiles |
| `front/src/pages/KanbanPage.jsx` + `KanbanColumn.jsx` + `TaskCard.jsx` | Column/card chrome |
| `front/src/pages/ProjectsPage.jsx` | Form card + row list |
| `front/src/pages/UsersPage.jsx` | Form card + table |
| `front/src/pages/NotesPage.jsx` + `NotesList.jsx` | Header + note rows |
| `front/src/pages/ProjectDetailPage.jsx` | Breadcrumb + notes card |
| `front/src/pages/TaskDetailPage.jsx` | Breadcrumb + notes card |
| `front/public/intelekia-isotipo.png` | Vendored isotipo |
| `front/public/intelekia-horizontal.png` | Vendored wordmark (login) |

Shared presentational pieces, only if they remove duplication without new behavior:

- `PageHeader` is **not** required if the top bar owns the title.
- A small `StatusPill` and `EmptyState` in `front/src/components/` are allowed.

shadcn `Button` / `Input` / `Card` / `Badge` stay. Recolor via CSS variables (`--primary` = teal, `--background` = canvas, `--sidebar` = panel, `--foreground` = text). Do not fork the primitive APIs.

## Out of scope

- New endpoints, fields, or roles
- Search, notifications, dark-mode toggle
- Dashboard charts or fake KPIs
- Changing Spanish copy except where a label is purely visual (e.g. “Logout” → “Salir”)
- Rewriting tests that assert behavior, except class-sensitive queries if any exist (today they query by text)

## Testing

- Keep `AppShell.test.jsx`: admin sees “Usuarios”, developer does not. Update queries if the label is split across elements, but the visible text must remain `Usuarios`.
- Login, projects, kanban, notes, users tests keep passing. If a test looks for `Logout`, update it to `Salir` in the same change as the label.
- Add one shell test: the isotipo (alt “Intelekia”) is in the document for an authenticated user.
- Visual check in the running app: login, dashboard, kanban, projects, users (admin), notes, one detail page, and the developer nav (no Usuarios). Desktop and a ~768px width.

## Error handling

Unchanged at the API layer. Visual-only rules:

- Login error remains inline under the form.
- Failed kanban status updates still revert via the existing refetch; no new toast system.
- Missing project/task on detail pages: “No se encontró” in the canvas, not a blank screen.

## Constraints

- Match existing code style in `front/` (JSX, functional components, Tailwind utility classes).
- Do not add a CSS-in-JS library.
- Do not change backend files.
- YAGNI: no extra settings page, theme switcher, or command palette.

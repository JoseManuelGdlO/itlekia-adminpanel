# Teams-inspired visual redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing portal-admin-intk frontend into a Teams-inspired shell (navy icon rail + labeled sidebar + top bar + canvas) using Intelekia Cloud brand colors, without changing APIs, roles, or data flows.

**Architecture:** Visual layer only. CSS tokens in `front/src/index.css` recolor shadcn primitives. `AppShell` becomes the three-zone chrome. Pages swap gray utility classes for tokenized cards, pills, and empty/skeleton states. Logos are vendored into `front/public/` (no hotlinking). Backend is untouched.

**Tech Stack:** React 19, Vite, Tailwind CSS 4, shadcn/ui, lucide-react, react-router-dom, Vitest, Testing Library. Fonts: Inter Variable + Space Grotesk Variable (`@fontsource-variable/*`).

## Global Constraints

- Spec is `docs/superpowers/specs/2026-09-14-teams-visual-redesign-design.md` — implement it verbatim.
- Do not change backend files, endpoints, fields, or roles (`admin` | `developer`).
- Do not add search, notifications, dark-mode toggle, charts, or fake KPIs.
- All color must come from tokens. Ban new `bg-gray-*`, `text-gray-*`, `bg-blue-50`.
- Spanish labels stay except `Logout` → `Salir`.
- Tests that query by visible text (`Usuarios`, `Crear proyecto`, `To Do`, `Nueva tarea`, `Eliminar`) must keep passing.
- Do not add a CSS-in-JS library. Do not fork shadcn primitive APIs.
- Work only under `front/`.

## File map

| File | Role |
|---|---|
| `front/public/intelekia-isotipo.png` | Vendored circuit-brain mark |
| `front/public/intelekia-horizontal.png` | Vendored wordmark (login) |
| `front/src/index.css` | Tokens, fonts, reduced-motion |
| `front/index.html` | Title + favicon |
| `front/src/components/AppShell.jsx` | Rail + sidebar + top bar |
| `front/src/components/EmptyState.jsx` | Empty collection copy |
| `front/src/components/StatusPill.jsx` | Activo / Archivado |
| `front/src/components/PageSkeleton.jsx` | 3-line loading skeleton |
| `front/src/pages/LoginPage.jsx` | Split branded login |
| `front/src/pages/DashboardPage.jsx` | Greeting + tiles |
| Remaining page/kanban/notes files | Card chrome only |

---

### Task 1: Brand assets, fonts, and CSS tokens

**Files:**
- Create: `front/public/intelekia-isotipo.png`
- Create: `front/public/intelekia-horizontal.png`
- Modify: `front/src/index.css`
- Modify: `front/index.html`
- Modify: `front/package.json` (font packages)
- Modify: `front/src/main.jsx` (no logic change; fonts load via CSS)

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: CSS variables `--background` (canvas `#F2F5FF`), `--foreground` (`#172033`), `--primary` (teal `#198F70`), `--card`/`--popover`/`--sidebar` (panel `#FFFFFF`), `--muted-foreground` (`#667085`), `--border`/`--input` (`#DFE7F7`), `--ring` (teal), `--rail` (`#06212C`), `--teal-soft` (`#3FA486`). Tailwind utilities `bg-rail`, `bg-teal-soft`, `font-heading`, `font-sans`. Public URLs `/intelekia-isotipo.png` and `/intelekia-horizontal.png`.

- [ ] **Step 1: Vendor the logos (do not hotlink)**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
curl -sL "https://intelekia.cloud/assets/intelekia-isotipo-BtCdCoph.png" -o public/intelekia-isotipo.png
curl -sL "https://intelekia.cloud/assets/intelekia-horizontal-BTcBo7Qz.png" -o public/intelekia-horizontal.png
ls -la public/intelekia-isotipo.png public/intelekia-horizontal.png
```

Expected: both files exist and are > 1KB.

- [ ] **Step 2: Swap Geist for Inter + Space Grotesk**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npm uninstall @fontsource-variable/geist
npm install @fontsource-variable/inter @fontsource-variable/space-grotesk
```

- [ ] **Step 3: Replace `front/src/index.css` with tokenized theme**

Write the full file:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/inter";
@import "@fontsource-variable/space-grotesk";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: "Space Grotesk Variable", sans-serif;
    --font-sans: "Inter Variable", sans-serif;
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --color-rail: var(--rail);
    --color-teal-soft: var(--teal-soft);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
    --shadow-card: 0 8px 24px rgba(23, 32, 51, 0.06);
}

:root {
    --background: oklch(0.971 0.014 272.7);
    --foreground: oklch(0.245 0.039 264.4);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.245 0.039 264.4);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.245 0.039 264.4);
    --primary: oklch(0.581 0.109 169.6);
    --primary-foreground: oklch(0.985 0 0);
    --secondary: oklch(0.971 0.014 272.7);
    --secondary-foreground: oklch(0.233 0.039 228.6);
    --muted: oklch(0.971 0.014 272.7);
    --muted-foreground: oklch(0.544 0.035 265.1);
    --accent: oklch(0.651 0.104 170.2 / 12%);
    --accent-foreground: oklch(0.233 0.039 228.6);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.927 0.023 264.5);
    --input: oklch(0.927 0.023 264.5);
    --ring: oklch(0.581 0.109 169.6);
    --chart-1: oklch(0.581 0.109 169.6);
    --chart-2: oklch(0.651 0.104 170.2);
    --chart-3: oklch(0.233 0.039 228.6);
    --chart-4: oklch(0.544 0.035 265.1);
    --chart-5: oklch(0.245 0.039 264.4);
    --radius: 0.75rem;
    --sidebar: oklch(1 0 0);
    --sidebar-foreground: oklch(0.245 0.039 264.4);
    --sidebar-primary: oklch(0.581 0.109 169.6);
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.651 0.104 170.2 / 12%);
    --sidebar-accent-foreground: oklch(0.233 0.039 228.6);
    --sidebar-border: oklch(0.927 0.023 264.5);
    --sidebar-ring: oklch(0.581 0.109 169.6);
    --rail: oklch(0.233 0.039 228.6);
    --teal-soft: oklch(0.651 0.104 170.2);
}

.dark {
    --background: oklch(0.233 0.039 228.6);
    --foreground: oklch(0.971 0.014 272.7);
    --card: oklch(0.245 0.039 264.4);
    --card-foreground: oklch(0.971 0.014 272.7);
    --popover: oklch(0.245 0.039 264.4);
    --popover-foreground: oklch(0.971 0.014 272.7);
    --primary: oklch(0.651 0.104 170.2);
    --primary-foreground: oklch(0.233 0.039 228.6);
    --secondary: oklch(0.269 0.03 228);
    --secondary-foreground: oklch(0.971 0.014 272.7);
    --muted: oklch(0.269 0.03 228);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0.03 228);
    --accent-foreground: oklch(0.971 0.014 272.7);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.651 0.104 170.2);
    --chart-1: oklch(0.651 0.104 170.2);
    --chart-2: oklch(0.581 0.109 169.6);
    --chart-3: oklch(0.971 0.014 272.7);
    --chart-4: oklch(0.544 0.035 265.1);
    --chart-5: oklch(0.245 0.039 264.4);
    --sidebar: oklch(0.245 0.039 264.4);
    --sidebar-foreground: oklch(0.971 0.014 272.7);
    --sidebar-primary: oklch(0.651 0.104 170.2);
    --sidebar-primary-foreground: oklch(0.233 0.039 228.6);
    --sidebar-accent: oklch(0.269 0.03 228);
    --sidebar-accent-foreground: oklch(0.971 0.014 272.7);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.651 0.104 170.2);
    --rail: oklch(0.205 0.03 228);
    --teal-soft: oklch(0.651 0.104 170.2);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans;
  }
  html {
    @apply font-sans;
  }
  h1, h2, h3, .font-heading {
    font-family: var(--font-heading);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Update `front/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/intelekia-isotipo.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Intelekia · Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Verify tokens landed**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
grep -n "color-rail\|198F70\|Space Grotesk Variable\|Inter Variable" src/index.css
test -f public/intelekia-isotipo.png && test -f public/intelekia-horizontal.png && echo ASSETS_OK
```

Expected: CSS hits for rail + Inter/Space Grotesk; `ASSETS_OK`. Hex `#198F70` may only appear in comments; the oklch primary `0.581 0.109 169.6` is the teal token — confirm `--primary: oklch(0.581 0.109 169.6)` is present.

- [ ] **Step 6: Commit**

```bash
git add front/public/intelekia-isotipo.png front/public/intelekia-horizontal.png front/src/index.css front/index.html front/package.json front/package-lock.json
git commit -m "$(cat <<'EOF'
style: add Intelekia Cloud tokens, fonts, and logos

EOF
)"
```

---

### Task 2: Teams-style AppShell (rail + sidebar + top bar)

**Files:**
- Modify: `front/src/components/AppShell.jsx`
- Modify: `front/src/components/AppShell.test.jsx`

**Interfaces:**
- Consumes: `/intelekia-isotipo.png`; tokens `bg-rail`, `bg-sidebar`, `bg-accent`, `text-primary`, `border-sidebar-border`; `useAuth()` `{ user: { name, role }, logout }`; existing routes `/`, `/kanban`, `/projects`, `/users`, `/notes`.
- Produces: `AppShell({ children })` with rail NavLinks (`aria-label` = item label), sidebar labeled NavLinks (visible text unchanged), top-bar `<h1>` from `pageTitle(pathname)`, footer button text `Salir` calling `logout()`. `userInitials(name)` returns up to two uppercase letters. Sidebar is in the DOM at all breakpoints (hidden off-canvas below `lg`, not unmounted).

- [ ] **Step 1: Extend the failing tests in `front/src/components/AppShell.test.jsx`**

Replace the file with:

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppShell from './AppShell';
import { AuthContext } from '../context/AuthContext';

function renderWithUser(role, { path = '/' } = {}) {
  return render(
    <AuthContext.Provider
      value={{ user: { id: 1, name: 'Test User', role }, loading: false, logout: vi.fn() }}
    >
      <MemoryRouter initialEntries={[path]}>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AppShell', () => {
  it('shows the Usuarios link for admins', () => {
    renderWithUser('admin');
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('hides the Usuarios link for developers', () => {
    renderWithUser('developer');
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
  });

  it('renders the Intelekia isotipo', () => {
    renderWithUser('admin');
    expect(screen.getByAltText('Intelekia')).toBeInTheDocument();
  });

  it('shows a visible Salir control', () => {
    renderWithUser('admin');
    expect(screen.getByRole('button', { name: 'Salir' })).toBeInTheDocument();
  });

  it('sets the top-bar title from the route', () => {
    renderWithUser('admin', { path: '/kanban' });
    expect(screen.getByRole('heading', { level: 1, name: 'Kanban' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/AppShell.test.jsx
```

Expected: FAIL — no `alt="Intelekia"`, still `Logout`, no `h1` Kanban.

- [ ] **Step 3: Implement `front/src/components/AppShell.jsx`**

```jsx
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Columns3,
  FolderKanban,
  LayoutDashboard,
  Menu,
  StickyNote,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'developer'] },
  { to: '/kanban', label: 'Kanban', icon: Columns3, roles: ['admin', 'developer'] },
  { to: '/projects', label: 'Proyectos', icon: FolderKanban, roles: ['admin', 'developer'] },
  { to: '/users', label: 'Usuarios', icon: Users, roles: ['admin'] },
  { to: '/notes', label: 'Notas y Recordatorios', icon: StickyNote, roles: ['admin', 'developer'] },
];

function pageTitle(pathname) {
  if (pathname.startsWith('/projects/') && pathname !== '/projects') return 'Proyecto';
  if (pathname.startsWith('/tasks/')) return 'Tarea';
  const titles = {
    '/': 'Dashboard',
    '/kanban': 'Kanban',
    '/projects': 'Proyectos',
    '/users': 'Usuarios',
    '/notes': 'Notas y Recordatorios',
  };
  return titles[pathname] || 'Intelekia';
}

export function userInitials(name) {
  if (!name) return '?';
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  );
}

function Avatar({ name }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 items-center justify-center rounded-full bg-teal-soft text-xs font-medium text-white"
    >
      {userInitials(name)}
    </span>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const items = NAV_ITEMS.filter((item) => item.roles.includes(user.role));
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Developer';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <nav
        aria-label="Principal"
        className="flex w-12 shrink-0 flex-col items-center bg-rail py-3"
      >
        <NavLink to="/" className="mb-4 flex size-10 items-center justify-center">
          <img src="/intelekia-isotipo.png" alt="Intelekia" className="size-7 object-contain" />
        </NavLink>
        <div className="flex flex-1 flex-col items-center gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                aria-label={item.label}
                className={({ isActive }) =>
                  `relative flex size-10 items-center justify-center rounded-lg transition-colors duration-120 ${
                    isActive ? 'text-primary' : 'text-white/70 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <Icon className="size-5" />
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
        <Avatar name={user.name} />
      </nav>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-rail/40 lg:hidden"
          aria-label="Cerrar menú"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-12 z-30 flex w-56 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-120 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-start justify-between px-4 pt-4">
          <div>
            <p className="font-heading text-base font-semibold text-rail">Intelekia</p>
            <p className="text-xs text-muted-foreground">Portal</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Cerrar menú"
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </Button>
        </div>
        <nav className="mt-4 flex-1 space-y-1 px-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors duration-120 ${
                    isActive
                      ? 'bg-accent text-rail'
                      : 'text-foreground hover:bg-accent'
                  }`
                }
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="outline" className="w-full" onClick={() => logout()}>
            Salir
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              aria-label="Menú"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <h1 className="font-heading text-xl font-semibold">{pageTitle(pathname)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Avatar name={user.name} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run AppShell tests**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/AppShell.test.jsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add front/src/components/AppShell.jsx front/src/components/AppShell.test.jsx
git commit -m "$(cat <<'EOF'
feat: restyle AppShell as Teams rail, sidebar, and top bar

EOF
)"
```

---

### Task 3: Split branded login

**Files:**
- Create: `front/src/pages/LoginPage.test.jsx`
- Modify: `front/src/pages/LoginPage.jsx`

**Interfaces:**
- Consumes: `useAuth().login(email, password)`, `/intelekia-isotipo.png`, tokens `bg-rail`, `text-primary`.
- Produces: same submit behavior (`navigate('/')` on success; inline `Email o contraseña incorrectos` on failure). Visible heading text `Intelekia`. Button text still `Ingresar`.

- [ ] **Step 1: Write `front/src/pages/LoginPage.test.jsx`**

```jsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthContext } from '../context/AuthContext';

function renderLogin(login = vi.fn()) {
  return render(
    <AuthContext.Provider value={{ user: null, loading: false, login, logout: vi.fn() }}>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LoginPage', () => {
  it('shows Intelekia branding and the Ingresar action', () => {
    renderLogin();
    expect(screen.getByAltText('Intelekia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
  });

  it('shows an inline error when login fails', async () => {
    const login = vi.fn().mockRejectedValueOnce(new Error('bad'));
    renderLogin(login);
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.c' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Ingresar' }).closest('form'));
    expect(await screen.findByText('Email o contraseña incorrectos')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new tests (expect fail on branding)**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/LoginPage.test.jsx
```

Expected: FAIL — no `alt="Intelekia"` (heading is still `Portal Admin`).

- [ ] **Step 3: Implement `front/src/pages/LoginPage.jsx`**

```jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Email o contraseña incorrectos');
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-col justify-center bg-rail px-8 py-10 text-white lg:w-[42%]">
        <img
          src="/intelekia-isotipo.png"
          alt="Intelekia"
          className="mb-4 size-14 object-contain"
        />
        <p className="font-heading text-3xl font-semibold">Intelekia</p>
        <p className="mt-2 text-sm text-white/70">Portal administrativo</p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-card px-6 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <h1 className="font-heading text-xl font-semibold">Ingresar</h1>
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full">
            Ingresar
          </Button>
        </form>
      </div>
    </div>
  );
}
```

There are now two accessible names `Ingresar` (h1 + button). The test uses `getByRole('button', { name: 'Ingresar' })` so it still passes. Keep the h1 as `Ingresar` or change it to `Bienvenido` if `getByRole('button')` collides — it should not.

- [ ] **Step 4: Re-run login tests**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/LoginPage.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/pages/LoginPage.jsx front/src/pages/LoginPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: brand the login screen with Intelekia split layout

EOF
)"
```

---

### Task 4: EmptyState, StatusPill, PageSkeleton

**Files:**
- Create: `front/src/components/EmptyState.jsx`
- Create: `front/src/components/StatusPill.jsx`
- Create: `front/src/components/PageSkeleton.jsx`
- Create: `front/src/components/EmptyState.test.jsx`
- Create: `front/src/components/StatusPill.test.jsx`

**Interfaces:**
- Produces:
  - `EmptyState({ message, action })` — renders `message`; if `action` is passed, renders it underneath.
  - `StatusPill({ status })` — `status === 'active'` → text `Activo` with teal-soft fill; otherwise text `Archivado` with muted fill.
  - `PageSkeleton()` — three pulse bars, `aria-label="Cargando"`, `aria-busy="true"`. No visible `Cargando...` string (detail tests look for project names, not this string).

- [ ] **Step 1: Write the failing tests**

`front/src/components/EmptyState.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders the empty copy and optional action', () => {
    render(<EmptyState message="Aún no hay notas" action={<button type="button">Nueva nota</button>} />);
    expect(screen.getByText('Aún no hay notas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva nota' })).toBeInTheDocument();
  });
});
```

`front/src/components/StatusPill.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusPill from './StatusPill';

describe('StatusPill', () => {
  it('labels active as Activo and archived as Archivado', () => {
    const { rerender } = render(<StatusPill status="active" />);
    expect(screen.getByText('Activo')).toBeInTheDocument();
    rerender(<StatusPill status="archived" />);
    expect(screen.getByText('Archivado')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests (expect fail — modules missing)**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/EmptyState.test.jsx src/components/StatusPill.test.jsx
```

Expected: FAIL with cannot find module.

- [ ] **Step 3: Implement the three components**

`front/src/components/EmptyState.jsx`:

```jsx
export default function EmptyState({ message, action }) {
  return (
    <div className="px-4 py-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
```

`front/src/components/StatusPill.jsx`:

```jsx
export default function StatusPill({ status }) {
  const active = status === 'active';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        active ? 'bg-teal-soft/20 text-rail' : 'bg-muted text-muted-foreground'
      }`}
    >
      {active ? 'Activo' : 'Archivado'}
    </span>
  );
}
```

`front/src/components/PageSkeleton.jsx`:

```jsx
export default function PageSkeleton() {
  return (
    <div className="space-y-3 p-6" aria-busy="true" aria-label="Cargando">
      <div className="h-4 w-48 rounded bg-border" />
      <div className="h-4 w-80 rounded bg-border" />
      <div className="h-4 w-64 rounded bg-border" />
    </div>
  );
}
```

- [ ] **Step 4: Re-run tests**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/components/EmptyState.test.jsx src/components/StatusPill.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/components/EmptyState.jsx front/src/components/EmptyState.test.jsx front/src/components/StatusPill.jsx front/src/components/StatusPill.test.jsx front/src/components/PageSkeleton.jsx
git commit -m "$(cat <<'EOF'
feat: add empty, status pill, and skeleton primitives

EOF
)"
```

---

### Task 5: Dashboard greeting + tiles

**Files:**
- Create: `front/src/pages/DashboardPage.test.jsx`
- Modify: `front/src/pages/DashboardPage.jsx`

**Interfaces:**
- Consumes: `useAuth().user.{name,role}`; React Router `Link`.
- Produces: greeting `Hola, {name}` (not an `h1` — shell owns `h1`). Role sentence unchanged. Tiles linking to `/kanban`, `/projects`, `/notes`; `/users` only when `role === 'admin'`. Tile visible text: `Kanban`, `Proyectos`, `Notas y Recordatorios`, `Usuarios`.

- [ ] **Step 1: Write `front/src/pages/DashboardPage.test.jsx`**

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import { AuthContext } from '../context/AuthContext';

function renderDash(role) {
  return render(
    <AuthContext.Provider value={{ user: { id: 1, name: 'Ada', role }, loading: false }}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('DashboardPage', () => {
  it('greets the user and shows admin tiles', () => {
    renderDash('admin');
    expect(screen.getByText('Hola, Ada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kanban/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Usuarios/ })).toBeInTheDocument();
  });

  it('hides the Usuarios tile for developers', () => {
    renderDash('developer');
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run (expect fail — no links)**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/DashboardPage.test.jsx
```

Expected: FAIL — no Kanban link.

- [ ] **Step 3: Implement `front/src/pages/DashboardPage.jsx`**

```jsx
import { Link } from 'react-router-dom';
import { Columns3, FolderKanban, StickyNote, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';

const TILES = [
  { to: '/kanban', label: 'Kanban', description: 'Tablero de tareas y estados.', icon: Columns3 },
  { to: '/projects', label: 'Proyectos', description: 'Proyectos activos y archivados.', icon: FolderKanban },
  { to: '/notes', label: 'Notas y Recordatorios', description: 'Notas sueltas y recordatorios.', icon: StickyNote },
  { to: '/users', label: 'Usuarios', description: 'Cuentas de admin y developers.', icon: Users, roles: ['admin'] },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const tiles = TILES.filter((tile) => !tile.roles || tile.roles.includes(user.role));

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="font-heading text-2xl font-semibold">Hola, {user.name}</p>
        <p className="text-sm text-muted-foreground">
          {user.role === 'admin'
            ? 'Tienes acceso completo a proyectos, tareas, usuarios y notas.'
            : 'Aquí verás un resumen de tus tareas asignadas.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link key={tile.to} to={tile.to}>
              <Card className="h-full shadow-[0_8px_24px_rgba(23,32,51,0.06)] transition-colors duration-120 hover:bg-accent">
                <CardContent className="space-y-2 pt-0">
                  <Icon className="size-5 text-primary" />
                  <p className="font-heading font-semibold">{tile.label}</p>
                  <p className="text-xs text-muted-foreground">{tile.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run dashboard tests**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/DashboardPage.test.jsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add front/src/pages/DashboardPage.jsx front/src/pages/DashboardPage.test.jsx
git commit -m "$(cat <<'EOF'
feat: add Intelekia dashboard shortcut tiles

EOF
)"
```

---

### Task 6: Kanban column and card chrome

**Files:**
- Modify: `front/src/pages/KanbanPage.jsx`
- Modify: `front/src/components/kanban/KanbanColumn.jsx`
- Modify: `front/src/components/kanban/TaskCard.jsx`
- Test: `front/src/pages/KanbanPage.test.jsx` (do not weaken assertions)

**Interfaces:**
- Consumes: existing `STATUSES`, `tasksApi`, `TaskFormModal`, dnd-kit.
- Produces: column header still contains exact strings `To Do`, `In Progress`, `Review`, `Done` as their own text nodes (so `getByText('To Do')` still matches). Count sits in a sibling `<span>`. Task cards keep rendering `task.title` as a `Link` to `/tasks/:id`. Status dot class keys: `todo` muted, `in_progress` primary, `review` rail, `done` teal-soft.

- [ ] **Step 1: Run existing kanban tests (baseline green)**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskFormModal.test.jsx
```

Expected: PASS before edits.

- [ ] **Step 2: Replace `front/src/components/kanban/KanbanColumn.jsx`**

```jsx
import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';

const COLUMN_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export default function KanbanColumn({ status, tasks }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-xl p-2 ring-1 ring-border ${
        isOver ? 'bg-accent' : 'bg-card'
      }`}
    >
      <h2 className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span>{COLUMN_LABELS[status]}</span>
        <span className="text-xs font-normal text-muted-foreground">{tasks.length}</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace `front/src/components/kanban/TaskCard.jsx`**

```jsx
import { useDraggable } from '@dnd-kit/core';
import { Link } from 'react-router-dom';

const DOT = {
  todo: 'bg-muted-foreground',
  in_progress: 'bg-primary',
  review: 'bg-rail',
  done: 'bg-teal-soft',
};

export default function TaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: String(task.id) });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-lg bg-card p-2 text-sm shadow-[0_8px_24px_rgba(23,32,51,0.06)] ring-1 ring-border"
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1 size-2 shrink-0 rounded-full ${DOT[task.status] || DOT.todo}`} />
        <Link to={`/tasks/${task.id}`} onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">
          {task.title}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Restyle the Kanban page chrome (logic unchanged)**

In `front/src/pages/KanbanPage.jsx`, replace the return’s outer markup only:

- Outer: `className="p-6"`
- Drop the page `<h1>Kanban</h1>` (shell already shows it). Keep the admin select + `TaskFormModal` in a `mb-4 flex items-center justify-end gap-2` toolbar.
- Select classes: `rounded-md border border-input bg-card px-2 py-2 text-sm`
- Columns wrapper: `flex gap-4 overflow-x-auto`

Keep `handleDragEnd`, data fetching, and `STATUSES` identical.

- [ ] **Step 5: Re-run kanban tests**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/KanbanPage.test.jsx src/components/kanban/TaskFormModal.test.jsx
```

Expected: PASS. If `getByText('To Do')` fails, the label is not in its own text node — fix the column header as in Step 2.

- [ ] **Step 6: Commit**

```bash
git add front/src/pages/KanbanPage.jsx front/src/components/kanban/KanbanColumn.jsx front/src/components/kanban/TaskCard.jsx
git commit -m "$(cat <<'EOF'
style: restyle kanban columns and task cards

EOF
)"
```

---

### Task 7: Projects, users, and notes collection chrome

**Files:**
- Modify: `front/src/pages/ProjectsPage.jsx`
- Modify: `front/src/pages/UsersPage.jsx`
- Modify: `front/src/pages/NotesPage.jsx`
- Modify: `front/src/components/notes/NotesList.jsx`
- Test: existing `ProjectsPage.test.jsx`, `UsersPage.test.jsx`, `NotesPage.test.jsx`
- Modify: `front/src/pages/NotesPage.test.jsx` (add empty-state case)

**Interfaces:**
- Consumes: `StatusPill`, `EmptyState`, `Card`, existing APIs.
- Produces: create-form labels/buttons unchanged (`Crear proyecto`, `Crear usuario`, `Nueva nota`, `Eliminar`). Project status shown via `StatusPill` (`Activo`/`Archivado`), not raw `active`. `NotesList` with `notes=[]` renders `Aún no hay notas`.

- [ ] **Step 1: Add empty-state test to `front/src/pages/NotesPage.test.jsx`**

Append inside `describe('NotesPage'`:

```jsx
  it('shows an empty state when there are no notes', async () => {
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);
    render(<NotesPage />);
    expect(await screen.findByText('Aún no hay notas')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run notes tests (expect fail on empty copy)**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/NotesPage.test.jsx
```

Expected: FAIL — empty list, no `Aún no hay notas`.

- [ ] **Step 3: Update `front/src/components/notes/NotesList.jsx`**

```jsx
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '../EmptyState';

export default function NotesList({ notes, onDelete }) {
  if (!notes.length) {
    return <EmptyState message="Aún no hay notas" />;
  }

  return (
    <ul className="divide-y divide-border">
      {notes.map((note) => (
        <li key={note.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-medium">{note.title}</p>
            <p className="text-sm text-muted-foreground">{note.content}</p>
            {note.isReminder && (
              <Badge variant="secondary" className="mt-1">
                Recordatorio: {new Date(note.remindAt).toLocaleString()}
              </Badge>
            )}
          </div>
          <Button variant="destructive" size="sm" onClick={() => onDelete(note.id)}>
            Eliminar
          </Button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Restyle `ProjectsPage.jsx` markup (keep handlers)**

- Outer: `className="space-y-6 p-6"` — no page `h1`.
- Admin form wrapped in `<Card className="shadow-[0_8px_24px_rgba(23,32,51,0.06)]"><CardContent className="flex flex-wrap items-end gap-2">…</CardContent></Card>`
- List wrapped in the same Card. Each row: name `Link`, description `text-sm text-muted-foreground`, `<StatusPill status={p.status} />`, archive `Button size="sm" variant="outline"`.
- Import `StatusPill`, `Card`, `CardContent`.

- [ ] **Step 5: Restyle `UsersPage.jsx` markup (keep handlers)**

- Outer: `space-y-6 p-6`, no `h1`.
- Form in a Card (labels `Nombre` / `Email` / `Password` must remain associated so `getByLabelText` still works).
- Native `<select>` classes: `rounded-md border border-input bg-card px-2 py-2 text-sm`
- Table in a Card: `thead` `bg-background text-left text-xs text-muted-foreground`, rows `border-t border-border`. Delete still `variant="destructive" size="sm"` with text `Eliminar`.

- [ ] **Step 6: Restyle `NotesPage.jsx`**

- Outer: `space-y-6 p-6`. Drop the `h1` (shell title). Keep the `NoteFormModal` in a right-aligned toolbar `flex justify-end`.
- Wrap `<NotesList />` in a Card.

- [ ] **Step 7: Run list-page tests**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/ProjectsPage.test.jsx src/pages/UsersPage.test.jsx src/pages/NotesPage.test.jsx src/components/notes/NoteFormModal.test.jsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add front/src/pages/ProjectsPage.jsx front/src/pages/UsersPage.jsx front/src/pages/NotesPage.jsx front/src/pages/NotesPage.test.jsx front/src/components/notes/NotesList.jsx
git commit -m "$(cat <<'EOF'
style: put projects, users, and notes in canvas cards

EOF
)"
```

---

### Task 8: Detail pages, missing-entity copy, and full regression

**Files:**
- Modify: `front/src/pages/ProjectDetailPage.jsx`
- Modify: `front/src/pages/TaskDetailPage.jsx`
- Modify: `front/src/pages/ProjectDetailPage.test.jsx`

**Interfaces:**
- Consumes: `PageSkeleton`, `EmptyState`, `NotesList`, `NoteFormModal`, `Link`.
- Produces: while `project`/`task` is `null` during fetch, render `<PageSkeleton />` not the string `Cargando...`. After fetch, if not found, visible text `No se encontró`. Breadcrumb on project: link text `Proyectos` href `/projects`. Breadcrumb on task: link text `Kanban` href `/kanban`. Existing test still finds `Website Revamp` and `Kickoff notes`.

- [ ] **Step 1: Extend `ProjectDetailPage.test.jsx`**

Add:

```jsx
  it('shows a not-found message when the project is missing', async () => {
    vi.spyOn(projectsApi, 'listProjects').mockResolvedValueOnce([]);
    vi.spyOn(notesApi, 'listNotes').mockResolvedValueOnce([]);

    render(
      <MemoryRouter initialEntries={['/projects/99']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('No se encontró')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run (expect fail)**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npx vitest run src/pages/ProjectDetailPage.test.jsx
```

Expected: FAIL — likely still `Cargando...` forever or a blank page, not `No se encontró`.

- [ ] **Step 3: Implement `ProjectDetailPage.jsx` visual structure**

Keep fetching. Distinguish loading vs missing with a local `loading` flag (start `true`, set `false` after `listProjects` resolves):

```jsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as projectsApi from '../api/projects';
import * as notesApi from '../api/notes';
import NotesList from '../components/notes/NotesList';
import NoteFormModal from '../components/notes/NoteFormModal';
import PageSkeleton from '../components/PageSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    projectsApi
      .listProjects()
      .then((projects) => {
        setProject(projects.find((p) => String(p.id) === id) || null);
      })
      .finally(() => setLoading(false));
    notesApi.listNotes({ projectId: id }).then(setNotes);
  }, [id]);

  function handleNoteCreated(note) {
    setNotes((prev) => [note, ...prev]);
  }

  async function handleNoteDelete(noteId) {
    await notesApi.deleteNote(noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }

  if (loading) return <PageSkeleton />;
  if (!project) return <div className="p-6 text-sm text-muted-foreground">No se encontró</div>;

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link to="/projects" className="text-primary hover:underline">
            Proyectos
          </Link>
          <span> / {project.name}</span>
        </p>
        <h2 className="font-heading text-xl font-semibold">{project.name}</h2>
        <p className="text-sm text-muted-foreground">{project.description}</p>
      </div>
      <Card className="shadow-[0_8px_24px_rgba(23,32,51,0.06)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Notas del proyecto</CardTitle>
          <NoteFormModal projectId={project.id} onCreated={handleNoteCreated} />
        </CardHeader>
        <CardContent>
          <NotesList notes={notes} onDelete={handleNoteDelete} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Mirror the same pattern in `TaskDetailPage.jsx`**

- Loading → `<PageSkeleton />`
- Missing → `No se encontró`
- Breadcrumb: `<Link to="/kanban">Kanban</Link> / {task.title}`
- Title as `h2`, description `text-muted-foreground`
- Notes card heading `Notas de la tarea` (keep this string; no current test depends on it)
- `NoteFormModal taskId={task.id}` unchanged

- [ ] **Step 5: Full frontend test suite**

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
npm test
```

Expected: all tests PASS.

- [ ] **Step 6: Visual check in the running app**

With `front` and `back` already on `npm run dev`, open the browser and walk:

1. Login split screen (navy + form), error on bad password, success to dashboard.
2. Dashboard tiles; click through Kanban, Proyectos, Notas, Usuarios (admin).
3. Kanban columns/cards; open a task detail breadcrumb back to Kanban.
4. Project detail breadcrumb; empty notes copy if none.
5. Resize ~768px: rail stays, sidebar becomes overlay via **Menú**, **Salir** still visible when sidebar is open.
6. Confirm no `bg-gray-*` / `text-gray-*` remain:

```bash
cd "C:\Users\Joczm\Desktop\freelancer\portal-admin-intk\front"
grep -R --include='*.jsx' -n "bg-gray-\|text-gray-\|bg-blue-50\|Logout\|Cargando\.\.\." src
```

Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add front/src/pages/ProjectDetailPage.jsx front/src/pages/ProjectDetailPage.test.jsx front/src/pages/TaskDetailPage.jsx
git commit -m "$(cat <<'EOF'
style: restyle project and task detail with breadcrumbs

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| Vendor logos from intelekia.cloud, no hotlink | 1 |
| Tokens navy/teal/canvas/panel/text/muted/line; Inter + Space Grotesk; reduced motion | 1 |
| Signature isotipo + 3px teal active bar | 2 |
| Rail 48px navy, sidebar labels, top bar title, Salir in sidebar footer | 2 |
| Sidebar not unmounted on mobile (overlay) | 2 |
| Login split navy/white, inline error | 3 |
| Empty / pill / skeleton primitives | 4 |
| Dashboard tiles, no fake KPIs | 5 |
| Kanban cards/columns, status dots, keep To Do labels | 6 |
| Collection cards, Activo/Archivado, Aún no hay notas | 7 |
| Breadcrumbs, skeleton, No se encontró | 8 |
| No API/role changes; Usuarios hidden from developers | 2 + 5 (existing filters) |
| Full visual pass desktop + ~768 | 8 |

No placeholders. `userInitials` is defined in Task 2 and only used there. `EmptyState` / `StatusPill` / `PageSkeleton` names are stable from Task 4 into Tasks 7–8.

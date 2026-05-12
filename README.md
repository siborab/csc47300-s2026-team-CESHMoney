# SpendWise

A shared-expense tracker built for **CSC 47300**. Demonstrates the full stack required by the final-project rubric:

- **React + Vite** front-end (Client-Side Rendering)
- **Express / Node.js** API server (all business logic lives here)
- **axios** for browser → API calls
- **Supabase (Postgres)** as the database, accessed only by the API server via `@supabase/supabase-js`
- **React Router** with dynamic, drill-down routes for both users and products
- An **Admin Interface** that supports full CRUD over users and products

---

## Architecture

```
┌──────────────────┐   axios     ┌────────────────────┐   supabase-js   ┌──────────────────┐
│  React (Vite)    │ ──────────▶ │  Express API       │ ──────────────▶ │  Supabase / PG   │
│  port 5173       │             │  port 3001         │                 │  (cloud DB)      │
└──────────────────┘             └────────────────────┘                 └──────────────────┘
   - Pages / routing               - Auth (bcrypt)
   - UI state                      - Business logic (split, validation)
   - Calls /api/*                  - All CRUD endpoints
```

Vite's dev server proxies `/api/*` to `http://localhost:3001`, so the front-end never talks to Supabase directly.

---

## Project layout

```
server/
  index.js              Express entry; mounts routers, runs seed on startup
  lib/
    supabase.js         Singleton supabase-js client
    seed.js             Creates demo admin + demo user on first run
    asyncHandler.js     Async error wrapping helper
  routes/
    auth.js             POST /api/auth/signup, /api/auth/login
    users.js            CRUD /api/users, /api/users/:id (profile + history)
    subscriptions.js    CRUD /api/subscriptions, /api/subscriptions/:id  (products)
    expenses.js         CRUD /api/expenses
    categories.js       CRUD /api/categories
  db/
    schema.sql          Run this once in the Supabase SQL editor
  .env.example          Template for server/.env

src/
  api/
    client.js           axios instance
    spendwise.js        Typed wrappers around every endpoint
  pages/
    HomePage.jsx
    SignInPage.jsx, SignUpPage.jsx
    DashboardPage.jsx
    UserProfilePage.jsx           /users/:id          (drill-down per user)
    SubscriptionsListPage.jsx     /subscriptions
    SubscriptionDetailPage.jsx    /subscriptions/:id  (drill-down per product)
    AdminPage.jsx                 /admin
    AdminUserDetailPage.jsx       /admin/users/:id
    AdminSubscriptionDetailPage.jsx /admin/subscriptions/:id
    BudgetTimelinePage.jsx, CurrencyConverterPage.jsx, ...
  utils/                           Frontend-only helpers (formatting, session)
```

---

## 1-Time Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Supabase project and tables

1. Go to [supabase.com](https://supabase.com), create a project.
2. In the dashboard, open **SQL Editor → New query**, paste the contents of
   [`server/db/schema.sql`](./server/db/schema.sql), and run it.
3. In **Project Settings → API**, copy:
   - **Project URL**
   - **service_role** key (anon key works too but service_role bypasses RLS)

### 3. Create `server/.env`

```bash
cp server/.env.example server/.env
```

Fill in:

```
SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
PORT=3001
```

> The service-role key gives full database access. Keep it out of git; the
> repo's `.gitignore` already excludes `server/.env`.

### 4. Run everything

```bash
npm run dev
```

This starts both processes in parallel via `concurrently`:

- **web** → Vite at <http://localhost:5173>
- **api** → Express at <http://localhost:3001>

On its first start the API server seeds two demo accounts (idempotent — safe to re-run):

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| admin | `admin@spendwise.com`  | `admin123` |
| user  | `demo@spendwise.com`   | `demo123`  |

---

## Useful scripts

| Command              | What it does                                                |
|----------------------|-------------------------------------------------------------|
| `npm run dev`        | Vite + Express together (default for local dev)             |
| `npm run web`        | Just the front-end                                          |
| `npm run server`     | Just the Express API                                        |
| `npm run server:watch` | Express with `node --watch` (auto-reload on changes)      |
| `npm run build`      | Production build into `dist/`                               |
| `npm run preview`    | Serve the production build locally                          |

---

## Maps to the rubric

| Requirement                                  | Where it lives                                                                            |
|----------------------------------------------|--------------------------------------------------------------------------------------------|
| React                                        | `src/main.jsx`, all `src/pages/*`                                                          |
| CSR + Web server + API server (Node)         | `src/api/client.js` (axios) → `server/index.js` (Express) → `server/lib/supabase.js`        |
| Most logic on API server                     | `server/routes/*` does validation, hashing, computation, DB access                          |
| Database                                     | Supabase Postgres, schema in `server/db/schema.sql`                                         |
| Admin Interface (CRUD)                       | `/admin`, `/admin/users/:id`, `/admin/subscriptions/:id`                                    |
| Dynamic routing — user drill-down + user id  | `/users/:id` (`src/pages/UserProfilePage.jsx`)                                              |
| Dynamic routing — product drill-down + product id | `/subscriptions/:id` (`src/pages/SubscriptionDetailPage.jsx`)                          |
| User can create new account                  | `/signup` → `POST /api/auth/signup`                                                         |
| User can create new product                  | `/subscriptions` → `POST /api/subscriptions`                                                |
| Admin sees account/product details on separate page | `/admin/users/:id`, `/admin/subscriptions/:id` (id is in the URL)                    |

---

## Features

The five functional features built throughout the semester:

1. **Expense tracking** with split-bill support — `Dashboard`
2. **Budget timeline** by category and by day — `Budget Timeline`
3. **Multi-currency converter** with lockable rate + favorites — `Currency Converter`
4. **Export center** for JSON / CSV — `Export Center`
5. **Subscription alerts** for upcoming bills and over-budget categories — `Subscription Alerts`

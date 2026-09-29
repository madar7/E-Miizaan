# E-Miizaan — Income & Expense Management System

Two independent apps:

```
e-miizaan/
  backend/    Node.js + Express + MongoDB (Mongoose) — the API
  frontend/   Static HTML/CSS/JS — calls the API over HTTP
```

They no longer share a server. Each runs on its own port and can be deployed
to different hosts (e.g. backend on Render, frontend on Netlify/Vercel).

## Pages

| Page | What it does |
|---|---|
| Sign in / Sign up (`index.html`) | Split card. Sign in with **username** (or the account email). Sign up needs full name, username, email, password. "Forgot password?" emails a reset link. |
| Dashboard | Income's Data and Expense's Data tiles (today, yesterday, this month, this year), plus Total Income, Total Expenses and **Balance** (income − expenses). |
| Add Category | Add, rename and delete income/expense categories. Renaming updates existing transactions; a category in use can't be deleted. Starter categories are created on first use. |
| Income / Expenses | Add, edit, delete entries. Search, filter by category and date range, paginated history. |
| Users (admin only) | List users, make/remove admin, activate/deactivate, delete (with their transactions). |

## Setup

**1. Backend**

```bash
cd backend
npm install
cp .env.example .env      # then edit it — at minimum MONGO_URI and JWT_SECRET
npm start                 # http://localhost:5000
```

**2. Frontend** (separate terminal)

```bash
cd frontend
npm start                 # http://localhost:3000 — no dependencies to install
```

Open **http://localhost:3000**. The frontend calls the backend at the URL set
in `frontend/js/config.js`:

```js
window.API_BASE_URL = "http://localhost:5000";
```

Change this one line when you deploy the backend somewhere else (e.g. to
`https://your-api.onrender.com`).

### CORS

The backend allows any origin by default, which is fine for local development.
For production, set `FRONTEND_ORIGIN` in the backend's `.env` to your deployed
frontend's exact URL, so only that site can call the API.

### Password-reset emails

`CLIENT_URL` in the backend's `.env` should point at wherever the **frontend**
is served (not the backend) — that's what gets embedded in reset-link emails.
Without SMTP configured, the reset link is just printed to the backend's
console, which is enough for local testing.

## Becoming the admin (owner)

Register your account, then from `backend/`:

```bash
node scripts/makeAdmin.js your-username     # or your email
```

Sign out and in again on the frontend; a **Users** link appears in the sidebar.

## Accounts created before usernames existed

Older accounts have no username yet. Sign in with the account **email** in the
Username box — it works the same way.

## API

All routes except `/api/auth/*` need `Authorization: Bearer <token>`.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | `{ name, username, email, password }` |
| POST | `/api/auth/login` | `{ username, password }` (username may be the email) |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/forgot-password` | `{ email }` |
| POST | `/api/auth/reset-password` | `{ email, token, password }` |
| GET/POST | `/api/categories` | List (`?type=`) / create `{ name, type }` |
| PUT/DELETE | `/api/categories/:id` | Rename `{ name }` / delete |
| GET/POST | `/api/transactions` | List (`?type=&category=&startDate=&endDate=&search=&page=&limit=`) / create |
| GET/PUT/DELETE | `/api/transactions/:id` | One / update / delete |
| GET | `/api/transactions/dashboard?today=YYYY-MM-DD` | Tile totals per type + balance |
| GET | `/api/transactions/summary` | Totals + per-category breakdown |
| GET | `/api/admin/users` | Admin: list users (`?search=&role=`) |
| PATCH/DELETE | `/api/admin/users/:id` | Admin: `{ role?, isActive? }` / delete |

## Notes

- Passwords are bcrypt-hashed; reset tokens are stored hashed and expire in 30 minutes.
- Every transaction and category is scoped to its owner; admins manage accounts but the API never exposes other users' transactions.
- The frontend's `server.js` is a plain static-file server (no build step, no dependencies) — swap it for any static host in production.
- Not built yet: report export (CSV/PDF), rate limiting on forgot-password.

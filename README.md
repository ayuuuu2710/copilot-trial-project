# FitBuddy — Fitness Tracker & Health Monitoring

FitBuddy is a private, responsive manual tracker for workouts, food, weight, and measurable fitness goals. It is a student-project v1 built as a MERN monorepo: React/Vite in `client/`, Express/Mongoose in `server/`, and MongoDB for persistent application data.

## Included

- Registration, sign-in, sign-out, and signed-in password changes with bcrypt password hashes, HTTP-only JWT cookies, server-side session revocation, same-site cookie settings, request-origin checks, and rate-limited authentication.
- Ownership-scoped profile, workouts, custom foods, food logs, weigh-ins, and goals. Each read, update, and deletion is filtered by the authenticated user on the server.
- Strength and cardio workout CRUD; the app does not calculate calories burned.
- Search over 60 approximate starter foods and user-owned custom foods. Nutrition uses a 100 g reference and snapshots values into each food log.
- Daily calorie and macro totals, an editable calorie target, BMI, local-calendar 7/30-day weight charts, and multiple active measurable goals.
- Metric and imperial input/display conversions, responsive dashboard with dark/light/system themes, a collapsible sidebar, accessible account controls, loading/empty states, and toast feedback.
- Authenticated JSON data export and password-confirmed account deletion. Exports do not include password hashes or session credentials.

Social features, wearables, barcode scanning, paid plans, AI recommendations, email verification, password recovery, notifications, external nutrition APIs, automatic tracking, and public deployment are intentionally excluded from v1. Password recovery is not offered because no secure email delivery provider is configured.

## Local setup

### Requirements

- Node.js 20 or newer and npm.
- A running MongoDB instance (MongoDB Community locally, or a local Docker container).

From the repository root:

```powershell
npm install
Copy-Item server\.env.example server\.env
```

Edit `server\.env` and set `MONGODB_URI` and a randomly generated `JWT_SECRET` of at least 32 characters. Do not commit this file or share its values. The example configuration uses `mongodb://127.0.0.1:27017/fitbuddy`.

Optional local MongoDB container:

```powershell
docker compose up -d mongo
```

Start both development servers:

```powershell
npm run dev
```

Open `http://localhost:5173`. The Vite development server proxies `/api` requests to Express at `http://localhost:4000`. The API health check is `GET http://localhost:4000/api/health`.

Useful commands:

```text
npm run dev:client   Start Vite only
npm run dev:server   Start Express only
npm run build        Build the production client bundle
npm test             Run the server and calculation tests
```

For a production-like local client preview, run `npm run build`, then `npm run preview --workspace client`. The Express process expects `MONGODB_URI`, `JWT_SECRET`, and the browser origin in `CLIENT_ORIGIN`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | API listen port; defaults to `4000`. |
| `NODE_ENV` | No | Use `production` behind HTTPS to enable secure cookies. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Signing key; the server refuses to start with fewer than 32 characters. |
| `CLIENT_ORIGIN` | Yes for deployment | Exact allowed browser origin; defaults to `http://localhost:5173` in app middleware. |

The client is served separately by Vite in development. Production hosting/reverse-proxy configuration is intentionally not included in this local-first v1.

## Architecture and API

```text
client/src/
  App.jsx, api.js, components.jsx, styles.css
  pages/                    Dashboard, workouts, nutrition, progress, goals, profile, settings
server/src/
  app.js, index.js           Express setup and MongoDB startup
  auth.js, middleware.js     Cookie auth, origin protection, validation, safe errors
  models.js                  Mongoose account, session, and owner-scoped record models
  schemas.js                 Zod request validation and public profile shape
  routes.js                  Authenticated profile, record, and summary endpoints
  calculations.js, foods.js  Pure formulas and the built-in starter-food list
server/test/                 Formula and Mongo-backed API integration tests
```

All authenticated API routes require the `fitbuddy_session` cookie. Mutating `/api` requests require the configured `Origin`; cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` in production. The 24-hour JWT includes a session ID that must still exist in MongoDB, so logout revokes the active credential immediately. The auth routes have a per-IP rate limit.

| Endpoint | Operations |
| --- | --- |
| `/api/auth/register`, `/login`, `/logout`, `/me`, `/change-password` | Account and session lifecycle |
| `/api/profile` | Read/update profile and calorie estimates |
| `/api/dashboard?date=YYYY-MM-DD` | Persisted daily totals, active-goal progress, BMI, and weight trends |
| `/api/workouts` | List/create; `/workouts/:id` update/delete |
| `/api/foods?search=...`, `/api/foods/custom` | Search starter/custom foods; custom-food CRUD |
| `/api/food-logs` | List/create; `/food-logs/:id` update/delete |
| `/api/weights` | List/create; `/weights/:id` update/delete |
| `/api/goals` | List/create; `/goals/:id` update/delete |
| `/api/account/export` | Export the authenticated user's profile and records as JSON |
| `/api/account` | Password-confirmed account and record deletion |
| `/api/food-logs/restore` | Restore a just-deleted food log from its saved snapshot |

Food logs store the food name and per-100 g nutrient snapshot, rather than a live foreign-key dependency. Deleting or editing a custom food therefore never silently changes existing nutrition history. Internal height and weight are centimeters and kilograms; workout resistance is kilograms and distance is kilometers. The profile's current weight follows the latest dated valid weigh-in when any exist; without weigh-in history, an optional manually entered profile weight can be used for an estimate.

The health records remain server-backed in MongoDB; the application does not provide offline storage or cloud-sync modes. Theme and sidebar-collapse preferences are stored only in the current browser. Notifications are not available because no scheduling or delivery service is configured.

## Calculation and data choices

The explicit implementation decisions, edge cases, goal rules, date semantics, and starter-food data convention are documented in [`docs/DECISIONS.md`](docs/DECISIONS.md). In summary:

- Daily estimate: Mifflin–St Jeor BMR, multiplied by the selected activity factor. The estimate is withheld for people under 18, missing/invalid measurements, unknown calculation coefficient, or unknown activity level. The estimate is informational, not medical advice; a user-edited target takes precedence.
- BMI uses kg / m², rounded to one decimal; it is withheld without valid height and weight and labeled as a limited screening measure.
- Starter foods are illustrative approximate values per 100 g, not laboratory measurements. Custom-food values are user-entered approximate values per 100 g.
- The dashboard's 7/30-day trends use the selected user's local calendar date (the browser supplies `YYYY-MM-DD`); absent dates are null and are not filled with invented measurements.
- Weight-goal progress follows the latest weight entry, workout goals count Monday through the selected dashboard date, calorie goals use the selected day's intake, and custom goals use a manually updated current value. Progress is clamped to 0–100%; meeting or overshooting a target is complete.

## Tests and readiness

`npm test` runs pure formula/data tests and API integration tests against an ephemeral MongoDB from `mongodb-memory-server`, including password-change session revocation, data export, and account deletion. The first test run may download a MongoDB test binary. No MongoDB service is needed for those tests; a MongoDB connection is required for the app itself.

The manual end-to-end checklist is in [`docs/manual-e2e.md`](docs/manual-e2e.md). Automated tests cover representative authentication, logout and password-change invalidation, input validation, ownership, CRUD, export/deletion, nutrition scaling, weight/profile synchronization, date windows, BMI, goals, and dashboard totals. Real-browser responsive/keyboard review and the full manual checklist remain necessary before release.

## Safety and privacy notes

FitBuddy is a manual record-keeping aid, not medical advice, a diagnosis, or a promise of health or weight outcomes. Account age minimum was unspecified in the PRD; signup does not impose one. Calorie estimates are adult-only. No administrator health-record viewer or third-party nutrition service is included. Treat local MongoDB and `.env` files as private; back up or delete the database according to your own data-retention needs.

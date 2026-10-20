# FitBuddy v1 implementation decisions

This document resolves the open technical and behavioral choices in the PRD. The choices are deliberately narrow and can be revised in a later version without changing the user-owned record model.

## Calorie estimate

Use the Mifflin–St Jeor equation in metric units:

- Female coefficient: `BMR = 10 × weightKg + 6.25 × heightCm − 5 × age − 161`
- Male coefficient: `BMR = 10 × weightKg + 6.25 × heightCm − 5 × age + 5`
- `TDEE estimate = round(BMR × activity multiplier)`

Activity multipliers: sedentary `1.2`, light `1.375`, moderate `1.55`, very active `1.725`. The profile asks the user optionally to select a coefficient used by this equation; this is not an account identity field. No estimate is produced unless age is 18–100, height is 80–250 cm, weight is 25–350 kg, a coefficient is selected, and activity is known. The estimate is neutral TDEE; the app does not apply a weight-loss/gain calorie deficit or claim an outcome. An editable override from 500 through 10,000 kcal takes precedence. Both the UI and docs call these numbers informational, not medical advice.

## Units and profile weight

MongoDB stores height in centimeters, weight/resistance in kilograms, and distance in kilometers. The browser performs explicit conversions for imperial presentation/input (`1 in = 2.54 cm`, `1 lb = 0.45359237 kg`, `1 mi = 1.609344 km`) and keeps unrounded canonical values in API records. Values are rounded for display only.

The newest dated valid weight entry (most recent creation time breaks same-day ties) is authoritative for `profile.currentWeightKg`. Creating, editing, or deleting a weigh-in recalculates this denormalized profile field. If no weight entry exists, a manually entered profile weight is retained and can support an estimate. Once weigh-in history exists, changing the profile weight directly cannot override the latest entry.

## Food data and deletion

The starter list contains 60 common foods with calorie/protein/carbohydrate/fat values for 100 g. They are clearly labeled approximate and illustrative; no exact laboratory provenance is asserted. This avoids an external nutrition API and avoids implying that generic household "servings" are precise. Custom-food input uses the same 100 g reference.

Each food log saves a nutrient/name snapshot when written or edited. A custom-food change affects future logs only. Custom-food deletion does not cascade into logs, and old logs remain readable and editable by selecting another available food.

## Goals and progress

- **Weight:** baseline is the user-specified starting value, defaulting to the latest profile weight when available. The newest dated weigh-in is current; without any entry, the baseline remains current. Users choose up/down direction and a target in their selected display unit.
- **Workout frequency:** current value is the number of workouts from Monday (UTC calendar-date arithmetic on the browser-selected date) through that selected dashboard date. Thus a Monday begins at zero and future days in the week are not presumed.
- **Daily calories:** current value is the selected date's sum of food-log calories; users choose a higher/lower direction.
- **Custom measurable:** user supplies baseline, current value, target, unit, and direction.

For all categories, completion is `current >= target` for up goals and `current <= target` for down goals. Progress is `(current − start)/(target − start)` for up goals and `(start − current)/(start − target)` for down goals, clamped to 0–100%. If the baseline equals or passes the target, the goal is 100% only when the completion comparison is satisfied, otherwise 0%. Completion is computed from persisted source records and is not stored as a second source of truth.

## Calendar-day trends

The browser supplies a date-only ISO string in its local timezone. The API validates it as a real calendar date and stores date-only records at UTC midnight to preserve that local calendar label across timezone boundaries. Dashboard windows include selected day plus the previous 6 or 29 calendar days. Missing weight dates are represented as `null`, not interpolated. Duplicate weigh-ins for a day use the latest created entry for that date.

## Authentication and privacy

Passwords use bcryptjs (12 rounds). A signed JWT is held only in an HTTP-only, `SameSite=Strict` cookie, secure in production, with a 24-hour expiry. Each JWT references a MongoDB session record; logout deletes that record, which revokes a still-unexpired JWT. The session collection has a TTL expiry index. Unsafe API methods require the exact configured browser `Origin`; this origin validation plus strict same-site cookies is the v1 cookie-based CSRF defense. Authentication endpoints are rate-limited. All record routes query by both record ID and authenticated owner ID; invalid or foreign identifiers return not-found responses.

Changing a password requires the current password, hashes the new password with bcrypt, deletes all existing session records, and creates a fresh session for the current browser. Account export includes only the authenticated user's public profile and records; account deletion verifies the current password and removes that user's records and sessions before removing the user. Password recovery is intentionally unavailable until an email delivery service and secure reset-token flow are configured. Notification controls are not shown as configurable because no notification scheduler or delivery service exists.

The selected appearance (`dark`, `light`, or `system`) and desktop sidebar-collapse state are browser-local UI preferences. Fitness data remains server-backed in MongoDB; there is no offline-first or cloud-sync mode. Reduced-motion behavior follows the operating-system preference using CSS media queries.

## Testing and presentation

Node's built-in test runner and Supertest exercise pure calculations and the Express API; `mongodb-memory-server` supplies a disposable database. Recharts provides weight charts. The client is a Vite SPA with a single React Router route per major user workflow. Responsive visual review in an actual browser and the manual checklist are still required; they are not represented as completed just because the production bundle builds.

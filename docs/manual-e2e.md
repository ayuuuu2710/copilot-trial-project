# Manual end-to-end checklist

Run the app locally with MongoDB and a configured `server/.env`. Check both a desktop viewport and a narrow mobile viewport. Use two separate accounts for privacy checks.

## Account and privacy

- [ ] Register a new account with a valid name, unique email, and 10+ character password.
- [ ] Try the same email again and confirm the UI explains the duplicate without exposing server details.
- [ ] Sign out, sign in again, and confirm the dashboard loads after refresh.
- [ ] Sign out, then replay the old session cookie against `GET /api/auth/me`; confirm it receives `401`.
- [ ] On registration, toggle password visibility, review strength feedback, and verify mismatched confirmation is blocked.
- [ ] Change the password with the correct current password; confirm the current session continues and another session plus the old password are rejected.
- [ ] Force a session to expire or remove its server-side session record; confirm a protected request returns the user to sign-in with a clear message.
- [ ] Create a record as Account A. Sign in as Account B and try to list, edit, and delete it by ID; confirm it is not disclosed or changed.
- [ ] Confirm the browser's session cookie is HTTP-only and has `SameSite=Strict`; confirm production uses `Secure`.
- [ ] Export data and check the downloaded JSON contains only the signed-in user's profile/records and no password hash or session credentials.
- [ ] Try account deletion with a wrong password, cancel the confirmation, then confirm deletion with the correct password and verify the account's old session no longer works.

## Profile and calculations

- [ ] Save age, height, weight, activity level, calculation coefficient, metric/imperial units, and an editable calorie target.
- [ ] Change units back and forth; verify values remain equivalent within the documented display-rounding tolerance.
- [ ] Confirm the calorie estimate appears only with valid adult measurements and a selected coefficient; edit a target and verify the dashboard uses the override.
- [ ] Create a weight entry and confirm it becomes the profile's current weight; edit/delete the newest entry and verify profile weight follows the latest remaining valid entry.
- [ ] Confirm BMI is hidden without required measurements and is labeled as limited screening information when shown.

## Records and summaries

- [ ] Create, view, edit, and delete one strength workout and one cardio workout; test invalid sets, reps, duration, distance, and date.
- [ ] Search for a starter food, log it in each meal type, change its serving quantity, and verify calories/macros scale from 100 g.
- [ ] Create, view, edit, and delete a custom food and a food log. Delete a custom food referenced by a log and verify the existing log snapshot remains.
- [ ] Create, edit, and delete weight entries on different dates; verify 7-day/30-day charts use the selected local dates and leave gaps empty.
- [ ] Create several active goals across weight, workout, calories, and custom categories. Verify direction, baseline, overshoot, pause, and completion behavior.
- [ ] Compare the dashboard's selected-day nutrition/activity totals against the underlying saved entries.
- [ ] Navigate previous/next/today on dashboard and nutrition dates; verify next-day navigation is disabled for today.
- [ ] Use recent food and duplicate-entry shortcuts, then undo a food-log deletion and confirm the saved snapshot is restored.
- [ ] Check empty, loading, validation, and network-error states on each major flow.

## Accessibility and responsive layout

- [ ] Complete registration, a log form, profile edit, and modal dismissal using only the keyboard.
- [ ] Confirm dialogs trap focus, restore focus when closed, and dismiss with Escape; verify all password visibility buttons have accessible names.
- [ ] Check visible focus, labels, actionable validation messages, and text contrast.
- [ ] At mobile width, confirm navigation, cards, charts, forms, dialogs, and actions remain usable without horizontal page scrolling.
- [ ] Switch dark/light/system themes, reload, and verify the selection persists; change system preference while System is selected.
- [ ] Collapse/expand the desktop sidebar and reload; verify its preference persists. At mobile width, verify hamburger and account dropdown navigation.
- [ ] Enable operating-system reduced motion and confirm animations are minimized.
- [ ] Verify Settings clearly reports notifications and password recovery unavailable without configured services; no fake delivery control is present.
- [ ] Confirm no calories-burned estimate, wearable, barcode, social, AI, or external nutrition integration appears.

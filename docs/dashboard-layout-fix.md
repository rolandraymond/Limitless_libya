# Dashboard layout correction

Apply after the workshop UI fix. No database, migration, scheduling or check-in logic changes.

- Group the top actions together instead of spreading them across the whole header.
- Keep one dashboard mode badge next to Scan QR (the scanner retains its own mode label).
- Show the existing event totals first, followed by a compact workshop summary and then Guests / Tables navigation.
- Remove duplicate mode badges, nested dark cards and internal implementation explanations.
- Match the action buttons to the navy/mint palette. Workshop metrics collapse to two columns on narrow screens.
- Preserve workshop closure/event opening notices and the local test-clock indicator.

Apply inside the project root:

```bash
unzip -o ~/Downloads/libya-dashboard-layout-fix.zip -d .
npm run build
```

## Correct manual test time

The supported date format uses a two-digit day, and the simulated date must be the event day (14 November), not today:

```dotenv
ATTENDANCE_TEST_NOW="2026-11-14T14:15:00+02:00"
```

Update that line in .dev.vars, keep the other values, restart the Worker and refresh attendance in /admin.
The compact strip should display `Local test clock` and the header should say `Workshop Check-in`.

Use `2026-11-14T15:55:00+02:00` for Paused, or `2026-11-14T16:00:00+02:00` for Event.
Restart the Worker and refresh after changing the frozen time.
The override still applies only to loopback backend requests; use the Vite URL/proxy for local testing. Remove the test clock after testing.

Even a correctly formatted `2026-11-02T14:15:00+02:00` is before the event date and should remain closed.

Validation: 29 existing backend tests pass and both edited TSX files parse. No browser render or full TypeScript/Vite build was run here because the browser and project dependencies are unavailable. Run the local build and inspect desktop/mobile after applying. No production action was performed.

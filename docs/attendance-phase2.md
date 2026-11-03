# Phase 2: dashboard modes, workshop answers and counters

This patch requires Phase 1 and migration 0006. There is no new migration in Phase 2.
No production deployment or production database changes have been performed.

## Delivered

- Persistent Workshop / Paused / Event badge beside Scan QR and guest check-in actions and inside the scanner.
- Workshop confirmation explicitly says no seat is assigned. Event uses its own independent attendance flag.
- Client mode follows server-calibrated time on 14 November 2026, Tripoli time:
  - 14:00 <= time < 15:55: Workshop check-in.
  - 15:55 <= time < 16:00: paused, buttons disabled.
  - time >= 16:00: Event check-in.
- A visible dashboard notice announces workshop closure and event opening. The server still enforces every boundary.
- Yes / No / Not Answered counts and actual Workshop Checked In count, each separate.
- Guest rows and guest details show workshop response and independent workshop / event attendance. Excel adds workshop fields (existing export size limit is unchanged).
- Existing guests can answer or edit the workshop question after phone lookup or directly on their /pass page. The same QR token identifies their existing record.
- New guests can choose Yes / No in the left registration section. Their answer is saved with registration. Unanswered remains NULL.
- Staff counts load on dashboard entry, focus, check-in and Refresh attendance. They are not a live subscription to replies on other devices yet.
- A client-only timer updates the displayed mode; it sends no periodic server requests. Guest invitations do not poll.

## Apply to the existing project

Stop the frontend and Worker development servers. In the existing project root:

```bash
unzip -o ~/Downloads/libya-attendance-phase2-patch.zip -d .
npm run test:attendance
npm run typecheck:worker
npm run build
```

Use Node 24 or a compatible newer release for the test suite. Tests use temporary in-memory SQLite.
If 0006 has not yet succeeded in your local database:

```bash
npx wrangler d1 migrations apply limitless-libya-db --local
```

This patch does not replace vite.config.ts. Your allowedHosts setting for the tunnel is preserved.
The updated worker/index.ts also removes any hand-edited hard-coded test time from the earlier manual instructions.

## Local manual test clock

In the existing `.dev.vars` file, add or update this one line (keep all other values):

```dotenv
ATTENDANCE_TEST_NOW="2026-11-14T14:15:00+02:00"
```

Start the servers in separate terminals:

```bash
npm run dev:worker
```

```bash
npm run dev
```

Use the Vite URL, log in to /admin and click Refresh attendance. A LOCAL TEST CLOCK banner must appear and the badge must say Workshop Check-in.
Choose an existing confirmed local test guest or register a test guest. Click Workshop Check In, confirm, and verify workshop attendance changes while event attendance remains Waiting and no regular seat is allocated.
The camera scanner uses the same mode and confirmation (camera access requires localhost or HTTPS).

To test the five-minute pause, edit `.dev.vars` to:

```dotenv
ATTENDANCE_TEST_NOW="2026-11-14T15:55:00+02:00"
```

Restart the Worker and click Refresh attendance. The badge says Paused, and check-in buttons are disabled.

To test event arrival with the same guest, edit it to:

```dotenv
ATTENDANCE_TEST_NOW="2026-11-14T16:00:00+02:00"
```

Restart the Worker and refresh attendance. The badge says Event Check-in. The same guest can be scanned again for the event and now receives a regular seat (or keeps their reserved VIP seat).

The test clock is frozen at the configured value, so it does not automatically run through boundaries. Change the value and refresh to test transitions.
Remove ATTENDANCE_TEST_NOW after testing. Production uses real server time.
Only localhost / 127.0.0.1 / IPv6 loopback requests can use this override. It cannot be supplied through a browser request, and is ignored on public hosts. To test via a tunnel, point it at Vite so the existing changeOrigin proxy sends /api calls to localhost:8787. A direct public-host Worker tunnel intentionally ignores the override.

## Test the answer counters

1. Register or load three local test guests.
2. For guest 1 choose Yes; guest 2 choose No; leave guest 3 unanswered.
3. Refresh attendance in /admin. Counts reflect all registered local guests, not only visible/search-filtered rows.
4. Workshop check-in changes attendance, not the guest's stored Yes / No answer.
5. Changing a saved answer updates the same guest, without duplicating registration or changing their QR.

## Verification

- All 29 API/database tests pass locally, including the prior 22 checks.
- All six modified/new TSX modules parse successfully with a TypeScript/JSX-capable Babel parser.
- No full browser/camera test or real D1/workerd integration test has been run in the preparation environment.
- Full TypeScript and Vite build remain to be run with project dependencies installed; they are not available here.
- Counts are refreshed on demand, not yet pushed live across staff devices.

## Still pending

Live guest-card updates / infinity transition to seat after event attendance; products carousel and invitation navigation.
No product images or presentation assets have been fabricated. No deployment has been performed.

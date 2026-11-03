# Workshop question and scanner correction

Apply this patch after attendance Phase 2. No backend or migration changes.

## Corrected flow

- Before a successful phone lookup, the workshop card is not rendered.
- A registered guest sees the workshop question beside their invitation only if the stored response is NULL.
- A successful Yes/No save updates the same invitation record and hides the question immediately.
- A failed save keeps the question visible with an error and allows retrying.
- Revisiting by the same phone number or invitation link does not show an already-answered question.
- A new guest sees the workshop choice with the registration form after the phone lookup returns Guest Not Found. The choice remains editable until registration succeeds. It then hides if an answer was saved; an unanswered guest can still answer afterward.
- There is no OTP or new identity check. Existing phone lookup and invitation tokens are unchanged.
- Scan QR is available at any time for invitation lookup. Actual workshop/event confirmation still follows the server's schedule.
- The card uses isolated CSS with explicit readable text colors, a clear selected state and mobile stacking. This overrides the old .rsvp-copy p colors only within the card.

## Apply locally

Stop Vite and the Worker, then run inside the existing project:

```bash
unzip -o ~/Downloads/libya-workshop-ui-fix.zip -d .
npm run test:attendance
npm run typecheck:worker
npm run build
```

Your vite.config.ts, .dev.vars and other local settings are not included or replaced.

## Manual check-in test

In `.dev.vars`, add or update the following line; keep all existing secrets and settings:

```dotenv
ATTENDANCE_TEST_NOW="2026-11-14T14:15:00+02:00"
```

Restart the two development processes in separate terminals:

```bash
npm run dev:worker
```

```bash
npm run dev
```

Open the Vite URL and sign in at /admin. Click Refresh attendance. You must see LOCAL TEST CLOCK and Workshop Check-in. Use a confirmed local test guest, then check in through the row or Scan QR. This records workshop attendance only, without assigning a regular seat.

For the pause, change the test time to `2026-11-14T15:55:00+02:00`, restart the Worker and refresh attendance. Scan QR must remain available; confirmation is disabled.

For event check-in, change it to `2026-11-14T16:00:00+02:00`, restart the Worker and refresh attendance. Check in the same guest again to record event attendance and assign their regular seat / preserve their reserved VIP seat.

The clock is frozen. It is accepted only for localhost/loopback backend requests. If using a tunnel, point it at Vite so the /api proxy targets localhost:8787. A public-host Worker request intentionally ignores the test override. Remove the line after testing.

## Manual question test

1. Open the home page with no guest loaded: there must be no workshop question.
2. Search for a registered guest with no prior response: question appears beside the invitation, with their name.
3. Choose Yes: after server success the question disappears. Refresh attendance in /admin: Yes increases, Not Answered decreases.
4. Search again for the same number: question remains hidden. Repeat using No for a different guest.
5. Simulate a failed save: the question and retry controls must remain visible; counters must not change.
6. Search an unknown valid number: choose Yes/No in the registration form. After registration succeeds the question disappears and the response is stored with that new record.

## Verification performed

- Existing API/database tests: 29/29 pass.
- Syntax parsing of the changed TSX modules passed.
- Additional component-logic checks used the actual transpiled components with a lightweight hook harness and mocked network: lookup gating, save-in-progress, failed save, successful save, saved Yes/No revisit, new registration and duplicate clicks.
- The local test environment does not have a browser executable, React runtime or project TypeScript/Vite dependencies installed. No real React/browser, camera, screenshot or full build validation was completed here. Run the commands and manual checks above in your local environment.

Guest-card live updates/infinity animation and products remain separate pending tasks. No deployment or production database operation was performed.

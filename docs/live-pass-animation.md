# Live invitation card: QR -> infinity -> table and seat

Implemented for `/pass` and both invitation results inside the home registration section.
This update requires the earlier attendance/workshop changes and D1 migration 0006.
No new D1 SQL migration is needed. Nothing has been deployed to production.

## Behavior

- Before Event Check-in: the QR remains visible; reserved seat numbers stay hidden.
- Workshop Check-in: the QR stays visible for the second scan at the event.
- Successful Event Check-in: attendance and seat allocation are committed, then only that guest's connected cards receive a WebSocket update.
- The QR is replaced by a glowing infinity drawing, then TABLE / SEAT appears after about 2 seconds.
- If the guest has already checked in when the pass is opened, the seat appears directly. Duplicate scans do not allocate another seat or replay the animation.
- Reserved VIP table/seat values, including seat 10, are preserved.
- Reduced-motion preferences skip the animation and show the seat immediately.
- Each guest has a separate Durable Object room, with Hibernation WebSocket connections. Other guests' cards receive no update.
- Sockets are read-only. A browser frame cannot create attendance or choose a seat.
- Reconnect reads the latest committed state. On focus/visibility return, one reconciliation request covers missed updates. There is no periodic polling or heartbeat query.
- A delayed HTTP reconciliation cannot overwrite a newer WebSocket update.
- A manual seat edit also publishes the saved seat. It does not replay the arrival animation.

## Apply after the previous patches

Stop the Worker and Vite. In the existing project root:

```bash
unzip -o ~/Downloads/libya-live-pass-animation.zip -d .
node scripts/configure-live-pass.mjs
npm run test:attendance
npm run typecheck:worker
npm run build
```

The configuration command is REQUIRED: unzipping code alone is not enough.
The patch intentionally does not replace your wrangler.jsonc or vite.config.ts.
The script preserves existing D1 bindings, variables, other Durable Object bindings/migrations and allowedHosts (including your current tunnel host). It creates `.before-live-pass` copies of the original two configuration files.
For commented JSONC, it uses the project's existing TypeScript dependency; run npm ci first if needed.
If it reports a conflicting binding/migration or cannot identify the /api proxy, it stops before changing either file.

The configuration command adds:

- Durable Object binding: GUEST_PASS_ROOMS -> GuestPassRoom.
- Durable Object migration: tag guest-pass-live-v1, new_sqlite_classes GuestPassRoom.
- Vite /api proxy: ws: true.

This Durable Object migration is a Worker resource declaration, not a D1 .sql file. Wrangler dev initializes local resources from it; eventual deployment provisions the production namespace. Do not run D1 migrations again for this update.
The full source ZIP already includes the updated configuration; the configuration command is safe to run again.

## Manual test: use two tabs or devices on the SAME local/tunnel environment

1. In `.dev.vars`, add or update this line and keep all other settings:

```dotenv
ATTENDANCE_TEST_NOW="2026-11-14T16:00:00+02:00"
```

2. Restart the Worker and Vite in separate terminals:

```bash
npm run dev:worker
```

```bash
npm run dev
```

3. Use a confirmed local test guest who has NOT already checked in to the event. Open their invitation in the home page or `/pass?token=...` in the guest tab. Leave it open with the QR visible.
4. In the staff tab open `/admin`, log in, click Refresh and verify Event Check-in. Check in the SAME guest using invitation ID search or Scan QR.
5. Do not refresh the guest tab. It should show the infinity animation, then the table and seat.
6. Repeat with two guest tabs for the same invitation: both update. Open a different guest's invitation: it must remain unchanged.
7. Reload the already-checked-in invitation: seat is displayed directly without replaying the animation.
8. For workshop testing, use a fresh guest and time `2026-11-14T14:15:00+02:00`; Workshop Check-in must keep the QR. Then change the clock to 16:00, restart the Worker, refresh staff attendance and scan that guest for the Event. The guest card reconnects after the Worker restart.

The guest and staff must target the same Worker/database. A local staff check-in cannot update a production guest pass.
If using a tunnel, target Vite so it proxies both HTTP and WebSocket /api requests to localhost:8787. Keep your current allowedHosts setting.
Remove ATTENDANCE_TEST_NOW after local testing.

## Troubleshooting

- LIVE_PASS_NOT_CONFIGURED / 503: run the configuration script and restart Wrangler.
- Reconnecting invitation: verify the Vite /api proxy has ws: true, and the tunnel points at Vite.
- Browser Network -> WS should show `/api/pass/live?token=...` with a successful upgrade (101) and a `pass-state` message.
- A card already showing a seat will not replay the animation; use a guest who has not yet attended the Event.
- Workshop check-in intentionally does not reveal seating.
- Production still requires migration 0006, data preflight/backup, dependency checks and an intentional deployment. No remote migration or deployment was performed here.

## Verification and remaining limits

- 49/49 API, SQLite, room-protocol, state-parser and configuration tests pass.
- Tests cover token isolation, failed/duplicate arrivals, VIP seat 10, reconnection snapshots, guest-frame restrictions, manual seat updates and server-time enforcement.
- Additional checks ran the actual transpiled card and hook using lightweight hook/socket/timer test doubles: QR -> infinity -> seat, workshop state, reduced motion, reopening, disconnect/reconnect, cleanup and stale-response reconciliation.
- Updated TypeScript/TSX modules parse successfully.
- No browser executable, installed project TypeScript/Vite dependencies or workerd integration runtime is available in this preparation environment. Full typecheck/build and real browser/WebSocket/Durable Object integration still need the local checks above. The protocol tests emulate the 101 upgrade; they do not replace a real Wrangler/browser test.

References:
https://developers.cloudflare.com/durable-objects/best-practices/websockets/
https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
https://vite.dev/config/server-options

import { checkInAvailability, attendanceClock } from './attendance'

type WorkshopEnv = { DB: D1Database; ATTENDANCE_TEST_NOW?: string }
const json = (body: object, status = 200) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store' },
})

// The caller authenticates staff before requesting this summary.
export async function attendanceSummary(request: Request, env: WorkshopEnv) {
  const stats = await env.DB.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(workshop_rsvp = 'yes'), 0) AS yes_count,
      COALESCE(SUM(workshop_rsvp = 'no'), 0) AS no_count,
      COALESCE(SUM(workshop_rsvp IS NULL), 0) AS unanswered,
      COALESCE(SUM(workshop_checked_in = 1), 0) AS workshop_attended,
      COALESCE(SUM(checked_in = 1), 0) AS event_attended
    FROM guests
  `).first<{
    total: number; yes_count: number; no_count: number; unanswered: number;
    workshop_attended: number; event_attended: number
  }>()
  const clock = attendanceClock(request, env)
  return json({ success: true, ...checkInAvailability(clock.now),
    serverNow: new Date(clock.now).toISOString(), testMode: clock.testMode,
    stats: {
      total: Number(stats?.total ?? 0), yes: Number(stats?.yes_count ?? 0),
      no: Number(stats?.no_count ?? 0), unanswered: Number(stats?.unanswered ?? 0),
      workshopAttended: Number(stats?.workshop_attended ?? 0),
      eventAttended: Number(stats?.event_attended ?? 0),
    },
  })
}

export async function saveWorkshopRsvp(request: Request, env: WorkshopEnv) {
  let body: { qrToken?: unknown; answer?: unknown }
  try { body = await request.json<{ qrToken?: unknown; answer?: unknown }>() }
  catch { return json({ success: false, error: 'Invalid JSON body.' }, 400) }
  if (typeof body?.qrToken !== 'string' || !body.qrToken || body.qrToken.length > 200) {
    return json({ success: false, error: 'A valid invitation token is required.' }, 400)
  }
  if (body.answer !== 'yes' && body.answer !== 'no') {
    return json({ success: false, error: 'Please choose Yes or No.' }, 400)
  }
  const result = await env.DB.prepare(`
    UPDATE guests SET workshop_rsvp = ?, updated_at = CURRENT_TIMESTAMP
    WHERE qr_token = ? AND rsvp_status = 'confirmed'
    RETURNING workshop_rsvp
  `).bind(body.answer, body.qrToken).first<{ workshop_rsvp: string }>()
  if (!result) return json({ success: false, error: 'Confirmed invitation not found.' }, 404)
  return json({ success: true, workshopRsvp: result.workshop_rsvp })
}

// All boundaries are explicit Tripoli local times for the event day.
export const ATTENDANCE_SCHEDULE = {
  timezone: 'Africa/Tripoli',
  workshopOpensAt: '2026-11-14T14:00:00+02:00',
  workshopClosesAt: '2026-11-14T15:55:00+02:00',
  eventOpensAt: '2026-11-14T16:00:00+02:00',
} as const

export type AttendanceActivity = 'workshop' | 'event'

type AttendanceEnv = { DB: D1Database }
type AttendanceGuest = {
  id: number
  rsvp_status: string
  checked_in: number
  checked_in_at: string | null
  workshop_checked_in: number
  workshop_checked_in_at: string | null
  is_vip: number
  table_number: number | null
  seat_number: number | null
  current_table_type: string | null
}

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export function checkInAvailability(now = Date.now()) {
  return {
    ...ATTENDANCE_SCHEDULE,
    workshopOpen:
      now >= Date.parse(ATTENDANCE_SCHEDULE.workshopOpensAt) &&
      now < Date.parse(ATTENDANCE_SCHEDULE.workshopClosesAt),
    eventOpen: now >= Date.parse(ATTENDANCE_SCHEDULE.eventOpensAt),
  }
}

// Local development only. Never accept a test clock from the browser or on a public host.
export function attendanceClock(request: Request, env: { ATTENDANCE_TEST_NOW?: string }) {
  const host = new URL(request.url).hostname
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(host)
  const test = local && env.ATTENDANCE_TEST_NOW
    ? Date.parse(env.ATTENDANCE_TEST_NOW) : NaN
  return { now: Number.isFinite(test) ? test : Date.now(), testMode: Number.isFinite(test) }
}

async function loadGuest(env: AttendanceEnv, guestId: number) {
  return env.DB.prepare(`
    SELECT g.*, t.table_type AS current_table_type
    FROM guests g
    LEFT JOIN event_tables t ON t.table_number = g.table_number
    WHERE g.id = ?
  `).bind(guestId).first<AttendanceGuest>()
}

function alreadyCheckedIn(guest: AttendanceGuest, activity: AttendanceActivity) {
  const workshop = activity === 'workshop'
  if (!(workshop ? guest.workshop_checked_in : guest.checked_in)) return null
  return json({
    success: false,
    code: 'ALREADY_CHECKED_IN',
    activity,
    error: `Guest has already checked in to the ${activity}.`,
    checkedInAt: workshop ? guest.workshop_checked_in_at : guest.checked_in_at,
    // Workshop responses never expose seating.
    ...(!workshop ? {
      tableNumber: guest.table_number,
      seatNumber: guest.seat_number,
    } : {}),
  }, 409)
}

export async function checkInGuest(
  env: AttendanceEnv,
  guestId: number,
  activity: AttendanceActivity,
  now = Date.now()
): Promise<Response> {
  const guest = await loadGuest(env, guestId)
  if (!guest) return json({ success: false, code: 'GUEST_NOT_FOUND', error: 'Guest not found.' }, 404)
  if (guest.rsvp_status !== 'confirmed') {
    return json({ success: false, code: 'NOT_CONFIRMED', error: 'This guest has not confirmed registration.' }, 409)
  }

  // A retry reports the existing result without changing its timestamp or seat,
  // even if the original check-in window has since closed.
  const duplicate = alreadyCheckedIn(guest, activity)
  if (duplicate) return duplicate

  const availability = checkInAvailability(now)
  if (activity === 'event' && !availability.eventOpen) {
    return json({ success: false, code: 'EVENT_NOT_OPEN', error: 'Event check-in opens at 4:00 PM Tripoli time.', availability }, 409)
  }
  if (activity === 'workshop' && !availability.workshopOpen) {
    return json({
      success: false,
      code: now < Date.parse(availability.workshopOpensAt) ? 'WORKSHOP_NOT_OPEN' : 'WORKSHOP_CLOSED',
      error: 'Workshop check-in is available from 2:00 PM until 3:55 PM Tripoli time.',
      availability,
    }, 409)
  }

  const checkedInAt = new Date(now).toISOString()
  if (activity === 'workshop') {
    const result = await env.DB.prepare(`
      UPDATE guests
      SET workshop_checked_in = 1, workshop_checked_in_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND rsvp_status = 'confirmed' AND workshop_checked_in = 0
      RETURNING workshop_checked_in_at
    `).bind(checkedInAt, guestId).first<{ workshop_checked_in_at: string }>()
    if (result) return json({ success: true, activity, checkedInAt: result.workshop_checked_in_at })
  } else {
    // Seat selection and attendance are ONE SQL write. Never clear other guests'
    // reservations during a check-in. The unique seat index is the final guard.
    const result = await env.DB.prepare(`
      WITH RECURSIVE
      target AS (
        SELECT g.*, t.table_type AS current_table_type
        FROM guests g
        LEFT JOIN event_tables t ON t.table_number = g.table_number
        WHERE g.id = ? AND g.rsvp_status = 'confirmed' AND g.checked_in = 0
      ),
      seats(n) AS (
        SELECT 1
        UNION ALL
        SELECT n + 1 FROM seats
        WHERE n < (SELECT COALESCE(MAX(capacity), 0) FROM event_tables WHERE is_active = 1)
      ),
      candidates AS (
        SELECT t.table_number, s.n AS seat_number
        FROM target g
        CROSS JOIN event_tables t
        JOIN seats s ON s.n <= t.capacity
        WHERE t.is_active = 1
          AND (
            -- A reserved VIP seat must be preserved exactly, including 9/10.
            ((g.is_vip = 1 OR g.current_table_type = 'vip')
              AND (g.table_number IS NOT NULL OR g.seat_number IS NOT NULL)
              AND t.table_type = 'vip'
              AND t.table_number = g.table_number AND s.n = g.seat_number)
            OR
            (g.is_vip = 1 AND g.table_number IS NULL AND g.seat_number IS NULL
              AND t.table_type = 'vip')
            OR
            (g.is_vip = 0 AND COALESCE(g.current_table_type, 'regular') <> 'vip'
              AND t.table_type = 'regular')
          )
          AND NOT EXISTS (
            SELECT 1 FROM guests occupied
            WHERE occupied.table_number = t.table_number AND occupied.seat_number = s.n
              AND occupied.id <> g.id
          )
      ),
      chosen AS (
        SELECT table_number, seat_number FROM candidates
        ORDER BY table_number, seat_number LIMIT 1
      )
      UPDATE guests
      SET table_number = (SELECT table_number FROM chosen),
          seat_number = (SELECT seat_number FROM chosen),
          checked_in = 1, checked_in_at = ?, table_locked = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND rsvp_status = 'confirmed' AND checked_in = 0
        AND EXISTS (SELECT 1 FROM chosen)
      RETURNING table_number, seat_number, checked_in_at
    `).bind(guestId, checkedInAt, guestId).first<{
      table_number: number
      seat_number: number
      checked_in_at: string
    }>()
    if (result) return json({
      success: true, activity, checkedInAt: result.checked_in_at,
      tableNumber: result.table_number, seatNumber: result.seat_number,
    })
  }

  const latest = await loadGuest(env, guestId)
  if (!latest) return json({ success: false, code: 'GUEST_NOT_FOUND', error: 'Guest not found.' }, 404)
  const retry = alreadyCheckedIn(latest, activity)
  if (retry) return retry
  if (latest.rsvp_status !== 'confirmed') {
    return json({ success: false, code: 'NOT_CONFIRMED', error: 'This guest has not confirmed registration.' }, 409)
  }
  const reservedVip = (latest.is_vip || latest.current_table_type === 'vip') &&
    (latest.table_number !== null || latest.seat_number !== null)
  return json({
    success: false,
    code: reservedVip ? 'INVALID_VIP_RESERVATION' : 'NO_AVAILABLE_SEAT',
    error: reservedVip
      ? 'The reserved VIP seat is unavailable or invalid. Please review the reservation; it has not been changed.'
      : 'No eligible seat is currently available. Guest has not been checked in.',
  }, 409)
}

type LiveEnv = { DB: D1Database; GUEST_PASS_ROOMS?: DurableObjectNamespace }

export async function connectGuestPass(request: Request, env: LiveEnv) {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('WebSocket upgrade required.', { status: 426 })
  }
  const token = new URL(request.url).searchParams.get('token')
  if (!token || token.length > 200) {
    return Response.json({ success: false, error: 'Invitation token is required.' }, { status: 400 })
  }
  const guest = await env.DB.prepare(`
    SELECT id FROM guests WHERE qr_token = ? AND rsvp_status = 'confirmed' LIMIT 1
  `).bind(token).first<{ id: number }>()
  if (!guest) return new Response('Invalid invitation.', { status: 404 })
  if (!env.GUEST_PASS_ROOMS) return new Response('Live invitation binding is not configured.', { status: 503 })
  const room = env.GUEST_PASS_ROOMS.get(env.GUEST_PASS_ROOMS.idFromName(String(guest.id)))
  // Only this authenticated token lookup can choose the guest room. Do not
  // forward caller-supplied guest IDs, internal paths, cookies or seat values.
  return room.fetch(new Request('https://guest-pass.internal/subscribe', {
    headers: { Upgrade: 'websocket', 'X-Guest-Id': String(guest.id) },
  }))
}

export async function eventCheckInWithLivePass(env: LiveEnv, guestId: number, now: number) {
  if (!env.GUEST_PASS_ROOMS) {
    return Response.json({ success: false, code: 'LIVE_PASS_NOT_CONFIGURED',
      error: 'Live invitation updates are not configured. Restart the Worker with the updated Wrangler configuration.' }, { status: 503 })
  }
  const room = env.GUEST_PASS_ROOMS.get(env.GUEST_PASS_ROOMS.idFromName(String(guestId)))
  return room.fetch(new Request('https://guest-pass.internal/event-check-in', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Guest-Id': String(guestId) },
    body: JSON.stringify({ now }),
  }))
}

export async function publishGuestPass(env: LiveEnv, guestId: number) {
  if (!env.GUEST_PASS_ROOMS) return
  const room = env.GUEST_PASS_ROOMS.get(env.GUEST_PASS_ROOMS.idFromName(String(guestId)))
  const response = await room.fetch(new Request('https://guest-pass.internal/publish', {
    method: 'POST', headers: { 'X-Guest-Id': String(guestId) },
  }))
  if (!response.ok) throw new Error('Live pass update was not delivered.')
}

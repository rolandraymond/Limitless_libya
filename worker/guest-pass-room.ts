import { checkInGuest } from './attendance'

type RoomEnv = { DB: D1Database }
export type PassState = {
  checkedIn: boolean
  checkedInAt: string | null
  tableNumber: number | null
  seatNumber: number | null
}

export async function readPassState(env: RoomEnv, guestId: number): Promise<PassState | null> {
  const guest = await env.DB.prepare(`
    SELECT checked_in, checked_in_at, table_number, seat_number
    FROM guests WHERE id = ? AND rsvp_status = 'confirmed'
  `).bind(guestId).first<{
    checked_in: number; checked_in_at: string | null;
    table_number: number | null; seat_number: number | null
  }>()
  if (!guest) return null
  return {
    checkedIn: Boolean(guest.checked_in),
    checkedInAt: guest.checked_in_at,
    tableNumber: guest.checked_in ? guest.table_number : null,
    seatNumber: guest.checked_in ? guest.seat_number : null,
  }
}

// Classic Durable Object class; no runtime import is required. This also keeps
// the existing database/API tests runnable in Node without cloudflare:workers.
export class GuestPassRoom {
  private ctx: DurableObjectState
  private env: RoomEnv
  constructor(ctx: DurableObjectState, env: RoomEnv) {
    this.ctx = ctx
    this.env = env
  }

  fetch(request: Request): Promise<Response> {
    // Subscription snapshots, event writes and broadcasts are ordered per guest.
    return this.ctx.blockConcurrencyWhile(async () => {
      const guestId = Number(request.headers.get('X-Guest-Id'))
      if (!Number.isSafeInteger(guestId) || guestId <= 0) {
        return Response.json({ success: false, error: 'Invalid guest.' }, { status: 400 })
      }
      const path = new URL(request.url).pathname
      if (path === '/subscribe' && request.method === 'GET') {
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
          return new Response('WebSocket upgrade required.', { status: 426 })
        }
        const state = await readPassState(this.env, guestId)
        if (!state) return new Response('Invitation not found.', { status: 404 })
        const pair = new WebSocketPair()
        const [client, server] = Object.values(pair)
        this.ctx.acceptWebSocket(server, [String(guestId)])
        server.send(JSON.stringify({ type: 'pass-state', state }))
        return new Response(null, { status: 101, webSocket: client })
      }
      if (path === '/event-check-in' && request.method === 'POST') {
        const body = await request.json<{ now: number }>()
        if (!Number.isFinite(body.now)) {
          return Response.json({ success: false, error: 'Invalid server clock.' }, { status: 400 })
        }
        const response = await checkInGuest(this.env, guestId, 'event', body.now)
        // Read committed D1 state, including on an already-checked-in retry.
        // Never trust a client-supplied seat or attendance state.
        if (response.ok || response.status === 409) {
          const state = await readPassState(this.env, guestId)
          if (state?.checkedIn) this.broadcast(guestId, state)
        }
        return response
      }
      if (path === '/publish' && request.method === 'POST') {
        const state = await readPassState(this.env, guestId)
        if (!state) return new Response('Invitation not found.', { status: 404 })
        this.broadcast(guestId, state)
        return Response.json({ success: true })
      }
      return new Response('Not found.', { status: 404 })
    })
  }

  private broadcast(guestId: number, state: PassState) {
    const message = JSON.stringify({ type: 'pass-state', state })
    for (const socket of this.ctx.getWebSockets(String(guestId))) {
      try { socket.send(message) }
      catch { try { socket.close(1011, 'Please reconnect to update your pass.') } catch {} }
    }
  }

  // Guest sockets are read-only: frames cannot register attendance or seats.
  webSocketMessage(socket: WebSocket, _message: string | ArrayBuffer) {
    socket.close(1008, 'This invitation connection is read-only.')
  }
  webSocketClose(socket: WebSocket, code: number) {
    try { socket.close(code === 1005 || code === 1006 || code === 1015 ? 1000 : code) } catch {}
  }
  webSocketError(socket: WebSocket) {
    try { socket.close(1011, 'Connection interrupted.') } catch {}
  }
}

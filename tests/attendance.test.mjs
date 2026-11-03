import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync } from 'node:fs'
import { registerHooks } from 'node:module'

// Production uses bundler-style extensionless TypeScript imports.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context) }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && /^\.\.?\//.test(specifier) && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    throw error
  }
} })
const { checkInGuest, checkInAvailability } = await import('../worker/attendance.ts')
const { default: worker } = await import('../worker/index.ts')
const { autoAssignTables } = await import('../worker/tables.ts')
const workshopTime = Date.parse('2026-11-14T14:15:00+02:00')
const eventTime = Date.parse('2026-11-14T16:00:00+02:00')

function fixture(t, migrate = true) {
  const sqlite = new DatabaseSync(':memory:')
  t.after(() => sqlite.close())
  for (const name of readdirSync(new URL('../migrations/', import.meta.url)).sort()) {
    if (!name.endsWith('.sql') || (!migrate && name.startsWith('0006'))) continue
    sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'))
  }
  class Statement {
    constructor(sql) { this.sql = sql; this.args = [] }
    bind(...args) { this.args = args; return this }
    async first(column) {
      const row = sqlite.prepare(this.sql).get(...this.args) ?? null
      return column && row ? row[column] : row
    }
    async all() { return { success: true, results: sqlite.prepare(this.sql).all(...this.args) } }
    async run() {
      const r = sqlite.prepare(this.sql).run(...this.args)
      return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
    }
  }
  const env = {
    DB: {
      prepare: sql => new Statement(sql),
      async batch(statements) {
        sqlite.exec('BEGIN')
        try {
          const rows = []
          for (const s of statements) rows.push(await s.all())
          sqlite.exec('COMMIT')
          return rows
        } catch (error) { sqlite.exec('ROLLBACK'); throw error }
      },
    },
    ADMIN_USERNAME: 'test', ADMIN_PASSWORD: 'unused',
    PUBLIC_APP_URL: 'https://event.test', RESEND_API_KEY: 'test', EMAIL_FROM: 'test@example.test',
  }
  const guest = (id, options = {}) => {
    const row = {
      id, full_name: `Synthetic Guest ${id}`, first_name: 'Synthetic', last_name: 'Guest',
      rsvp_status: 'confirmed', is_vip: 0, phone: `+21891${String(id).padStart(7, '0')}`,
      qr_token: `synthetic-token-${id}`, invitation_code: `TEST-${id}`,
      table_number: null, seat_number: null, table_locked: 0, checked_in: 0, ...options,
    }
    const keys = Object.keys(row)
    sqlite.prepare(`INSERT INTO guests (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(row))
  }
  const row = id => sqlite.prepare('SELECT * FROM guests WHERE id = ?').get(id)
  const admin = () => sqlite.prepare('INSERT INTO admin_sessions(token, expires_at) VALUES (?, ?)').run('synthetic-session', 9999999999)
  return { sqlite, env, guest, row, admin }
}
async function payload(response, status) {
  assert.equal(response.status, status)
  return response.json()
}
function request(path, body, admin = false) {
  return new Request(`https://event.test${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(admin ? { Cookie: 'admin_session=synthetic-session' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

test('migration preserves invitation identity, checked-in seats and both kinds of VIP reservation', t => {
  const f = fixture(t, false)
  f.sqlite.exec("UPDATE event_tables SET table_type = 'vip' WHERE table_number = 1")
  f.guest(1, { table_number: 2, seat_number: 9, table_locked: 1 })
  f.guest(2, { table_number: 2, seat_number: 10, table_locked: 1, checked_in: 1, checked_in_at: 'old-event-time' })
  f.guest(3, { is_vip: 1, table_number: 1, seat_number: 9, table_locked: 1 })
  f.guest(4, { table_number: 1, seat_number: 10, table_locked: 1 })
  const identities = [1,2,3,4].map(id => [f.row(id).invitation_code, f.row(id).qr_token, f.row(id).phone])
  f.sqlite.exec(readFileSync(new URL('../migrations/0006_separate_workshop_attendance.sql', import.meta.url), 'utf8'))
  assert.deepEqual([f.row(1).table_number, f.row(1).seat_number, f.row(1).table_locked], [null, null, 0])
  assert.deepEqual([f.row(2).table_number, f.row(2).seat_number, f.row(2).checked_in_at], [2, 10, 'old-event-time'])
  assert.equal(f.row(3).seat_number, 9); assert.equal(f.row(4).seat_number, 10)
  assert.deepEqual([1,2,3,4].map(id => [f.row(id).invitation_code, f.row(id).qr_token, f.row(id).phone]), identities)
  for (const id of [1,2,3,4]) {
    assert.equal(f.row(id).workshop_rsvp, null)
    assert.equal(f.row(id).workshop_checked_in, 0)
  }
})

test('Tripoli time boundaries: workshop 14:00 <= now < 15:55, event from 16:00', () => {
  for (const [local, workshop, event] of [
    ['2026-11-13T16:00:00+02:00',false,false],
    ['2026-11-14T13:59:59+02:00',false,false],
    ['2026-11-14T14:00:00+02:00',true,false],
    ['2026-11-14T15:54:59+02:00',true,false],
    ['2026-11-14T15:55:00+02:00',false,false],
    ['2026-11-14T15:59:59+02:00',false,false],
    ['2026-11-14T16:00:00+02:00',false,true],
  ]) {
    const r = checkInAvailability(Date.parse(local))
    assert.equal(r.workshopOpen, workshop, local); assert.equal(r.eventOpen, event, local)
  }
})

test('server rejects early event / closed workshop with no attendance or seating writes', async t => {
  const f = fixture(t); f.guest(1)
  assert.equal((await payload(await checkInGuest(f.env,1,'event',workshopTime),409)).code,'EVENT_NOT_OPEN')
  assert.equal((await payload(await checkInGuest(f.env,1,'workshop',eventTime),409)).code,'WORKSHOP_CLOSED')
  assert.equal((await payload(await checkInGuest(f.env,1,'workshop',Date.parse('2026-11-14T13:59:00+02:00')),409)).code,'WORKSHOP_NOT_OPEN')
  assert.equal(f.row(1).checked_in,0); assert.equal(f.row(1).workshop_checked_in,0); assert.equal(f.row(1).table_number,null)
})

test('workshop and event require separate scans; workshop RSVP no does not invent attendance', async t => {
  const f = fixture(t); f.guest(1, {workshop_rsvp:'no'})
  const r = await payload(await checkInGuest(f.env,1,'workshop',workshopTime),200)
  assert.equal(r.activity,'workshop'); assert.equal('tableNumber' in r,false)
  assert.equal(f.row(1).checked_in,0); assert.equal(f.row(1).table_number,null)
  const e = await payload(await checkInGuest(f.env,1,'event',eventTime),200)
  assert.equal(e.activity,'event'); assert.equal(f.row(1).workshop_checked_in,1)
  assert.equal(f.row(1).checked_in,1); assert.equal(f.row(1).table_number,1)
})

test('event-only guest is accepted; seat 10 is used when first nine seats are full', async t => {
  const f=fixture(t)
  for(let i=1;i<=9;i++)f.guest(i,{checked_in:1,table_number:1,seat_number:i,table_locked:1})
  f.guest(10)
  const r=await payload(await checkInGuest(f.env,10,'event',eventTime),200)
  assert.equal(r.tableNumber,1); assert.equal(r.seatNumber,10); assert.equal(f.row(10).workshop_checked_in,0)
})

test('VIP seat 10 and unflagged reservation at a VIP table remain unchanged at both scans', async t => {
  const f=fixture(t); f.sqlite.exec("UPDATE event_tables SET table_type='vip' WHERE table_number=1")
  for(const [id,seat,vip] of [[1,10,1],[2,9,0]]) {
    f.guest(id,{is_vip:vip,table_number:1,seat_number:seat,table_locked:1})
    await payload(await checkInGuest(f.env,id,'workshop',workshopTime),200)
    const r=await payload(await checkInGuest(f.env,id,'event',eventTime),200)
    assert.equal(r.tableNumber,1); assert.equal(r.seatNumber,seat)
  }
})

test('invalid VIP reservation fails without silently moving the VIP', async t => {
  const f=fixture(t);f.sqlite.exec("UPDATE event_tables SET table_type='vip' WHERE table_number IN(1,2); UPDATE event_tables SET is_active=0 WHERE table_number=1")
  f.guest(1,{is_vip:1,table_number:1,seat_number:10,table_locked:1})
  const r=await payload(await checkInGuest(f.env,1,'event',eventTime),409)
  assert.equal(r.code,'INVALID_VIP_RESERVATION');assert.equal(f.row(1).seat_number,10);assert.equal(f.row(1).checked_in,0)
})

test('VIP without reservation uses a VIP table; regular cannot consume VIP seats',async t=>{
  const f=fixture(t);f.sqlite.exec("UPDATE event_tables SET table_type='vip' WHERE table_number=1")
  f.guest(1,{is_vip:1});f.guest(2)
  assert.equal((await payload(await checkInGuest(f.env,1,'event',eventTime),200)).tableNumber,1)
  assert.equal((await payload(await checkInGuest(f.env,2,'event',eventTime),200)).tableNumber,2)
})

test('full capacity returns actionable 409 and does not mark event attendance',async t=>{
  const f=fixture(t);f.sqlite.exec('UPDATE event_tables SET is_active=0');f.guest(1)
  assert.equal((await payload(await checkInGuest(f.env,1,'event',eventTime),409)).code,'NO_AVAILABLE_SEAT')
  assert.equal(f.row(1).checked_in,0);assert.equal(f.row(1).table_number,null)
})

test('repeat scans preserve original timestamps and seats, including after workshop closes',async t=>{
  const f=fixture(t);f.guest(1)
  await payload(await checkInGuest(f.env,1,'workshop',workshopTime),200)
  const w=await payload(await checkInGuest(f.env,1,'workshop',eventTime),409)
  assert.equal(w.code,'ALREADY_CHECKED_IN');assert.equal(w.checkedInAt,new Date(workshopTime).toISOString())
  const first=await payload(await checkInGuest(f.env,1,'event',eventTime),200)
  const again=await payload(await checkInGuest(f.env,1,'event',eventTime+10000),409)
  assert.equal(again.checkedInAt,first.checkedInAt);assert.equal(again.seatNumber,first.seatNumber)
})

test('simultaneous arrivals receive different seats and same-guest retries record attendance once',async t=>{
  const f=fixture(t);f.guest(1);f.guest(2);f.guest(3)
  const results=await Promise.all([checkInGuest(f.env,1,'event',eventTime),checkInGuest(f.env,2,'event',eventTime)])
  for(const r of results)assert.equal(r.status,200)
  assert.notEqual(f.row(1).seat_number,f.row(2).seat_number)
  const duplicates=await Promise.all([checkInGuest(f.env,3,'event',eventTime),checkInGuest(f.env,3,'event',eventTime)])
  assert.deepEqual(duplicates.map(r=>r.status).sort(),[200,409])
})

test('missing and pending registrations return 404 and 409, without attendance',async t=>{
  const f=fixture(t);f.guest(1,{rsvp_status:'pending'})
  assert.equal((await payload(await checkInGuest(f.env,999,'event',eventTime),404)).code,'GUEST_NOT_FOUND')
  assert.equal((await payload(await checkInGuest(f.env,1,'workshop',workshopTime),409)).code,'NOT_CONFIRMED')
})

test('guest-facing QR lookup hides reserved seats; staff lookup and checked-in guests see them',async t=>{
  const f=fixture(t);f.admin();f.guest(1,{is_vip:1,table_number:1,seat_number:10})
  let r=await payload(await worker.fetch(request('/api/check-in?token=synthetic-token-1'),f.env),200)
  assert.equal(r.guest.tableNumber,null);assert.equal(r.guest.seatNumber,null)
  r=await payload(await worker.fetch(request('/api/check-in?token=synthetic-token-1',undefined,true),f.env),200)
  assert.equal(r.guest.seatNumber,10)
  f.sqlite.exec('UPDATE guests SET checked_in=1 WHERE id=1')
  const response=await worker.fetch(request('/api/check-in?token=synthetic-token-1'),f.env)
  assert.equal(response.headers.get('Cache-Control'),'no-store')
  assert.equal((await response.json()).guest.seatNumber,10)
})

test('phone lookup preserves invitation and hides pre-event seats',async t=>{
  const f=fixture(t);f.guest(1,{is_vip:1,table_number:1,seat_number:10})
  const r=await payload(await worker.fetch(request('/api/invite/lookup',{phone:'0910000001'}),f.env),200)
  assert.equal(r.guest.qrToken,'synthetic-token-1');assert.equal(r.guest.seatNumber,null)
  assert.equal(r.guest.workshopRsvp,null)
})

test('registration creates an invitation without reserving a seat',async t=>{
  const f=fixture(t)
  t.mock.method(globalThis,'fetch',async()=>Response.json({id:'synthetic-email'}))
  const r=await payload(await worker.fetch(request('/api/rsvp',{
    phone:'0912345678',firstName:'Synthetic',lastName:'Guest',email:'guest@example.test',
    specialty:'Pharmacist',invitedBy:'Nada Jawad',
  }),f.env),201)
  assert.equal(r.guest.tableNumber,null);assert.equal(r.guest.seatNumber,null)
  assert.ok(r.guest.qrToken);assert.equal(f.row(r.guest.id).checked_in,0)
})

test('confirming an existing pending registration does not preallocate a seat',async t=>{
  const f=fixture(t);f.guest(1,{rsvp_status:'pending'})
  const r=await payload(await worker.fetch(request('/api/rsvp',{phone:'0910000001'}),f.env),200)
  assert.equal(r.guest.tableNumber,null);assert.equal(f.row(1).table_number,null)
  assert.equal(r.guest.qrToken,'synthetic-token-1')
})

test('bulk assignment is disabled and preserves existing assignments',async t=>{
  const f=fixture(t);f.guest(1,{is_vip:1,table_number:1,seat_number:10,table_locked:1})
  assert.equal((await autoAssignTables(f.env)).code,'AUTO_ASSIGN_DISABLED')
  assert.equal(f.row(1).seat_number,10)
})

test('manual seat endpoint rejects regular preallocation but accepts VIP seat 10',async t=>{
  const f=fixture(t);f.admin();f.guest(1);f.guest(2,{is_vip:1})
  f.sqlite.exec("UPDATE event_tables SET table_type='vip' WHERE table_number=1")
  let r=await payload(await worker.fetch(request('/api/admin/guest/seat',{guestId:1,tableNumber:2,seatNumber:1},true),f.env),409)
  assert.equal(r.code,'EVENT_CHECK_IN_REQUIRED')
  r=await payload(await worker.fetch(request('/api/admin/guest/seat',{guestId:2,tableNumber:1,seatNumber:10},true),f.env),200)
  assert.equal(r.guest.seatNumber,10)
})

test('attendance API validates activity and authentication; legacy request remains event-only',async t=>{
  const f=fixture(t);f.admin();f.guest(1)
  t.mock.method(Date,'now',()=>workshopTime)
  await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1}),f.env),401)
  assert.equal((await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'other'},true),f.env),400)).code,'INVALID_ACTIVITY')
  assert.equal((await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1},true),f.env),409)).code,'EVENT_NOT_OPEN')
  await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'workshop'},true),f.env),200)
  assert.equal(f.row(1).checked_in,0)
})

test('dashboard returns distinct attendance fields and server availability is authenticated',async t=>{
  const f=fixture(t);f.admin();f.guest(1,{workshop_rsvp:'yes',workshop_checked_in:1,workshop_checked_in_at:'synthetic-time'})
  const r=await payload(await worker.fetch(request('/api/admin/dashboard',undefined,true),f.env),200)
  assert.equal(r.guests[0].workshopCheckedIn,true);assert.equal(r.guests[0].checkedIn,false)
  await payload(await worker.fetch(request('/api/admin/check-in/availability'),f.env),401)
  const a=await payload(await worker.fetch(request('/api/admin/check-in/availability',undefined,true),f.env),200)
  assert.equal(a.timezone,'Africa/Tripoli')
})

test('an arrival never clears another guest reservation or workshop attendance',async t=>{
  const f=fixture(t);f.guest(1);f.guest(2,{table_number:2,seat_number:9,table_locked:1,workshop_checked_in:1,workshop_checked_in_at:'kept'})
  const before={...f.row(2)}
  await payload(await checkInGuest(f.env,1,'event',eventTime),200)
  assert.deepEqual({...f.row(2)},before)
})

test('manual assignment enforces actual capacity and VIP table type',async t=>{
  const f=fixture(t);f.admin();f.guest(1,{is_vip:1});f.guest(2,{checked_in:1})
  f.sqlite.exec("UPDATE event_tables SET table_type='vip' WHERE table_number=1")
  let r=await payload(await worker.fetch(request('/api/admin/guest/seat',{guestId:1,tableNumber:1,seatNumber:11},true),f.env),400)
  assert.equal(r.code,'SEAT_OUTSIDE_CAPACITY')
  r=await payload(await worker.fetch(request('/api/admin/guest/seat',{guestId:2,tableNumber:1,seatNumber:1},true),f.env),409)
  assert.equal(r.code,'TABLE_TYPE_MISMATCH')
})

test('workshop RSVP counters distinguish Yes, No, unanswered and actual attendance',async t=>{
  const f=fixture(t);f.admin();f.guest(1);f.guest(2);f.guest(3)
  await payload(await worker.fetch(request('/api/invite/workshop',{qrToken:'synthetic-token-1',answer:'yes'}),f.env),200)
  await payload(await worker.fetch(request('/api/invite/workshop',{qrToken:'synthetic-token-2',answer:'no'}),f.env),200)
  const r=await payload(await worker.fetch(request('/api/admin/attendance-summary',undefined,true),f.env),200)
  assert.deepEqual(r.stats,{total:3,yes:1,no:1,unanswered:1,workshopAttended:0,eventAttended:0})
  await payload(await checkInGuest(f.env,1,'workshop',workshopTime),200)
  const next=await payload(await worker.fetch(request('/api/admin/attendance-summary',undefined,true),f.env),200)
  assert.equal(next.stats.workshopAttended,1);assert.equal(next.stats.yes,1);assert.equal(next.stats.eventAttended,0)
})

test('RSVP edits change one guest response without creating another registration',async t=>{
  const f=fixture(t);f.admin();f.guest(1)
  for(const answer of ['yes','no','no'])await payload(await worker.fetch(request('/api/invite/workshop',{qrToken:'synthetic-token-1',answer}),f.env),200)
  const r=await payload(await worker.fetch(request('/api/admin/attendance-summary',undefined,true),f.env),200)
  assert.equal(r.stats.total,1);assert.equal(r.stats.yes,0);assert.equal(r.stats.no,1);assert.equal(r.stats.unanswered,0)
  assert.equal(f.row(1).qr_token,'synthetic-token-1');assert.equal(f.row(1).checked_in,0)
})

test('workshop RSVP requires an existing confirmed token and a valid Yes / No answer',async t=>{
  const f=fixture(t);f.guest(1,{rsvp_status:'pending'})
  for(const body of [{answer:'yes'},{qrToken:'synthetic-token-1',answer:'maybe'},null]) {
    await payload(await worker.fetch(request('/api/invite/workshop',body),f.env),400)
  }
  await payload(await worker.fetch(request('/api/invite/workshop',{qrToken:'unknown',answer:'yes'}),f.env),404)
  await payload(await worker.fetch(request('/api/invite/workshop',{qrToken:'synthetic-token-1',answer:'yes'}),f.env),404)
  assert.equal(f.row(1).workshop_rsvp,null)
})

test('new registration persists workshop choice in the same guest record',async t=>{
  const f=fixture(t)
  t.mock.method(globalThis,'fetch',async()=>Response.json({id:'synthetic-email'}))
  const r=await payload(await worker.fetch(request('/api/rsvp',{
    phone:'0912345678',firstName:'Synthetic',lastName:'Guest',email:'guest@example.test',
    specialty:'Pharmacist',invitedBy:'Nada Jawad',workshopRsvp:'yes',
  }),f.env),201)
  assert.equal(r.guest.workshopRsvp,'yes');assert.equal(f.row(r.guest.id).workshop_rsvp,'yes')
  assert.equal(f.row(r.guest.id).workshop_checked_in,0);assert.equal(f.row(r.guest.id).table_number,null)
})

test('confirming an imported pending guest saves selected RSVP without changing the QR',async t=>{
  const f=fixture(t);f.guest(1,{rsvp_status:'pending'})
  const r=await payload(await worker.fetch(request('/api/rsvp',{phone:'0910000001',workshopRsvp:'no'}),f.env),200)
  assert.equal(r.guest.workshopRsvp,'no');assert.equal(f.row(1).workshop_rsvp,'no');assert.equal(f.row(1).qr_token,'synthetic-token-1')
})

test('local test clock is shared by availability and check-in, and ignored on public hosts',async t=>{
  const f=fixture(t);f.admin();f.guest(1)
  f.env.ATTENDANCE_TEST_NOW='2026-11-14T14:15:00+02:00'
  t.mock.method(Date,'now',()=>Date.parse('2026-11-02T12:00:00Z'))
  const local=(path,body)=>new Request(`http://localhost:8787${path}`,{
    method:body?'POST':'GET',headers:{Cookie:'admin_session=synthetic-session','Content-Type':'application/json'},
    ...(body?{body:JSON.stringify(body)}:{}),
  })
  const r=await payload(await worker.fetch(local('/api/admin/attendance-summary'),f.env),200)
  assert.equal(r.testMode,true);assert.equal(r.workshopOpen,true);assert.equal(r.eventOpen,false)
  await payload(await worker.fetch(local('/api/admin/check-in',{guestId:1,activity:'workshop'}),f.env),200)
  const publicResult=await payload(await worker.fetch(request('/api/admin/attendance-summary',undefined,true),f.env),200)
  assert.equal(publicResult.testMode,false);assert.equal(publicResult.workshopOpen,false)
  assert.equal(f.row(1).checked_in,0)
})

test('attendance summary requires a staff session and invalid test clocks fall back to real time',async t=>{
  const f=fixture(t);f.env.ATTENDANCE_TEST_NOW='invalid';f.admin()
  await payload(await worker.fetch(request('/api/admin/attendance-summary'),f.env),401)
  const r=await payload(await worker.fetch(new Request('http://localhost:8787/api/admin/attendance-summary',{headers:{Cookie:'admin_session=synthetic-session'}}),f.env),200)
  assert.equal(r.testMode,false);assert.ok(Number.isFinite(Date.parse(r.serverNow)))
})

const { GuestPassRoom, readPassState } = await import('../worker/guest-pass-room.ts')
const { parsePassState, mergePassState } = await import('../src/pass-state.ts')
function liveRooms(f) {
  const rooms = new Map()
  f.env.GUEST_PASS_ROOMS = {
    idFromName: name => String(name),
    get(id) {
      id = String(id)
      if (!rooms.has(id)) {
        const sockets = []
        let queue = Promise.resolve()
        const ctx = {
          blockConcurrencyWhile(fn) { const result = queue.then(fn); queue = result.catch(() => {}); return result },
          acceptWebSocket(ws, tags) { sockets.push({ ws, tags }) },
          getWebSockets(tag) { return sockets.filter(s => !tag || s.tags.includes(tag)).map(s => s.ws) },
        }
        const room = { ctx, sockets, instance: new GuestPassRoom(ctx, f.env) }
        rooms.set(id, room)
      }
      return { fetch: req => rooms.get(id).instance.fetch(req) }
    },
  }
  const socket = id => {
    f.env.GUEST_PASS_ROOMS.get(String(id))
    const ws = { messages: [], closes: [], send(message) { this.messages.push(JSON.parse(message)) }, close(...args) { this.closes.push(args) } }
    rooms.get(String(id)).ctx.acceptWebSocket(ws, [String(id)])
    return ws
  }
  return { rooms, socket }
}
function mockWebSocketUpgrade(t) {
  const originalPair = globalThis.WebSocketPair
  const NativeResponse = globalThis.Response
  globalThis.WebSocketPair = class {
    constructor() {
      this[0] = { side: 'client' }
      this[1] = { messages: [], send(message) { this.messages.push(JSON.parse(message)) }, close() {} }
    }
  }
  globalThis.Response = class extends NativeResponse {
    constructor(body, init) {
      if (init?.status === 101) {
        super(null, { status: 200 })
        Object.defineProperty(this, 'status', { value: 101 })
        this.webSocket = init.webSocket
      } else super(body, init)
    }
  }
  t.after(() => { globalThis.Response = NativeResponse; if (originalPair) globalThis.WebSocketPair = originalPair; else delete globalThis.WebSocketPair })
}
function liveRequest(token, extraHeaders = {}) {
  return new Request(`https://event.test/api/pass/live${token === null ? '' : '?token=' + encodeURIComponent(token)}`, {
    headers: { Upgrade: 'websocket', ...extraHeaders },
  })
}

test('live guest snapshot strips reserved seats until event check-in', async t => {
  const f=fixture(t);f.guest(1,{is_vip:1,table_number:1,seat_number:10})
  assert.deepEqual(await readPassState(f.env,1),{checkedIn:false,checkedInAt:null,tableNumber:null,seatNumber:null})
  f.sqlite.exec("UPDATE guests SET checked_in=1, checked_in_at='saved-time' WHERE id=1")
  assert.deepEqual(await readPassState(f.env,1),{checkedIn:true,checkedInAt:'saved-time',tableNumber:1,seatNumber:10})
})

test('live endpoint validates upgrade and token without disclosing another guest', async t => {
  const f=fixture(t);f.guest(1);liveRooms(f)
  assert.equal((await worker.fetch(request('/api/pass/live?token=synthetic-token-1'),f.env)).status,426)
})

test('invalid live tokens fail before opening a guest room', async t => {
  const f=fixture(t);f.guest(1);const {rooms}=liveRooms(f)
  assert.equal((await worker.fetch(liveRequest(null),f.env)).status,400)
  assert.equal((await worker.fetch(liveRequest('unknown'),f.env)).status,404)
  f.sqlite.exec("UPDATE guests SET rsvp_status='pending' WHERE id=1")
  assert.equal((await worker.fetch(liveRequest('synthetic-token-1'),f.env)).status,404)
  assert.equal(rooms.size,0)
})

test('subscription uses only the token owner and sends a current initial snapshot', async t => {
  mockWebSocketUpgrade(t)
  const f=fixture(t);f.guest(1);f.guest(2);const {rooms}=liveRooms(f)
  const r=await worker.fetch(liveRequest('synthetic-token-1',{'X-Guest-Id':'2'}),f.env)
  assert.equal(r.status,101);assert.equal(rooms.has('1'),true);assert.equal(rooms.has('2'),false)
  const ws=rooms.get('1').sockets[0].ws
  assert.deepEqual(ws.messages,[{type:'pass-state',state:{checkedIn:false,checkedInAt:null,tableNumber:null,seatNumber:null}}])
})

test('event success broadcasts the committed seat only to that guest sockets', async t => {
  const f=fixture(t);f.admin();f.guest(1);f.guest(2);const live=liveRooms(f)
  const first=live.socket(1),second=live.socket(1),other=live.socket(2)
  t.mock.method(Date,'now',()=>eventTime)
  const r=await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),200)
  assert.equal(first.messages.length,1);assert.deepEqual(first.messages,second.messages);assert.equal(other.messages.length,0)
  assert.equal(first.messages[0].state.checkedIn,true)
  assert.equal(first.messages[0].state.tableNumber,f.row(1).table_number)
  assert.equal(first.messages[0].state.seatNumber,r.seatNumber)
})

test('workshop check-in keeps QR state and does not broadcast event seating', async t => {
  const f=fixture(t);f.admin();f.guest(1);const ws=liveRooms(f).socket(1)
  t.mock.method(Date,'now',()=>workshopTime)
  await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'workshop'},true),f.env),200)
  assert.equal(ws.messages.length,0);assert.equal((await readPassState(f.env,1)).checkedIn,false)
})

test('full event capacity and early event check-in do not send a successful seat', async t => {
  const f=fixture(t);f.admin();f.guest(1);const ws=liveRooms(f).socket(1)
  t.mock.method(Date,'now',()=>eventTime)
  f.sqlite.exec('UPDATE event_tables SET is_active=0')
  assert.equal((await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),409)).code,'NO_AVAILABLE_SEAT')
  assert.equal(ws.messages.length,0);assert.equal(f.row(1).checked_in,0)
})

test('repeat event scan replays the authoritative seat without allocating again', async t => {
  const f=fixture(t);f.admin();f.guest(1);const ws=liveRooms(f).socket(1)
  t.mock.method(Date,'now',()=>eventTime)
  await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),200)
  assert.equal((await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),409)).code,'ALREADY_CHECKED_IN')
  assert.equal(ws.messages.length,2);assert.deepEqual(ws.messages[0],ws.messages[1]);assert.equal(f.row(1).seat_number,1)
})

test('reconstructed room can broadcast to hibernated sockets', async t => {
  const f=fixture(t);f.admin();f.guest(1);const live=liveRooms(f);const ws=live.socket(1)
  const room=live.rooms.get('1');room.instance=new GuestPassRoom(room.ctx,f.env)
  t.mock.method(Date,'now',()=>eventTime)
  await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),200)
  assert.equal(ws.messages[0].state.checkedIn,true)
})

test('guest WebSocket frames cannot change attendance', async t => {
  const f=fixture(t);f.guest(1);const live=liveRooms(f);const ws=live.socket(1)
  live.rooms.get('1').instance.webSocketMessage(ws,'{"checkedIn":true,"seatNumber":10}')
  assert.equal(ws.closes[0][0],1008);assert.equal(f.row(1).checked_in,0);assert.equal(f.row(1).table_number,null)
})

test('manual event seat edit publishes the new seat after saving it', async t => {
  const f=fixture(t);f.admin();f.guest(1,{checked_in:1,table_number:1,seat_number:1,table_locked:1})
  const ws=liveRooms(f).socket(1)
  await payload(await worker.fetch(request('/api/admin/guest/seat',{guestId:1,tableNumber:1,seatNumber:10},true),f.env),200)
  assert.equal(ws.messages[0].state.seatNumber,10);assert.equal(f.row(1).seat_number,10)
})

test('missing live binding blocks event write clearly instead of promising a live update', async t => {
  const f=fixture(t);f.admin();f.guest(1);t.mock.method(Date,'now',()=>eventTime)
  assert.equal((await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),503)).code,'LIVE_PASS_NOT_CONFIGURED')
  assert.equal(f.row(1).checked_in,0)
})

test('guest card parser rejects incomplete seats and strips pre-event reservations', () => {
  assert.deepEqual(parsePassState({checkedIn:false,tableNumber:1,seatNumber:10}),{checkedIn:false,checkedInAt:null,tableNumber:null,seatNumber:null})
  for(const state of [{checkedIn:true,tableNumber:null,seatNumber:2},{checkedIn:true,tableNumber:1,seatNumber:0},{checkedIn:'true',tableNumber:1,seatNumber:2}])assert.equal(parsePassState(state),null)
  assert.equal(parsePassState({checkedIn:true,tableNumber:1,seatNumber:10}).seatNumber,10)
})

test('old snapshots cannot restore QR after confirmed event entry; manual seat edits can update it', () => {
  const current=parsePassState({checkedIn:true,tableNumber:1,seatNumber:9})
  assert.equal(mergePassState(current,parsePassState({checkedIn:false})),current)
  assert.equal(mergePassState(current,parsePassState({checkedIn:true,tableNumber:1,seatNumber:10})).seatNumber,10)
})

const { configureLivePass } = await import('../scripts/configure-live-pass.mjs')
const { mkdtemp, writeFile, readFile, rm } = await import('node:fs/promises')
const { tmpdir } = await import('node:os')
const path = await import('node:path')
async function configFixture(t, config = {}) {
  const root=await mkdtemp(path.join(tmpdir(),'libya-live-config-'))
  t.after(()=>rm(root,{recursive:true,force:true}))
  await writeFile(path.join(root,'wrangler.jsonc'),JSON.stringify({name:'synthetic-event',vars:{KEEP:'kept'},d1_databases:[{binding:'DB',database_name:'synthetic-db'}],...config}))
  await writeFile(path.join(root,'vite.config.ts'),"export default { server: { allowedHosts: ['synthetic.trycloudflare.com'], proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } } } }")
  return root
}

test('configuration installer preserves tunnel hosts, D1 and other bindings and is idempotent',async t=>{
  const root=await configFixture(t,{durable_objects:{bindings:[{name:'KEEP_OBJECT',class_name:'KeepObject'}]},migrations:[{tag:'older',new_sqlite_classes:['KeepObject']}]})
  await configureLivePass(root)
  const first=await readFile(path.join(root,'wrangler.jsonc'),'utf8')
  const config=JSON.parse(first)
  assert.equal(config.vars.KEEP,'kept');assert.equal(config.d1_databases[0].database_name,'synthetic-db')
  assert.equal(config.durable_objects.bindings.length,2);assert.equal(config.migrations.length,2)
  const vite=await readFile(path.join(root,'vite.config.ts'),'utf8')
  assert.match(vite,/synthetic\.trycloudflare\.com/);assert.match(vite,/ws: true/)
  await configureLivePass(root)
  assert.equal(await readFile(path.join(root,'wrangler.jsonc'),'utf8'),first)
  assert.equal(await readFile(path.join(root,'vite.config.ts'),'utf8'),vite)
})

test('configuration conflicts are rejected before either file is written',async t=>{
  const root=await configFixture(t,{durable_objects:{bindings:[{name:'GUEST_PASS_ROOMS',class_name:'OtherClass'}]}})
  const before=await readFile(path.join(root,'vite.config.ts'),'utf8')
  await assert.rejects(configureLivePass(root),/another class/)
  assert.equal(await readFile(path.join(root,'vite.config.ts'),'utf8'),before)
})

test('subscription and event arrival are ordered: connected card ends with confirmed seating',async t=>{
  mockWebSocketUpgrade(t)
  const f=fixture(t);f.admin();f.guest(1);const live=liveRooms(f)
  t.mock.method(Date,'now',()=>eventTime)
  const [subscription,event]=await Promise.all([
    worker.fetch(liveRequest('synthetic-token-1'),f.env),
    worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),
  ])
  assert.equal(subscription.status,101);assert.equal(event.status,200)
  const messages=live.rooms.get('1').sockets[0].ws.messages
  assert.equal(messages.at(-1).state.checkedIn,true)
  assert.equal(messages.at(-1).state.seatNumber,f.row(1).seat_number)
})

test('reopening a checked-in invitation gets its saved seat immediately',async t=>{
  mockWebSocketUpgrade(t)
  const f=fixture(t);f.guest(1,{checked_in:1,checked_in_at:'saved-time',table_number:4,seat_number:10,table_locked:1})
  const live=liveRooms(f)
  const r=await worker.fetch(liveRequest('synthetic-token-1'),f.env)
  assert.equal(r.status,101)
  const state=live.rooms.get('1').sockets[0].ws.messages[0].state
  assert.deepEqual(state,{checkedIn:true,checkedInAt:'saved-time',tableNumber:4,seatNumber:10})
})

test('VIP live check-in reveals the original seat 10 only after arrival',async t=>{
  const f=fixture(t);f.admin();f.sqlite.exec("UPDATE event_tables SET table_type='vip' WHERE table_number=1")
  f.guest(1,{is_vip:1,table_number:1,seat_number:10,table_locked:1})
  const ws=liveRooms(f).socket(1)
  assert.equal((await readPassState(f.env,1)).seatNumber,null)
  t.mock.method(Date,'now',()=>eventTime)
  await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event'},true),f.env),200)
  assert.equal(ws.messages[0].state.seatNumber,10);assert.equal(ws.messages[0].state.tableNumber,1)
})

test('live event route still enforces server time and ignores a caller-supplied clock',async t=>{
  const f=fixture(t);f.admin();f.guest(1);const ws=liveRooms(f).socket(1)
  t.mock.method(Date,'now',()=>workshopTime)
  const r=await payload(await worker.fetch(request('/api/admin/check-in',{guestId:1,activity:'event',now:eventTime},true),f.env),409)
  assert.equal(r.code,'EVENT_NOT_OPEN');assert.equal(f.row(1).checked_in,0);assert.equal(ws.messages.length,0)
})

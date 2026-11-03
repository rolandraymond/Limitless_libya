import './dashboard-attendance.css'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Snapshot = {
  serverNow: string; testMode: boolean
  workshopOpensAt: string; workshopClosesAt: string; eventOpensAt: string
  stats: { total: number; yes: number; no: number; unanswered: number; workshopAttended: number; eventAttended: number }
}
type Mode = 'loading' | 'before' | 'workshop' | 'paused' | 'event'
function useAttendanceState() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [tick, setTick] = useState(0)
  const anchor = useRef(0)
  const sequence = useRef(0)
  const previous = useRef<Mode | null>(null)
  const refresh = useCallback(async () => {
    const id = ++sequence.current
    try {
      const r = await fetch('/api/admin/attendance-summary', { credentials: 'include', cache: 'no-store' })
      const data = await r.json()
      if (id !== sequence.current) return
      if (!r.ok) throw new Error(data.error || 'Unable to load attendance mode.')
      anchor.current = performance.now()
      setSnapshot(data)
      setError('')
      setTick(value => value + 1)
    } catch (err) {
      if (id !== sequence.current) return
      setError(err instanceof Error ? err.message : 'Unable to load attendance mode.')
    }
  }, [])
  useEffect(() => {
    void refresh()
    const focus = () => { if (!document.hidden) void refresh() }
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', focus)
    const timer = window.setInterval(() => setTick(value => value + 1), 1000)
    return () => {
      sequence.current++
      clearInterval(timer)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', focus)
    }
  }, [refresh])
  const now = snapshot
    ? Date.parse(snapshot.serverNow) + (snapshot.testMode ? 0 : Math.max(0, performance.now() - anchor.current))
    : 0
  void tick // Recalculate from the server-calibrated clock; the timer never fetches.
  const mode: Mode = !snapshot || error ? 'loading'
    : now >= Date.parse(snapshot.eventOpensAt) ? 'event'
    : now >= Date.parse(snapshot.workshopClosesAt) ? 'paused'
    : now >= Date.parse(snapshot.workshopOpensAt) ? 'workshop' : 'before'
  useEffect(() => {
    if (mode === 'loading') return
    if (previous.current && previous.current !== mode) {
      setNotice(mode === 'event'
        ? 'Event check-in is now open. Workshop check-in is closed.'
        : mode === 'paused'
          ? 'Workshop check-in is now closed. Event check-in opens at 4:00 PM.'
          : mode === 'workshop' ? 'Workshop check-in is now open.' : '')
      void refresh()
    }
    previous.current = mode
  }, [mode, refresh])
  const activity = mode === 'workshop' ? 'workshop' : mode === 'event' ? 'event' : null
  const label = mode === 'workshop' ? 'Workshop Check-in' : mode === 'event' ? 'Event Check-in'
    : mode === 'paused' ? 'Check-in Paused' : mode === 'before' ? 'Check-in Not Open' : 'Checking availability'
  return { mode, activity, label, snapshot, error, notice, refresh }
}
const Context = createContext<ReturnType<typeof useAttendanceState> | null>(null)
export function AttendanceProvider({ children }: { children: ReactNode }) {
  const value = useAttendanceState()
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useAttendance() {
  const context = useContext(Context)
  if (!context) throw new Error('AttendanceProvider is required.')
  return context
}
export function AttendanceBadge() {
  const { mode, label } = useAttendance()
  return <span className={`attendance-badge attendance-badge--${mode}`}>
    <span className="attendance-badge__dot" aria-hidden="true" />{label}
  </span>
}
export function AttendanceOverview() {
  const a = useAttendance()
  const s = a.snapshot?.stats
  const status = a.notice || (a.mode === 'paused'
    ? 'Workshop check-in is closed. Event check-in opens at 4:00 PM.'
    : a.mode === 'event' ? 'Event check-in is open. Workshop check-in is closed.' : '')
  return <section className="workshop-summary" aria-label="Workshop responses and attendance">
    <div className="workshop-summary__heading">
      <div>
        <h2 className="workshop-summary__title">AI Video Creation</h2>
        <p className="workshop-summary__subtitle">Workshop · 14 November · 2:00-4:00 PM</p>
      </div>
      <button type="button" className="workshop-summary__refresh" onClick={() => void a.refresh()}>
        Refresh
      </button>
    </div>
    <div className="workshop-summary__metrics">
      {[['Yes', s?.yes], ['No', s?.no], ['Not answered', s?.unanswered], ['Checked in', s?.workshopAttended]].map(([label, value]) =>
        <div key={String(label)} className="workshop-summary__metric">
          <span>{label}</span><strong>{value ?? '—'}</strong>
        </div>)}
    </div>
    {a.snapshot?.testMode && <p className="workshop-summary__test">Local test clock · {new Date(a.snapshot.serverNow).toLocaleString('en-GB', { timeZone: 'Africa/Tripoli', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</p>}
    {status && <p role="status" aria-live="polite" className="workshop-summary__notice">{status}</p>}
    {a.error && <p role="alert" className="workshop-summary__error">{a.error} Press Refresh to retry.</p>}
  </section>
}

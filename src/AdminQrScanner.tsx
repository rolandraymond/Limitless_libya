import { AttendanceBadge, useAttendance } from './AttendanceControls'
import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'

type ScanGuest = {
  id: number
  fullName: string
  invitationCode: string | null
  rsvpStatus: string
  tableNumber: number | null
  seatNumber: number | null
  checkedIn: boolean
  checkedInAt: string | null
  workshopCheckedIn: boolean
  workshopCheckedInAt: string | null
}

type Props = {
  onClose: () => void
  onCompleted: () => Promise<void>
}

export default function AdminQrScanner({
  onClose,
  onCompleted,
}: Props) {
  const attendance = useAttendance()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [guest, setGuest] = useState<ScanGuest | null>(null)
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [round, setRound] = useState(0)
  const [completed, setCompleted] = useState(false)
  const already = attendance.activity === 'workshop' ? guest?.workshopCheckedIn : guest?.checkedIn

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let disposed = false
    let claimed = false
    let stopCamera: (() => void) | undefined
    const abort = new AbortController()
    const reader = new BrowserQRCodeReader()

    const loadGuest = async (qrToken: string) => {
      setBusy(true)

      try {
        const response = await fetch(
          `/api/check-in?token=${encodeURIComponent(qrToken)}`,
          {
            credentials: 'include',
            signal: abort.signal,
          }
        )
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Invalid event QR.')
        }

        if (!disposed) {
          setToken(qrToken)
          setGuest(data.guest)
        }
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof Error ? err.message : 'Unable to read guest.'
          )
        }
      } finally {
        if (!disposed) setBusy(false)
      }
    }

    reader.decodeFromConstraints(
      {
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      },
      video,
      (result, _error, controls) => {
        if (disposed) {
          controls.stop()
          return
        }

        if (!result || claimed) return

        try {
          const url = new URL(
            result.getText(),
            window.location.origin
          )
          const qrToken = url.searchParams.get('token')

          if (
            !['/check-in', '/pass'].includes(url.pathname) ||
            !qrToken ||
            qrToken.length > 200
          ) {
            throw new Error('Please scan an event invitation QR.')
          }

          claimed = true
          controls.stop()
          setError('')
          void loadGuest(qrToken)
        } catch (err) {
          setError(
            err instanceof Error ? err.message : 'Invalid QR.'
          )
        }
      }
    ).then((controls) => {
      if (disposed || claimed) controls.stop()
      else stopCamera = () => controls.stop()
    }).catch(() => {
      if (!disposed) {
        setError(
          'Unable to open camera. Allow camera access and use HTTPS or localhost.'
        )
      }
    })

    return () => {
      disposed = true
      abort.abort()
      stopCamera?.()
    }
  }, [round])

  const confirmCheckIn = async () => {
    const activity = attendance.activity
    if (!guest || !activity || already || busy) return
    if (!window.confirm(activity === 'workshop'
      ? `Check in ${guest.fullName} to the AI Video Creation workshop? No seat will be assigned.`
      : `Check in ${guest.fullName} to the event?`)) return

    setBusy(true)
    setError('')

    try {
      const response = await fetch('/api/admin/check-in', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, activity }),
      })
      const data = await response.json()
      await attendance.refresh()

      if (response.status === 401) {
        throw new Error('Admin session expired. Please log in again.')
      }

      if (!response.ok && data.code !== 'ALREADY_CHECKED_IN') {
        throw new Error(data.error || 'Unable to check in guest.')
      }

      // Read the final seat after the backend assigns it.
      const refreshed = await fetch(
        `/api/check-in?token=${encodeURIComponent(token)}`,
        { credentials: 'include', cache: 'no-store' }
      )
      const latest = await refreshed.json()

      if (!refreshed.ok) {
        throw new Error(
          'Check-in was processed. Re-scan to verify the final seat.'
        )
      }

      setGuest(latest.guest)
      setCompleted(response.ok)
      await onCompleted()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to check in guest.'
      )
    } finally {
      setBusy(false)
    }
  }

  const scanNext = () => {
    setGuest(null)
    setToken('')
    setError('')
    setCompleted(false)
    setRound((value) => value + 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <section className="w-full max-w-md max-h-[85dvh] overflow-y-auto rounded-3xl border border-[#35435d] bg-[#192039] p-6 text-[#f4f7fa] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Scan invitation QR</h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-[#52617a] bg-[#11182b] px-3 py-2 text-[#f4f7fa] hover:bg-[#25314a] disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <div className="mb-4"><AttendanceBadge /></div>
        {!attendance.activity && <p className="mb-3 text-sm">Check-in is currently closed. Please wait for the next session.</p>}
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          className={`w-full rounded-2xl bg-black ${
            guest ? 'hidden' : ''
          }`}
        />

        {busy && <p className="mt-4">Processing...</p>}

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}

        {guest && (
          <div className="mt-4 space-y-3">
            <h3 className="text-2xl font-semibold">{guest.fullName}</h3>
            <p>{guest.invitationCode}</p>

            <p className="font-semibold">
              {already
                ? completed
                  ? 'CHECK-IN SUCCESSFUL'
                  : 'ALREADY CHECKED IN'
                : attendance.activity ? `READY FOR ${attendance.activity.toUpperCase()} CHECK-IN` : 'CHECK-IN CLOSED'}
            </p>

            {attendance.activity === 'event' && guest.checkedIn && (
              <p>Final seat: Table {guest.tableNumber ?? '—'} / Seat {guest.seatNumber ?? '—'}</p>
            )}
            {attendance.activity === 'workshop' && <p>Workshop attendance only. No table or seat will be assigned.</p>}
            {!already && guest.rsvpStatus === 'confirmed' && (
              <button type="button" disabled={busy || !attendance.activity}
                onClick={() => void confirmCheckIn()}
                className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
                {busy ? 'PROCESSING...' : `CONFIRM ${attendance.activity?.toUpperCase() ?? ''} CHECK-IN`}
              </button>
            )}

            {guest.rsvpStatus !== 'confirmed' && (
              <p className="text-red-600">Registration is not confirmed.</p>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={scanNext}
          className="mt-4 w-full rounded-xl border border-[#52617a] bg-[#11182b] px-4 py-3 text-[#f4f7fa] hover:bg-[#25314a] disabled:opacity-50"
        >
          Scan next guest
        </button>
      </section>
    </div>
  )
}
import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

type PassGuest = {
  fullName: string
  invitationCode: string | null
  rsvpStatus: string
  isVip: boolean
}

export default function PassPage() {
  const [guest, setGuest] = useState<PassGuest | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const qrToken = params.get('token')

    if (!qrToken) {
      setError('Invalid event pass.')
      setLoading(false)
      return
    }

    setToken(qrToken)

    const controller = new AbortController()

    const loadPass = async () => {
      try {
        const response = await fetch(
          `/api/check-in?token=${encodeURIComponent(qrToken)}`,
          { signal: controller.signal }
        )

        const data = await response.json()

        if (!response.ok || !data.guest) {
          setError(data.error || 'Invalid event pass.')
          return
        }

        setGuest(data.guest)
      } catch (error) {
        if (controller.signal.aborted) return

        console.error(error)
        setError('Unable to load your event pass.')
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadPass()

    return () => controller.abort()
  }, [])

  const pageClass =
"relative isolate flex min-h-svh items-center justify-center bg-[#101225] bg-[url('/assets/libya-hero.png')] bg-cover bg-center bg-fixed px-4 py-10 font-['Montserrat',sans-serif] text-[#f4f7fa] before:pointer-events-none before:absolute before:inset-0 before:-z-10 before:bg-[#101225]/55 before:content-['']"
  if (loading) {
    return (
      <main className={pageClass} aria-busy="true">
        <div role="status" className="text-center">
          <LoaderCircle
            className="mx-auto animate-spin text-[#bce6dc]"
            size={36}
          />

          <p className="mt-4 text-sm text-[#aab8c7]">
            Loading your event pass…
          </p>
        </div>
      </main>
    )
  }

  if (error || !guest) {
    return (
      <main className={pageClass}>
        <div
          role="alert"
          className="w-full max-w-md rounded-[28px] border border-[#35435d] bg-[#192039] p-8 text-center shadow-2xl"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#bce6dc]">
            Limitless Naturals
          </p>

          <h1 className="mt-5 text-2xl font-semibold text-white">
            Invalid Event Pass
          </h1>

          <p className="mt-3 text-sm leading-7 text-[#aab8c7]">
            {error || 'Please open the invitation link in your email.'}
          </p>

          <a
            href="/"
            className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#bce6dc] px-6 text-sm font-semibold text-[#101225] transition hover:bg-[#d6f4ed] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#bce6dc]"
          >
            Back to website
          </a>
        </div>
      </main>
    )
  }

  const checkInUrl =
    `${window.location.origin}/check-in?token=${encodeURIComponent(token)}`

  return (
    <main className={pageClass}>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#bce6dc]">
            Limitless Naturals
          </p>

          <p className="mt-2 text-xs text-[#aab8c7]">
            The Libyan Chapter Begins
          </p>
        </div>

        <div className="overflow-hidden rounded-[32px] border border-white/20 bg-[#192039]/50 shadow-2xl backdrop-blur-xl">

          <div className="px-5 py-8 text-center sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#bce6dc]/30 bg-[#bce6dc]/10 text-[#bce6dc]">
              <Check size={28} aria-hidden="true" />
            </div>

            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#bce6dc]">
              Your Event Pass
            </p>

            <h1 className="mt-3 break-words text-3xl font-semibold leading-tight tracking-tight text-white">
              {guest.fullName}
            </h1>

            {guest.isVip && (
              <span className="mt-4 inline-flex rounded-full border border-[#f4d68b]/30 bg-[#f4d68b]/10 px-4 py-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#f4d68b]">
                VIP GUEST
              </span>
            )}

            <div className="my-7 border-t border-[#35435d]" />

            <div className="rounded-2xl border border-white/15 bg-[#11182b]/40 px-4 py-5">
              <div className="flex items-center justify-center gap-2 text-sm font-medium text-[#bce6dc]">
                <CalendarDays size={17} aria-hidden="true" />
                <span>14 NOVEMBER 2026</span>
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#aab8c7]">
                <Clock3 size={15} aria-hidden="true" />
                <span>3:00 PM–9:00 PM · Tripoli time</span>
              </div>

              <strong className="mt-5 block text-lg font-semibold leading-7 text-[#f4f7fa]">
                Lancaster,
                <br />
                Burj Al-Hayat Hotel
              </strong>

              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#aab8c7]">
                <MapPin size={15} aria-hidden="true" />
                <span>Tripoli, Libya</span>
              </div>
            </div>

            <div className="mt-7">
              <p className="text-[10px] font-semibold tracking-[0.2em] text-[#aab8c7]">
                INVITATION ID
              </p>

              <strong className="mt-2 block break-all text-2xl font-semibold tracking-wider text-white">
                {guest.invitationCode || '—'}
              </strong>
            </div>

            <div className="mt-7 flex justify-center">
              <div className="w-full max-w-[258px] rounded-2xl bg-white! p-4 shadow-sm">
                <QRCodeSVG
                  value={checkInUrl}
                  size={226}
                  level="H"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#000000"
                  title="Your event entry QR code"
                  className="block h-auto w-full"
                />
              </div>
            </div>

            <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-[#bce6dc]">
              YOUR EVENT QR CODE
            </p>

            <p className="mt-3 text-xs leading-6 text-[#aab8c7]">
              Present this QR code at the event entrance.
              <br />
              Keep your invitation link private.
            </p>
          </div>

         <div className="border-t border-white/15 bg-[#11182b]/40 px-5 py-5 text-center">
            <p className="text-sm font-medium text-[#bce6dc]">
              One Limitless Life
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
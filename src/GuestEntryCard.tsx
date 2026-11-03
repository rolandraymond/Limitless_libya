import { useEffect, useId, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { parsePassState } from './pass-state'
import { useLivePass } from './useLivePass'
import './guest-entry-card.css'

type Props = { token: string; initialState?: unknown }
export default function GuestEntryCard({ token, initialState }: Props) {
  const { state, status, reconnect } = useLivePass(token, initialState)
  const initialChecked = Boolean(parsePassState(initialState)?.checkedIn)
  const [phase, setPhase] = useState<'qr' | 'infinity' | 'seat'>(initialChecked ? 'seat' : 'qr')
  const checked = useRef(initialChecked)
  const gradientId = `pass-infinity-${useId().replace(/:/g, '')}`
  useEffect(() => {
    if (!state.checkedIn || checked.current) return
    checked.current = true
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPhase('seat')
      return
    }
    setPhase('infinity')
    const timer = setTimeout(() => setPhase('seat'), 2100)
    return () => clearTimeout(timer)
  }, [state.checkedIn])
  const checkInUrl = `${window.location.origin}/check-in?token=${encodeURIComponent(token)}`
  return <section className="guest-entry-card" aria-label="Your event entry pass">
    <div className={`guest-entry-card__stage guest-entry-card__stage--${phase}`}>
      {phase === 'qr' && <div className="guest-entry-card__qr-state">
        <div className="guest-entry-card__qr">
          <QRCodeSVG value={checkInUrl} size={210} level="H" includeMargin
            bgColor="#ffffff" fgColor="#000000" title="Your invitation QR code" />
        </div>
        <p className="guest-entry-card__label">YOUR ENTRY QR CODE</p>
        <p className="guest-entry-card__hint">Keep this code ready for workshop and event entry.</p>
      </div>}
      {phase === 'infinity' && <div className="guest-entry-card__animation" role="status" aria-live="polite">
        <svg className="guest-entry-card__infinity" viewBox="0 0 240 120" aria-hidden="true">
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#bce6dc" /><stop offset="55%" stopColor="#78cfff" /><stop offset="100%" stopColor="#d6b5ff" />
          </linearGradient></defs>
          <path className="guest-entry-card__track" d="M120 60C85 5 20 10 20 60s65 55 100 0c35-55 100-50 100 0S155 115 120 60" />
          <path className="guest-entry-card__light" pathLength="1" stroke={`url(#${gradientId})`} d="M120 60C85 5 20 10 20 60s65 55 100 0c35-55 100-50 100 0S155 115 120 60" />
        </svg>
        <p className="guest-entry-card__welcome">You’re checked in</p>
        <p className="guest-entry-card__hint">Your seat is ready.</p>
      </div>}
      {phase === 'seat' && state.checkedIn && <div className="guest-entry-card__seat" role="status" aria-live="polite">
        <span className="guest-entry-card__confirmed">✓ EVENT CHECK-IN CONFIRMED</span>
        <div className="guest-entry-card__numbers">
          <div><span>TABLE</span><strong>{String(state.tableNumber).padStart(2, '0')}</strong></div>
          <div><span>SEAT</span><strong>{String(state.seatNumber).padStart(2, '0')}</strong></div>
        </div>
        <p className="guest-entry-card__hint">Welcome. Please proceed to your table.</p>
      </div>}
    </div>
    {(status === 'offline' || status === 'reconnecting') && <div className="guest-entry-card__connection" role="status">
      <span>{status === 'reconnecting' ? 'Reconnecting your invitation…' : 'Live connection interrupted.'}</span>
      <button type="button" onClick={reconnect}>Reconnect</button>
    </div>}
  </section>
}

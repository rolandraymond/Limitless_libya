import { useEffect, useRef, useState } from 'react'
import './workshop-choice.css'

type Answer = 'yes' | 'no' | null
type Props = {
  disabled?: boolean
  qrToken: string | null
  value: Answer
  guestName?: string
  onChange: (answer: Answer) => void
}

export default function WorkshopChoice({ qrToken, value, guestName, onChange, disabled = false }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  useEffect(() => () => pending.current?.abort(), [])

  // A known invitation with a saved answer should not be asked again.
  // New guests keep their choice editable until registration actually succeeds.
  if (qrToken && value !== null) return null

  const choose = async (answer: 'yes' | 'no') => {
    if (inFlight.current || disabled) return
    setError('')
    if (!qrToken) { onChange(answer); return }
    inFlight.current = true
    setBusy(true)
    const controller = new AbortController()
    pending.current = controller
    try {
      const response = await fetch('/api/invite/workshop', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken, answer }),
      })
      const data = await response.json()
      if (!response.ok || data.workshopRsvp !== answer) {
        throw new Error(data.error || 'Your response could not be saved. Please try again.')
      }
      // Parent updates its saved answer only after server acknowledgement.
      if (!controller.signal.aborted) onChange(data.workshopRsvp)
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to save your response. Please try again.')
    } finally {
      inFlight.current = false
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return (
    <aside
  className="workshop-choice"
  lang="ar"
  dir="rtl"
  style={{
    textAlign: 'right',
    fontFamily: 'Tahoma, Arial, sans-serif',
  }}
  aria-label="AI Generated Video Content Training workshop invitation"
  aria-busy={busy}
>
      <div className="workshop-choice__top">
        <span className="workshop-choice__eyebrow">An invitation to create</span>
        <span className="workshop-choice__tag">Optional workshop</span>
      </div>
<h3 className="workshop-choice__title">
  🎬 عندك فكرة وتبي تحولها لمحتوى إبداعي؟
</h3>

<div style={{ display: 'grid', gap: 14 }}>
  <p>
    تبي تتعلّم كيف تنتج صور احترافية وفيديوهات مميزة
    للسوشيال ميديا باستخدام تقنيات الذكاء الاصطناعي (AI)؟
  </p>

  <p>
    تعال شاركنا في{' '}
    <bdi dir="ltr" lang="en">
      AI Generated Video Content Training
    </bdi>{' '}
    مع مدرب متخصص في صناعة المحتوى بالذكاء الاصطناعي.
  </p>

  <p className="workshop-choice__time">
    📅 14 نوفمبر
    <br />
    🕑 من الساعة 2 للساعة 4 ظهراً
    <br />
    📍 فندق{' '}
    <bdi dir="ltr" lang="en">
      Lancaster Burj Haya
    </bdi>
  </p>

  <p>
    <strong>🎁 الحضور مجاني بالكامل!</strong>
  </p>

  <p>
    ⚠️ التسجيل المسبق هنا ضروري لتأكيد حضورك.
  </p>


</div>
      <fieldset
  className="workshop-choice__fieldset"
  disabled={busy || disabled}
  style={{ marginTop: 24 }}
>
    <legend className="workshop-choice__question">
  هل تبي تشارك معنا في الورشة؟
</legend>

<div className="workshop-choice__actions">
  {(['yes', 'no'] as const).map(answer => (
    <button
      key={answer}
      type="button"
      className={`workshop-choice__button workshop-choice__button--${answer}`}
      aria-pressed={value === answer}
      onClick={() => void choose(answer)}
    >
      {value === answer && <span aria-hidden="true">✓ </span>}
      {answer === 'yes' ? 'نعم، بنشارك' : 'لا، شكراً'}
    </button>
  ))}
</div>
      </fieldset>
      <p className="workshop-choice__note">Attendance is optional. Your event invitation stays the same.</p>
      {busy && <p className="workshop-choice__status" role="status">Saving your response…</p>}
      {error && <p className="workshop-choice__error" role="alert">{error}</p>}
    </aside>
  )
}

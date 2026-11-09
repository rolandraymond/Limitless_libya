import { useEffect, useRef, type ReactNode } from 'react'
import WorkshopChoice from './WorkshopChoice'
import './workshop-qr-gate.css'

type Answer = 'yes' | 'no' | null

type Props = {
  qrToken: string
  value: Answer
  guestName?: string
  onChange: (answer: Answer) => void
  children: ReactNode
}

export default function WorkshopQrGate({ qrToken, value, guestName, onChange, children }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const needsAnswer = value !== 'yes' && value !== 'no'

  useEffect(() => {
    if (!needsAnswer) return
    const modal = dialog.current
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (modal && !modal.open) modal.showModal()
    return () => {
      modal?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    }
  }, [needsAnswer])

  // Do not mount GuestEntryCard or its QR until the saved response is available.
  if (!needsAnswer) return <>{children}</>

  return <>
    <div className="workshop-required-placeholder" lang="ar" dir="rtl">
      اختار نعم أو لا على سؤال الورشة لعرض دعوتك.
    </div>
    <dialog ref={dialog} className="workshop-required-dialog"
      aria-label="هل تبي تشارك معنا في الورشة؟"
      aria-modal="true"
      onCancel={event => event.preventDefault()}>
      <WorkshopChoice key={qrToken} qrToken={qrToken} value={null}
        guestName={guestName} onChange={onChange} />
    </dialog>
  </>
}

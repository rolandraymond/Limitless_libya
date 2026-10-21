import type { FormEvent } from 'react'
import { useState } from 'react'
import { CalendarDays, Check, MapPin } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import './registration-libya.css'

function normalizeLibyanPhone(value: string): string | null {
  if (typeof value !== 'string') return null

  const arabicDigits = '٠١٢٣٤٥٦٧٨٩'
  const easternDigits = '۰۱۲۳۴۵۶۷۸۹'

  let cleaned = value
    .trim()
    .replace(/[٠-٩]/g, digit =>
      String(arabicDigits.indexOf(digit))
    )
    .replace(/[۰-۹]/g, digit =>
      String(easternDigits.indexOf(digit))
    )
    .replace(/[\s()-]/g, '')

  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`
  }

  // Local: 0912345678
  if (/^09[1-6]\d{7}$/.test(cleaned)) {
    return `+218${cleaned.slice(1)}`
  }

  // Without the local leading zero: 912345678
  if (/^9[1-6]\d{7}$/.test(cleaned)) {
    return `+218${cleaned}`
  }

  // International without "+": 218912345678
  if (/^2189[1-6]\d{7}$/.test(cleaned)) {
    return `+${cleaned}`
  }

  // International: +218912345678
  if (/^\+2189[1-6]\d{7}$/.test(cleaned)) {
    return cleaned
  }

  return null
}
type InviteGuest = {
  fullName: string
  phone: string
  email?: string | null
  specialty?: string | null
  invitationCode: string | null
  rsvpStatus: string
  qrToken: string | null
}

export default function RegistrationSection() {
const [submitted, setSubmitted] = useState(false)

const [phone, setPhone] = useState('')
const [guest, setGuest] = useState<InviteGuest | null>(null)

const [loading, setLoading] = useState(false)
const [serverError, setServerError] = useState('')
const [phoneError, setPhoneError] = useState('')

const [isNewGuest, setIsNewGuest] = useState(false)

const [firstName, setFirstName] = useState('')
const [lastName, setLastName] = useState('')
const [email, setEmail] = useState('')
const [specialty, setSpecialty] = useState('')
const [invitedBy, setInvitedBy] = useState('')
const [consentAccepted, setConsentAccepted] =
  useState(false)

const [registrationErrors, setRegistrationErrors] = useState({
  firstName: '',
  lastName: '',
  email: '',
  specialty: '',
  invitedBy: '',

})




const [privacyAccepted, setPrivacyAccepted] =
  useState(false)

const lookupInvitation = async (
  e: FormEvent<HTMLFormElement>
) => {
  e.preventDefault()

  const cleanPhone = normalizeLibyanPhone(phone)

  if (!cleanPhone) {
  setPhoneError(
    'Please enter a valid Libyan mobile number, e.g. 0912345678.'
  )
  return
}

  setPhoneError('')
  setServerError('')

  if (!phone.trim()) {
    setPhoneError('Mobile number is required.')
    return
  }

  if (!cleanPhone) {
    setPhoneError(
      'Please enter a valid Libyan mobile number, e.g. 0912345678.'
    )
    return
  }

  setLoading(true)

  try {
    const response = await fetch('/api/invite/lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: cleanPhone,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      setGuest(null)

      if (data.code === 'GUEST_NOT_FOUND') {
        setIsNewGuest(true)
        setServerError('')
        return
      }

      setServerError(
        data.error ||
          'Unable to search for your registration.'
      )

      return
    }

    setIsNewGuest(false)
    setGuest(data.guest)

  } catch (error) {
    console.error(error)

    setServerError(
      'Unable to connect. Please try again.'
    )
  } finally {
    setLoading(false)
  }
}

const registerNewGuest = async (
  e: FormEvent<HTMLFormElement>
) => {
  e.preventDefault()

  const cleanFirstName = firstName.trim()
const cleanLastName = lastName.trim()


  const cleanEmail = email.trim().toLowerCase()
const cleanPhone = normalizeLibyanPhone(phone)


  if (!cleanPhone) {
    setServerError('Please enter a valid Libyan mobile number, e.g. 0912345678.')
    return
  }
  if (!consentAccepted) {
    setServerError('Please agree to the event rules.')
    return
  }

  const nameRegex = /^[\p{L}\s.'’\-]+$/u
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  const newErrors = {
  firstName: '',
  lastName: '',
    email: '',
    specialty: '',
   invitedBy: '',

  }

if (!cleanFirstName) {
  newErrors.firstName =
    'First name is required.'
} else if (
  cleanFirstName.length < 2 ||
  !nameRegex.test(cleanFirstName)
) {
  newErrors.firstName =
    'Please enter a valid first name.'
}

if (!cleanLastName) {
  newErrors.lastName =
    'Last name is required.'
} else if (
  cleanLastName.length < 2 ||
  !nameRegex.test(cleanLastName)
) {
  newErrors.lastName =
    'Please enter a valid last name.'
}
  if (!cleanEmail) {
    newErrors.email = 'Email address is required.'
  } else if (!emailRegex.test(cleanEmail)) {
    newErrors.email = 'Please enter a valid email address.'
  }

if (!specialty) {
  newErrors.specialty = 'Please select your specialty.'
}


if (!invitedBy) {
  newErrors.invitedBy =
    'Please select who invited you.'
}

setRegistrationErrors(newErrors)

if (
  newErrors.firstName ||
  newErrors.lastName ||
  newErrors.email ||
  newErrors.specialty ||

  newErrors.invitedBy
) {
  return
}

  setLoading(true)
  setServerError('')

  try {
    const response = await fetch('/api/rsvp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: cleanFirstName,
        lastName: cleanLastName,
        phone: cleanPhone,
        email: cleanEmail,
        specialty,
        invitedBy,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      setServerError(
        data.error ||
          'Unable to complete registration.'
      )
      return
    }

    setGuest({
      fullName: data.guest.fullName,
      phone: data.guest.phone,
      email: data.guest.email,
      specialty: data.guest.specialty,
      invitationCode: data.guest.invitationCode,
      rsvpStatus: data.guest.rsvpStatus,
      qrToken: data.guest.qrToken,
    })

    setIsNewGuest(false)
    setSubmitted(true)

    window.setTimeout(() => {
      document
        .querySelector('#rsvp')
        ?.scrollIntoView({
          behavior: 'smooth',
        })
    }, 50)

  } catch (error) {
    console.error(error)

    setServerError(
      'Unable to connect. Please try again.'
    )
  } finally {
    setLoading(false)
  }
}

const confirmAttendance = async (
  e: FormEvent<HTMLFormElement>
) => {
  e.preventDefault()

  if (!guest) {
    return
  }

  setLoading(true)
  setServerError('')

  try {
    const response = await fetch('/api/rsvp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: guest.phone,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      if (data.code === 'ALREADY_CONFIRMED') {
      setGuest({
        ...guest,
        fullName: data.guest.fullName,
        invitationCode: data.guest.invitationCode,
        rsvpStatus: 'confirmed',
        qrToken: data.guest.qrToken,
      })

        return
      }

      setServerError(
        data.error ||
          'Unable to confirm attendance.'
      )

      return
    }

setGuest({
  ...guest,
  fullName: data.guest.fullName,
  phone: data.guest.phone,
  email: data.guest.email,
  invitationCode: data.guest.invitationCode,
  rsvpStatus: 'confirmed',
  qrToken: data.guest.qrToken,
})

    setSubmitted(true)

    window.setTimeout(() => {
      document
        .querySelector('#rsvp')
        ?.scrollIntoView({
          behavior: 'smooth',
        })
    }, 50)

  } catch (error) {
    console.error(error)

    setServerError(
      'Unable to connect. Please try again.'
    )
  } finally {
    setLoading(false)
  }
}


const resetInvitation = () => {
  setGuest(null)
  setSubmitted(false)

  setPhone('')
  setFirstName('')
  setLastName('')
  setEmail('')
  setSpecialty('')
  setInvitedBy('')
  setConsentAccepted(false)
  setPrivacyAccepted(false)
  setIsNewGuest(false)

  setPhoneError('')
  setServerError('')

  setRegistrationErrors({
    firstName: '',
    lastName: '',
    email: '',
    specialty: '',
    invitedBy: '',

  })
}

const getCheckInUrl = (qrToken: string) => {
  return `${window.location.origin}/check-in?token=${encodeURIComponent(qrToken)}`
}





return (
      <section className="rsvp-section ly-registration" id="rsvp">
        <div className="shell rsvp-grid">
          <div className="rsvp-copy">
            <span className="section-kicker">YOUR INVITATION</span>
<h2>Register for the<br />Libya Launch</h2>      
            <p>Confirm your attendance and we’ll keep your invitation details ready for the event.</p>
            <div className="mini-meta"><CalendarDays /> 14 NOV 2026</div>
            <div className="mini-meta"><MapPin /> LANCASTER, BURJ AL-HAYAT HOTEL, TRIPOLI, LIBYA</div>
          </div>

          <div className="rsvp-card">

    {!submitted ? (

      isNewGuest ? (

        <form
          onSubmit={registerNewGuest}
          noValidate
          className="space-y-5"
        >

          <div className="form-head">
            <p>NEW REGISTRATION</p>
            <h3>Complete your registration</h3>
          </div>

          <p className="text-sm leading-relaxed text-neutral-600">
            We couldn't find an existing registration for this number.
            Complete your details below to join the event.
          </p>

<div className="grid gap-4 sm:grid-cols-2">

  {/* FIRST NAME */}
  <label className="block">
    <span className="mb-2 block text-sm font-medium">
      First name
    </span>

    <input
      type="text"
      value={firstName}
      autoComplete="given-name"
      maxLength={40}
      placeholder="First Name"
      onChange={(e) => {
        setFirstName(e.target.value)

        if (registrationErrors.firstName) {
          setRegistrationErrors(prev => ({
            ...prev,
            firstName: '',
          }))
        }
      }}
      className={`
        w-full rounded-xl border bg-white px-4 py-3
        text-neutral-900 outline-none transition
        placeholder:text-neutral-400
        ${
          registrationErrors.firstName
            ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-neutral-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10'
        }
      `}
    />

    {registrationErrors.firstName && (
      <p className="mt-1.5 text-sm font-medium text-red-500">
        {registrationErrors.firstName}
      </p>
    )}
  </label>


  {/* LAST NAME */}
  <label className="block">
    <span className="mb-2 block text-sm font-medium">
      Last name
    </span>

    <input
      type="text"
      value={lastName}
      autoComplete="family-name"
      maxLength={40}
      placeholder="Last Name"
      onChange={(e) => {
        setLastName(e.target.value)

        if (registrationErrors.lastName) {
          setRegistrationErrors(prev => ({
            ...prev,
            lastName: '',
          }))
        }
      }}
      className={`
        w-full rounded-xl border bg-white px-4 py-3
        text-neutral-900 outline-none transition
        placeholder:text-neutral-400
        ${
          registrationErrors.lastName
            ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
            : 'border-neutral-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10'
        }
      `}
    />

    {registrationErrors.lastName && (
      <p className="mt-1.5 text-sm font-medium text-red-500">
        {registrationErrors.lastName}
      </p>
    )}
  </label>

</div>

          {/* Mobile */}
          <label className="block">

            <span className="mb-2 block text-sm font-medium">
              Mobile number
            </span>

            <input
              type="tel"
              value={phone}
              readOnly
              className="
                w-full rounded-xl border
                border-neutral-200
                bg-neutral-100
                px-4 py-3
                text-neutral-600
              "
            />

          </label>

          {/* Email */}
          <label className="block">

            <span className="mb-2 block text-sm font-medium">
              Email address
            </span>

            <input
              type="email"
              value={email}
              autoComplete="email"
              maxLength={120}
              placeholder="doctor@example.com"
              onChange={(e) => {
                setEmail(e.target.value)

                if (registrationErrors.email) {
                  setRegistrationErrors(prev => ({
                    ...prev,
                    email: '',
                  }))
                }
              }}
              className={`
                w-full rounded-xl border bg-white px-4 py-3
                text-neutral-900 outline-none transition
                placeholder:text-neutral-400
                ${
                  registrationErrors.email
                    ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                    : 'border-neutral-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10'
                }
              `}
            />

            {registrationErrors.email && (
              <p className="mt-1.5 text-sm font-medium text-red-500">
                {registrationErrors.email}
              </p>
            )}

          </label>
            <div className="space-y-2">

            <label
              htmlFor="specialty"
              className="block text-sm font-medium text-neutral-800"
            >
              Specialty / Profession
            </label>

            <select
              id="specialty"
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value)

                setRegistrationErrors((prev) => ({
                  ...prev,
                  specialty: '',
                }))
              }}
              className="
                w-full
                rounded-2xl
                border
                border-neutral-300
                bg-white
                px-4
                py-3.5
                text-neutral-900
                outline-none
                transition
                focus:border-[#e5a01a]
                focus:ring-2
                focus:ring-[#e5a01a]/20
              "
            >
              <option value="">
                Select your specialty
              </option>

              <option value="Health Advocates">
                Health Advocates
              </option>

              <option value="Nutritionist">
                Nutritionist
              </option>

              <option value="Orthopedic">
                Orthopedic
              </option>

              <option value="Internist">
                Internist
              </option>

              <option value="Gynecologist">
                Gynecologist
              </option>

              <option value="Dermatologist">
                Dermatologist
              </option>

              <option value="Pharmacist">
                Pharmacist
              </option>

              <option value="Staff">
                Staff
              </option>
            </select>

            {registrationErrors.specialty && (
              <p className="text-sm text-red-600">
                {registrationErrors.specialty}
              </p>
            )}
          </div>


            <div className="space-y-2">

              <label
                htmlFor="invitedBy"
                className="block text-sm font-medium text-neutral-800"
              >
                Invited By
              </label>

              <select
                id="invitedBy"
                value={invitedBy}
                onChange={(e) => {
                  setInvitedBy(e.target.value)

                  setRegistrationErrors((prev) => ({
                    ...prev,
                    invitedBy: '',
                  }))
                }}
                className="
                  w-full
                  rounded-2xl
                  border
                  border-neutral-300
                  bg-white
                  px-4
                  py-3.5
                  text-neutral-900
                  outline-none
                  transition
                  focus:border-[#e5a01a]
                  focus:ring-4
                  focus:ring-[#e5a01a]/10
                "
              >
                 <option value="">Select who invited you</option>
                {/*<option value="Medical Team">Medical Team</option>
                <option value="PR Team">PR Team</option>
                <option value="Chain Team">Chain Team</option>
                <option value="Sales Team">Sales Team</option>
                <option value="E-Commerce Team">
                  E-Commerce Team
                </option>
              <option value="Staff">Staff</option> */}
              <option value="Nada Jawad">Nada Jawad</option>
<option value="Nurhan AbdelAziz">Nurhan AbdelAziz</option>
<option value="Emad Elmiladi">Emad Elmiladi</option>
<option value="Mansour Alrabeay">Mansour Alrabeay</option>
<option value="Attia Dabbour">Attia Dabbour</option>
<option value="Mohamed Alareefi">Mohamed Alareefi</option>
<option value="Mohamed Sulayman">Mohamed Sulayman</option>
<option value="Aya Ali">Aya Ali</option>
<option value="AbdelMoez Abo Akrab">AbdelMoez Abo Akrab</option>
<option value="Abdullah Hussien">Abdullah Hussien</option>
<option value="Ghadir Mangoud">Ghadir Mangoud</option>

              </select>

              {registrationErrors.invitedBy && (
                <p className="text-sm text-red-600">
                  {registrationErrors.invitedBy}
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              
              <input
                required
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) =>
                  setConsentAccepted(e.target.checked)
                }
                className="
                  mt-1 h-4 w-4
                  rounded border-neutral-300
                  accent-orange-500
                "
              />

            <div className="text-sm leading-relaxed text-neutral-600">
              <span className="font-semibold text-neutral-800">
                I have read and agree to the event rules:
              </span>

              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>This invitation is valid for one guest only.</li>
                <li>Children are not permitted at the event.</li>
              </ul>

              <p className="mt-2">
                I agree to receive event confirmation and
                event-related communications.
              </p>
            </div>

          </label>

          {serverError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !consentAccepted}
            className="
              button button-primary full
              w-full transition
              active:scale-[0.98]
              disabled:cursor-not-allowed
              disabled:opacity-60
            "
          >
            {loading
              ? 'REGISTERING...'
              : 'COMPLETE REGISTRATION'}
          </button>

          <button
            type="button"
            onClick={resetInvitation}
            disabled={loading}
            className="button button-ghost full w-full"
          >
            USE ANOTHER NUMBER
          </button>

        </form>

      ) : !guest ? (

                /* =========================
                  STEP 1 — FIND INVITATION
                  ========================= */

                <form
                  onSubmit={lookupInvitation}
                  noValidate
                  className="space-y-5"
                >

                  <div className="form-head">
                    <p>YOUR INVITATION</p>
                    <h3>Find your invitation</h3>
                  </div>

                  <p className="text-sm leading-relaxed text-neutral-600">
                    Enter the mobile number associated with your invitation.
                  </p>

                  <div className="block">

                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                              <input
                                type="checkbox"
                                checked={privacyAccepted}
                                onChange={(e) =>
                                  setPrivacyAccepted(e.target.checked)
                                }
                                className="
                                  mt-1 h-4 w-4
                                  shrink-0
                                  rounded
                                  border-neutral-300
                                  accent-orange-500
                                "
                              />

                              <span className="text-sm leading-relaxed text-neutral-700">
                                This invitation is private. Please do not share it
                                with anyone. By continuing, you agree to keep your
                                invitation details confidential.
                              </span>
                            </label>

                    <span className="mb-2 block text-sm font-medium">
                      Mobile number
                    </span>

                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      autoComplete="tel"
                      maxLength={18}
                      placeholder="010 XXX XXXX"
                      onChange={(e) => {
                        const value = e.target.value

                        if (/^\+?[0-9\s-]*$/.test(value)) {
                          setPhone(value)

                          if (phoneError) {
                            setPhoneError('')
                          }

                          if (serverError) {
                            setServerError('')
                          }
                        }
                      }}
                      className={`
                        w-full rounded-xl border
                        bg-white px-4 py-3
                        text-neutral-900
                        outline-none transition
                        placeholder:text-neutral-400
                        ${
                          phoneError
                            ? 'border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                            : 'border-neutral-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10'
                        }
                      `}
                    />

                    {phoneError && (
                      <p className="mt-1.5 text-sm font-medium text-red-500">
                        {phoneError}
                      </p>
                    )}

                  </div>

                  {serverError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {serverError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !privacyAccepted}
                    className="
                      button button-primary full
                      w-full transition
                      active:scale-[0.98]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {loading
                      ? 'SEARCHING...'
                      : 'FIND MY INVITATION'}
                  </button>

                </form>

              ) : guest.rsvpStatus === 'confirmed' ? (

                /* =========================
                  ALREADY CONFIRMED
                  ========================= */

                <div className="success-state">

                  <div className="success-icon">
                    <Check />
                  </div>

                  <p className="success-kicker">
                    ALREADY CONFIRMED
                  </p>

                  <h3>
                    Welcome, {guest.fullName}.
                  </h3>

                  <p>
                    Your attendance has already been confirmed.
                  </p>

                  <div className="ticket">
                    <span>14 NOV 2026</span>
                    <strong>LANCASTER, BURJ AL-HAYAT HOTEL</strong>
                    <small>TRIPOLI, LIBYA</small>
                  </div>

                  {guest.invitationCode && (
                    <div className="mt-6">

                      <span className="block text-xs tracking-[0.2em] text-neutral-500">
                        INVITATION ID
                      </span>

                      <strong className="mt-1 block text-2xl">
                        {guest.invitationCode}
                      </strong>

                    </div>
                  )}
                  
                  {guest.qrToken && (

                <div className="mt-8 flex flex-col items-center">

                  <div className="rounded-2xl bg-white p-4 shadow-md">
                    <QRCodeSVG
                      value={getCheckInUrl(guest.qrToken)}
                      size={190}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <p className="mt-4 text-sm font-semibold text-neutral-800">
                    YOUR EVENT QR CODE
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    Keep this QR code ready for event check-in.
                  </p>

                </div>
              )}
                  <button
                    type="button"
                    onClick={resetInvitation}
                    className="button button-ghost full mt-6 w-full"
                  >
                    USE ANOTHER NUMBER
                  </button>

                </div>

              ) : (

                /* =========================
                  STEP 2 — CONFIRM
                  ========================= */

                <form
                  onSubmit={confirmAttendance}
                  className="space-y-5"
                >

                  <div className="form-head">
                    <p>INVITATION FOUND</p>
                    <h3>
                      Welcome, {guest.fullName}
                    </h3>
                  </div>

                  <div className="
                    rounded-2xl
                    border border-neutral-200
                    bg-neutral-50
                    p-5
                  ">

                    <span className="block text-xs font-semibold tracking-[0.18em] text-neutral-500">
                      INVITATION ID
                    </span>

                    <strong className="mt-2 block text-2xl text-neutral-900">
                      {guest.invitationCode}
                    </strong>

                    <span className="mt-4 block text-sm text-neutral-500">
                      14 NOV 2026
                    </span>

                    <span className="mt-1 block text-sm font-medium text-neutral-700">
                      LANCASTER, BURJ AL-HAYAT HOTEL, TRIPOLI, LIBYA
                    </span>

                  </div>

                  <label className="flex cursor-pointer items-start gap-3">

                    <input
                      required
                      type="checkbox"
                      className="
                        mt-1 h-4 w-4
                        rounded border-neutral-300
                        accent-orange-500
                      "
                    />

                    <span className="text-sm leading-relaxed text-neutral-600">
                      I agree to receive event confirmation
                      and event-related communication.
                    </span>

                  </label>

                  {serverError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {serverError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="
                      button button-primary full
                      w-full transition
                      active:scale-[0.98]
                      disabled:cursor-not-allowed
                      disabled:opacity-60
                    "
                  >
                    {loading
                      ? 'CONFIRMING...'
                      : 'CONFIRM MY ATTENDANCE'}
                  </button>

                  <button
                    type="button"
                    onClick={resetInvitation}
                    disabled={loading}
                    className="button button-ghost full w-full"
                  >
                    USE ANOTHER NUMBER
                  </button>

                </form>

              )

            ) : (

              /* =========================
                CONFIRMATION SUCCESS
                ========================= */

              <div className="success-state">

                <div className="success-icon">
                  <Check />
                </div>

                <p className="success-kicker">
                  YOU’RE IN
                </p>

                <h3>
                  Thank you{guest ? `, ${guest.fullName}` : ''}.
                </h3>

                <p>
                  Your attendance at the Limitless Naturals Launch in Libya has been confirmed.
                </p>

                <div className="ticket">
                  <span>14 NOV 2026</span>
                  <strong>LANCASTER, BURJ AL-HAYAT HOTEL</strong>
                  <small>TRIPOLI, LIBYA</small>
                </div>

                {guest?.invitationCode && (
                  <div className="mt-6">

                    <span className="block text-xs tracking-[0.2em] text-neutral-500">
                      INVITATION ID
                    </span>

                    <strong className="mt-1 block text-2xl">
                    {guest.invitationCode}
                    </strong>

                  </div>
                )}

                {guest?.qrToken && (
  <div className="mt-8 flex flex-col items-center">

                  <div className="rounded-2xl bg-white p-4 shadow-md">
                    <QRCodeSVG
                      value={getCheckInUrl(guest.qrToken)}
                      size={190}
                      level="H"
                      includeMargin
                    />
                  </div>

                  <p className="mt-4 text-sm font-semibold text-neutral-800">
                    YOUR EVENT QR CODE
                  </p>

                  <p className="mt-1 max-w-xs text-center text-xs leading-relaxed text-neutral-500">
                    Keep this QR code ready for check-in at the event.
                  </p>

                </div>
              )}

              </div>

            )}

          </div>
        </div>
      </section>


      
)
}

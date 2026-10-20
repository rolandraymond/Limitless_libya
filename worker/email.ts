export interface EmailEnv {
  RESEND_API_KEY: string
  EMAIL_FROM: string
  PUBLIC_APP_URL: string
}

export async function sendConfirmationEmail(
  env: EmailEnv,
  guest: {
    fullName: string
    email: string
    invitationCode: string
    qrToken: string
  }
) {
  const eventPassUrl =
    `${env.PUBLIC_APP_URL}/pass?token=${encodeURIComponent(
      guest.qrToken
    )}`

  const text = `YOU'RE IN

Thank you, ${guest.fullName}.

Your attendance at شمسك جواك has been confirmed.

02 OCT 2026

THE NILE RITZ-CARLTON

CAIRO

INVITATION ID

${guest.invitationCode}

VIEW MY EVENT PASS
${eventPassUrl}`

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [guest.email],
        subject: 'Your invitation to شمسك جواك',
        text,
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()

    console.error(
      'RESEND ERROR:',
      response.status,
      errorText
    )

    return false
  }

  const result = await response.json()

  console.log('RESEND SUCCESS:', result)

  return true
}
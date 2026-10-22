export interface EmailEnv {
  RESEND_API_KEY: string
  EMAIL_FROM: string
  PUBLIC_APP_URL: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entities[character]!
  })
}

export async function sendConfirmationEmail(
  env: EmailEnv,
  guest: {
    fullName: string
    email: string
    invitationCode: string
    qrToken: string
  }
): Promise<boolean> {
  const baseUrl = env.PUBLIC_APP_URL.replace(/\/+$/, '')
  const eventPassUrl =
    `${baseUrl}/pass?token=${encodeURIComponent(guest.qrToken)}`

  const name = escapeHtml(guest.fullName)
  const invitationCode = escapeHtml(guest.invitationCode)
  const passUrl = escapeHtml(eventPassUrl)

  const text = `YOU'RE IN

Thank you, ${guest.fullName}.

Your attendance at the Limitless Naturals Libya launch event has been confirmed.

DATE: 14 November 2026
TIME: 3:00 PM–9:00 PM (Tripoli local time)
VENUE: Lancaster, Burj Al-Hayat Hotel
LOCATION: Tripoli, Libya

INVITATION ID: ${guest.invitationCode}

View your event pass:
${eventPassUrl}

Please present the QR code on your event pass at the entrance.

We look forward to welcoming you.
Limitless Naturals`

  const html = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Limitless Naturals Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#101225;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
    Your invitation is confirmed. Join us in Tripoli on 14 November 2026.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background-color:#101225;font-family:Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
          style="max-width:600px;">

          <tr>
            <td style="padding:0 8px 24px;">
              <p style="margin:0;color:#bce6dc;font-size:12px;font-weight:700;letter-spacing:3px;">
                LIMITLESS NATURALS
              </p>
              <p style="margin:10px 0 0;color:#aab8c7;font-size:13px;">
                Limitless Naturals Launch event - Libya
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 28px;background-color:#192039;border:1px solid #35435d;border-radius:24px;">

              <p style="margin:0 0 18px;color:#bce6dc;font-size:11px;font-weight:700;letter-spacing:3px;">
                YOUR ATTENDANCE IS CONFIRMED
              </p>

              <h1 style="margin:0 0 24px;color:#ffffff;font-size:42px;line-height:1.1;letter-spacing:-1px;">
                You're in.
              </h1>

              <p style="margin:0 0 14px;color:#f4f7fa;font-size:18px;line-height:1.6;">
                Thank you, <strong>${name}</strong>.
              </p>

              <p style="margin:0 0 28px;color:#aab8c7;font-size:15px;line-height:1.8;">
                Your attendance at the <strong style="color:#f4f7fa;">Limitless Naturals Libya launch event</strong>
                has been confirmed. We look forward to welcoming you
                for a new chapter in everyday wellness.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#11182b;border:1px solid #35435d;border-radius:16px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 8px;color:#bce6dc;font-size:10px;font-weight:700;letter-spacing:2px;">
                      DATE &amp; TIME
                    </p>
                    <p style="margin:0;color:#f4f7fa;font-size:18px;font-weight:700;line-height:1.5;">
                      14 November 2026
                    </p>
                    <p style="margin:5px 0 0;color:#aab8c7;font-size:14px;line-height:1.6;">
                      3:00 PM–9:00 PM · Tripoli local time
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 24px 24px;">
                    <p style="margin:0 0 8px;color:#bce6dc;font-size:10px;font-weight:700;letter-spacing:2px;">
                      VENUE
                    </p>
                    <p style="margin:0;color:#f4f7fa;font-size:16px;font-weight:700;line-height:1.6;">
                      Lancaster, Burj Al-Hayat Hotel
                    </p>
                    <p style="margin:5px 0 0;color:#aab8c7;font-size:14px;">
                      Tripoli, Libya
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:28px 0;">
                    <p style="margin:0 0 10px;color:#aab8c7;font-size:10px;font-weight:700;letter-spacing:2px;">
                      INVITATION ID
                    </p>
                    <p style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:3px;">
                      ${invitationCode}
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#bce6dc"
                    style="background-color:#bce6dc;border-radius:12px;mso-padding-alt:18px 24px;">
                    <a href="${passUrl}"
                      style="display:block;padding:18px 24px;color:#101225;font-size:13px;font-weight:700;letter-spacing:1px;text-decoration:none;text-align:center;">
                      VIEW MY EVENT PASS
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:20px 0 0;color:#aab8c7;font-size:12px;line-height:1.8;text-align:center;">
                Please present the QR code on your event pass at the entrance.
                Keep your invitation link private.
              </p>

            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 16px;">
              <p style="margin:0;color:#bce6dc;font-size:16px;font-weight:700;">
                One Limitless Life
              </p>
              <p style="margin:12px 0 0;color:#aab8c7;font-size:12px;line-height:1.8;">
                Button not working?
                <a href="${passUrl}" style="color:#bce6dc;text-decoration:underline;">
                  Open your event pass
                </a>
              </p>
              <p style="margin:16px 0 0;color:#8597ab;font-size:11px;">
                Limitless Naturals · Libya Launch Event
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [guest.email],
        subject: "You're in — Limitless Naturals Libya",
        html,
        text,
      }),
    })

    if (!response.ok) {
      console.error(
        'RESEND ERROR:',
        response.status,
        await response.text()
      )

      return false
    }

    return true
  } catch (error) {
    console.error('CONFIRMATION EMAIL ERROR:', error)
    return false
  }
}
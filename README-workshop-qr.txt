Workshop response popup before displaying the guest QR

Apply from the website project directory containing package.json:
  unzip -o ~/Downloads/workshop-qr-popup.zip -d .
  npm run dev

Changed files based on the supplied November 9 source:
- src/PassPage.tsx
- src/RegistrationSection.tsx
New files:
- src/WorkshopQrGate.tsx
- src/workshop-qr-gate.css

Keep your current WorkshopChoice.tsx and workshop-choice.css.
No worker change, migration, package installation or deployment is required by this patch.
The existing POST /api/invite/workshop endpoint must remain available.

Behavior:
- Unanswered confirmed guests see a native modal containing the existing workshop invitation.
- Escape and backdrop clicks do not dismiss the question.
- GuestEntryCard and its QR are not mounted until a saved yes/no is available.
- The existing WorkshopChoice sends the invitation token and answer; the parent is updated only after server acknowledgement.
- On request failure the popup stays open and the yes/no buttons can be used again.
- Already answered guests see their QR immediately.
- The new-guest question before registration remains in its existing position.
- These changes control guest-facing presentation; staff check-in and existing invitation tokens are unchanged.

Manual check:
1. Retrieve an unanswered confirmed guest using their registered phone: popup appears, QR absent.
2. Press Escape / click outside: popup stays open.
3. Choose yes: wait for save; popup closes and QR appears.
4. Reload / retrieve the same guest: QR appears without asking again.
5. Repeat with a different unanswered guest choosing no.
6. Open an unanswered /pass?token=... invitation directly: same popup behavior.
7. Simulate an offline request before choosing: error appears and QR stays hidden; reconnect and choose again.
8. Verify an existing answered guest and the normal new-guest registration flow.

Validation completed:
- TSX syntax checks for all changed/new TSX files.
- Component-level mock checks: hidden/revealed QR branches, Escape cancellation, waiting for acknowledgement, duplicate click prevention, failed and mismatched save responses.
- Verified all three GuestEntryCard render locations are wrapped.
A full project build and real browser integration test were not available in this workspace. No deployment was performed.

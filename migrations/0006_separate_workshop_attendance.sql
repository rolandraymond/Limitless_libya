-- Existing checked_in / checked_in_at continue to mean EVENT attendance.
-- Existing registrations, invitation codes and QR tokens are unchanged.
ALTER TABLE guests ADD COLUMN workshop_rsvp TEXT
  CHECK (workshop_rsvp IN ('yes', 'no') OR workshop_rsvp IS NULL);
ALTER TABLE guests ADD COLUMN workshop_checked_in INTEGER NOT NULL DEFAULT 0
  CHECK (workshop_checked_in IN (0, 1));
ALTER TABLE guests ADD COLUMN workshop_checked_in_at TEXT;

-- Release regular no-show reservations ONCE, not on every guest arrival.
-- Preserve checked-in guests, VIP-flagged guests, and any guest reserved at
-- a VIP table (including older reservations without the is_vip flag).
UPDATE guests
SET table_number = NULL,
    seat_number = NULL,
    table_locked = 0,
    updated_at = CURRENT_TIMESTAMP
WHERE checked_in = 0 AND is_vip = 0
  AND NOT EXISTS (
    SELECT 1 FROM event_tables t
    WHERE t.table_number = guests.table_number AND t.table_type = 'vip'
  );

CREATE INDEX idx_guests_workshop_checked_in ON guests(workshop_checked_in);
CREATE INDEX idx_guests_workshop_rsvp ON guests(workshop_rsvp);

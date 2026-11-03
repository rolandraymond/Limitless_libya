-- READ ONLY. Run before migration 0006 against the intended database.
SELECT table_type, COUNT(*) AS tables, SUM(capacity) AS total_seats,
       MIN(capacity) AS min_capacity, MAX(capacity) AS max_capacity
FROM event_tables WHERE is_active = 1 GROUP BY table_type;

SELECT table_number, capacity, is_active
FROM event_tables WHERE table_type = 'vip' ORDER BY table_number;

SELECT COUNT(*) AS regular_reservations_to_release
FROM guests g
WHERE g.checked_in = 0 AND g.is_vip = 0
  AND NOT EXISTS (
    SELECT 1 FROM event_tables t
    WHERE t.table_number = g.table_number AND t.table_type = 'vip'
  )
  AND (g.table_number IS NOT NULL OR g.seat_number IS NOT NULL OR g.table_locked <> 0);

SELECT COUNT(*) AS existing_event_attendance FROM guests WHERE checked_in = 1;
SELECT COUNT(*) AS vip_reservations_to_preserve
FROM guests g
WHERE (g.is_vip = 1 OR EXISTS (
  SELECT 1 FROM event_tables t WHERE t.table_number = g.table_number AND t.table_type = 'vip'
)) AND (g.table_number IS NOT NULL OR g.seat_number IS NOT NULL);

-- Counts only; no phone numbers or invitation tokens are output.
SELECT COUNT(*) AS inconsistent_reservations
FROM guests g LEFT JOIN event_tables t ON t.table_number = g.table_number
WHERE (g.table_number IS NULL) <> (g.seat_number IS NULL)
   OR (g.table_number IS NOT NULL AND (
     t.table_number IS NULL OR g.seat_number < 1 OR g.seat_number > t.capacity OR t.is_active = 0
   ));

export interface TableEnv {
  DB: D1Database
}

export async function getTablesOverview(env: TableEnv) {
  const result = await env.DB.prepare(`
    SELECT
      t.table_number,
      t.capacity,
      t.table_type,
      t.is_active,
      COUNT(g.id) AS assigned,
      COALESCE(SUM(
        CASE WHEN g.checked_in = 1 THEN 1 ELSE 0 END
      ), 0) AS checked_in
    FROM event_tables t
    LEFT JOIN guests g
      ON g.table_number = t.table_number
      AND g.rsvp_status = 'confirmed'
    GROUP BY
      t.table_number, t.capacity, t.table_type, t.is_active
    ORDER BY t.table_number ASC
  `).all<{
    table_number: number
    capacity: number
    table_type: 'regular' | 'vip'
    is_active: number
    assigned: number
    checked_in: number
  }>()

  return result.results.map(row => ({
    tableNumber: row.table_number,
    capacity: Number(row.capacity),
    tableType: row.table_type,
    isActive: Boolean(row.is_active),
    assigned: Number(row.assigned),
    available: Number(row.capacity) - Number(row.assigned),
    checkedIn: Number(row.checked_in),
  }))
}

export async function setTableType(
  env: TableEnv,
  tableNumber: number,
  tableType: 'regular' | 'vip'
) {
  const result = await env.DB.prepare(`
    UPDATE event_tables
    SET table_type = ?, updated_at = CURRENT_TIMESTAMP
    WHERE table_number = ?
  `).bind(tableType, tableNumber).run()

  return result.meta.changes > 0
}

// Bulk preallocation conflicts with assignment on arrival. VIP reservations
// remain available through the authenticated manual-seat endpoint.
export async function autoAssignTables(_env: TableEnv) {
  return {
    success: false,
    code: 'AUTO_ASSIGN_DISABLED',
    error: 'Regular seats are assigned at event check-in. Reserve VIP seats individually.',
  }
}

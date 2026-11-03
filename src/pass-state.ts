export type PublicPassState = {
  checkedIn: boolean
  checkedInAt: string | null
  tableNumber: number | null
  seatNumber: number | null
}
export const EMPTY_PASS_STATE: PublicPassState = {
  checkedIn: false, checkedInAt: null, tableNumber: null, seatNumber: null,
}
export function parsePassState(input: unknown): PublicPassState | null {
  if (!input || typeof input !== 'object') return null
  const value = input as Record<string, unknown>
  if (typeof value.checkedIn !== 'boolean') return null
  if (!value.checkedIn) return { ...EMPTY_PASS_STATE }
  if (!Number.isSafeInteger(value.tableNumber) || Number(value.tableNumber) < 1 ||
      !Number.isSafeInteger(value.seatNumber) || Number(value.seatNumber) < 1) return null
  return { checkedIn: true,
    checkedInAt: typeof value.checkedInAt === 'string' ? value.checkedInAt : null,
    tableNumber: Number(value.tableNumber), seatNumber: Number(value.seatNumber) }
}
export function mergePassState(current: PublicPassState, next: PublicPassState): PublicPassState {
  // An older pre-arrival snapshot must not restore the QR after confirmed entry.
  return current.checkedIn && !next.checkedIn ? current : next
}

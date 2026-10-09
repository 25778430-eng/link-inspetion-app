/** Inspections are due once per calendar day in South African time (SAST, UTC+2, no daylight saving). */
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

export function sastDay(iso: string | Date): string {
  const t = typeof iso === 'string' ? Date.parse(iso) : iso.getTime();
  return new Date(t + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

export function isDueToday(lastSubmittedAt: string | null, now: Date = new Date()): boolean {
  if (!lastSubmittedAt) return true;
  return sastDay(lastSubmittedAt) !== sastDay(now);
}

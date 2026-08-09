const DAY_MS = 86_400_000;

export function requireWholeDays(value: unknown, maxDays: number): number {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > maxDays) {
    throw new Error(`days must be a whole number between 1 and ${maxDays}`);
  }
  return days;
}

export function expirationFromDays(now: Date, value: unknown, maxDays: number): string {
  const days = requireWholeDays(value, maxDays);
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

export function extendedExpiration(
  now: Date,
  currentPeriodEnd: string | null | undefined,
  value: unknown,
  maxDays: number,
): string {
  const days = requireWholeDays(value, maxDays);
  const currentEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const base = currentEnd && Number.isFinite(currentEnd.getTime()) && currentEnd > now
    ? currentEnd
    : now;

  return new Date(base.getTime() + days * DAY_MS).toISOString();
}

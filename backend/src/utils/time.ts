export function durationToMs(value: string, fallbackMs: number): number {
  const match = value.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * (multiplier[unit] || 0) || fallbackMs;
}

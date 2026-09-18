/** A darker step of a hex colour, for sector names on their block's strip. */
export function darken(hex: string, amount = 0.38): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const f = (c: number) => Math.round(c * (1 - amount))
  const r = f((n >> 16) & 255)
  const g = f((n >> 8) & 255)
  const b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

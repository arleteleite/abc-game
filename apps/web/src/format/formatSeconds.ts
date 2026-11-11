/** 12345 ms -> "12,3 s" (vírgula decimal, como no Brasil). */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

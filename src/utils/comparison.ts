export function percentageDiff(a: number, b: number): number | null {
  if (b === 0) return null;
  return ((a - b) / b) * 100;
}

export function isWinner(
  valueA: number,
  valueB: number,
  higherIsBetter: boolean = true
): "a" | "b" | "tie" {
  if (valueA === valueB) return "tie";
  if (higherIsBetter) return valueA > valueB ? "a" : "b";
  return valueA < valueB ? "a" : "b";
}

export function showWarning(
  totalRuns: number,
  minSampleSize: number = 5
): boolean {
  return totalRuns < minSampleSize;
}

export function formatPercentageDiff(diff: number | null): string {
  if (diff === null) return "N/A";
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${diff.toFixed(1)}%`;
}

export function isSignificant(
  diff: number | null,
  threshold: number = 20
): boolean {
  if (diff === null) return false;
  return Math.abs(diff) > threshold;
}

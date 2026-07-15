import i18n from './index';

/**
 * Format a date using Intl.DateTimeFormat with the active i18n locale.
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const locale = i18n.language;
  return new Intl.DateTimeFormat(locale, options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Format a number using Intl.NumberFormat with the active i18n locale.
 */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  const locale = i18n.language;
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Format a duration in seconds as H:MM:SS or M:SS.
 * This remains locale-independent (universal timer format for gaming).
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Date and Time Utilities for MHC Staff Leave & Noticeboard
 * Optimized for timezone: Indian/Maldives (UTC+5)
 */

export const DEFAULT_TIMEZONE = 'Indian/Maldives';

/**
 * Returns the current date string in YYYY-MM-DD in the specified timezone
 */
export function getTodayString(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    // Fallback if timezone not supported
    const d = new Date();
    return d.toISOString().split('T')[0];
  }
}

/**
 * Returns tomorrow's date string in YYYY-MM-DD in the specified timezone
 */
export function getTomorrowString(timezone: string = DEFAULT_TIMEZONE): string {
  return getDateOffsetDays(1, timezone);
}

/**
 * Returns a date string with an offset in days from today (e.g. -5, 0, 1, 7)
 */
export function getDateOffsetDays(offsetDays: number, timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const now = new Date();
    const target = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(target);
  } catch {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return d.toISOString().split('T')[0];
  }
}

/**
 * Checks if a given leave range is actively in effect today (inclusive)
 */
export function isLeaveActiveToday(
  startDate: string,
  endDate: string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const today = getTodayString(timezone);
  return startDate <= today && today <= endDate;
}

/**
 * Checks if a leave record returns tomorrow
 */
export function isReturningTomorrow(
  endDate: string,
  expectedReturnDate?: string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const tomorrow = getTomorrowString(timezone);
  if (expectedReturnDate) {
    return expectedReturnDate === tomorrow;
  }
  // If no expectedReturnDate specified, if today is the endDate, they normally return tomorrow
  const today = getTodayString(timezone);
  return endDate === today;
}

/**
 * Checks if a leave is upcoming (starts strictly after today)
 */
export function isLeaveUpcoming(
  startDate: string,
  timezone: string = DEFAULT_TIMEZONE
): boolean {
  const today = getTodayString(timezone);
  return startDate > today;
}

/**
 * Formats a date string (YYYY-MM-DD) for display
 */
export function formatDate(
  dateStr: string,
  timezone?: string,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(Date.UTC(year, month, day));
  
  if (style === 'short') {
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
      timeZone: 'UTC',
    }).format(d);
  }

  if (style === 'long') {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/**
 * Formats full current date for the TV header: dd mmmm yyyy, dddd (e.g. "26 September 2026, Saturday")
 */
export function formatFullCurrentDate(
  date: Date = new Date(),
  timezone: string = DEFAULT_TIMEZONE
): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
    timeZone: timezone,
  });

  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }

  const day = partMap.day || '';
  const month = partMap.month || '';
  const year = partMap.year || '';
  const weekday = partMap.weekday || '';

  return `${day} ${month} ${year}, ${weekday}`;
}

/**
 * Formats live clock string with 24-hour format default
 */
export function formatLiveClock(
  date: Date = new Date(),
  clockFormat: '12h' | '24h' = '24h',
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (clockFormat === '12h') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(date);
  }

  // 24hr format (e.g. 14:33:41)
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date);
}

/**
 * Formats time for "Last updated"
 */
export function formatTimeAgo(timestamp: number): string {
  if (!timestamp) return 'Just now';
  const diffSecs = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSecs < 10) return 'Just now';
  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ago`;
}

/**
 * Checks if two date ranges overlap
 * Start and End are inclusive (YYYY-MM-DD)
 */
export function dateRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 <= end2 && end1 >= start2;
}

/**
 * Formats epoch timestamp into full readable Maldives date and time
 * e.g., "26 Sep 2026, 10:45:12 AM"
 */
export function formatTimestamp(
  timestamp: number,
  timezone: string = DEFAULT_TIMEZONE,
  includeSeconds: boolean = true
): string {
  if (!timestamp) return '—';
  try {
    const d = new Date(timestamp);
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(d);
  } catch {
    const d = new Date(timestamp);
    return d.toLocaleString();
  }
}

/**
 * Returns a human-friendly relative time string (e.g. "Just now", "5 mins ago", "2 hours ago", "Yesterday", "3 days ago")
 */
export function getRelativeTimeString(timestamp: number): string {
  if (!timestamp) return '—';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}


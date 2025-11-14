// frontend/src/utils/dateUtils.ts

/**
 * Format date to locale string
 */
export const formatDate = (date: string | Date): string => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date with time
 */
export const formatDateTime = (date: string | Date): string => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date to relative time (e.g., "2 days ago")
 */
export const formatRelativeDate = (date: string | Date): string => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);
    const diffYear = Math.floor(diffDay / 365);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
    return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
  } catch {
    return 'Invalid date';
  }
};

/**
 * Format date to YYYY-MM-DD for input fields
 */
export const formatDateForInput = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get date N months ago
 */
export const getDateMonthsAgo = (months: number): Date => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
};

/**
 * Validate date range
 */
export const isValidDateRange = (startDate: string, endDate: string): boolean => {
  if (!startDate || !endDate) return true; // Optional dates

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end;
  } catch {
    return false;
  }
};

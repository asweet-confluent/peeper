import type { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcBridgeApi } from '@app/main'
import { Temporal, toTemporalInstant, Intl } from '@js-temporal/polyfill'
/**
 * Formats a timestamp using relative time for recent items and absolute formatting for older ones
 * @param timestamp ISO timestamp string
 * @returns Object with formatted string and full timestamp for tooltip
 */
export function formatRelativeTime(timestamp: string): { display: string; full: string } {
  // Get user's locale and timezone
  const userLocale = navigator.language;
  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const date = Temporal.Instant.from(timestamp).toZonedDateTimeISO(userTimeZone);
  const now = Temporal.Now.zonedDateTimeISO(userTimeZone);
  // const instant = Temporal.Instant.from(timestamp);
  // const now = Temporal.Now.instant();
  const duration = now.since(date);


  // const date = zoned.toZonedDateTimeISO(userTimeZone);
  // Full timestamp for tooltip using user's locale and timezone
  const formatter = new Intl.DateTimeFormat(userLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    timeZone: userTimeZone
  });

  const full = formatter.format(date.toPlainDateTime());
  const plainNow = now.toPlainDateTime();
  
  const totalWeeks = duration.total({
    unit: 'weeks',
    relativeTo: plainNow
  });

  // For items older than 5 weeks, show the date using user's locale
  if (totalWeeks > 5) {
    const dateFormatter = new Intl.DateTimeFormat(userLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: userTimeZone
    });
    return {
      display: dateFormatter.format(date),
      full
    };
  }


  // Relative formatting for recent items
  const totalSeconds = duration.total('seconds');
  const totalMinutes = duration.total('minutes');
  const totalHours = duration.total('hours');
  const totalDays = duration.total({
    unit: 'days',
    relativeTo: plainNow
  });

  if (totalSeconds < 30) {
    return { display: 'just now', full };
  } else if (totalMinutes < 5) {
    return { display: 'a few minutes ago', full };
  } else if (totalMinutes < 60) {
    const minutes = Math.floor(totalMinutes);
    return { display: `${minutes} minutes ago`, full };
  } else if (totalHours < 24) {
    const hours = Math.floor(totalHours);
    return { display: `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`, full };
  } else if (totalDays < 7) {
    const days = Math.floor(totalDays);
    return { display: `${days} ${days === 1 ? 'day' : 'days'} ago`, full };
  } else if (totalWeeks < 5) {
    const weeks = Math.floor(totalWeeks);
    if (weeks === 1) {
      return { display: '1 week ago', full };
    } else if (weeks < 4) {
      return { display: `${weeks} weeks ago`, full };
    } else {
      return { display: '1 month ago', full };
    }
  }

  // Fallback (shouldn't reach here due to the check above)
  return { display: full.split(',')[0], full };
}

// Type definitions for renderer process (browser environment)
export interface StoredNotification {
  id: string
  thread_id: string | null
  subject_title: string
  subject_type: string
  subject_url: string | null
  repository_name: string
  repository_full_name: string
  repository_owner: string
  reason: string
  unread: number
  updated_at: string
  last_read_at: string | null
  url: string
  subscription_url: string
  created_at: string
  synced_at: string
  // Pull Request fields (only populated for PR notifications)
  pr_number: number | null
  pr_author: string | null
  pr_state: string | null
  pr_merged: number | null // SQLite boolean
  pr_draft: number | null // SQLite boolean
  pr_assignees: string | null // JSON array of usernames
  pr_requested_reviewers: string | null // JSON array of usernames
  pr_requested_teams: string | null // JSON array of team names
  pr_labels: string | null // JSON array of label names
  pr_head_ref: string | null
  pr_base_ref: string | null
  pr_head_repo: string | null // full_name
  pr_base_repo: string | null // full_name
  current_user_is_reviewer: number | null // SQLite boolean
  current_user_team_is_reviewer: number | null // SQLite boolean
  done: number | null // SQLite boolean for marking items as "done"
}

export interface Inbox {
  id?: number
  name: string
  filter_expression: string | null
  desktop_notifications: number | boolean
  created_at?: string
  updated_at?: string
}

export interface QuickFilterConfig {
  id?: number
  inbox_id: number
  hide_read: boolean | number
  hide_merged_prs: boolean | number
  hide_drafts: boolean | number
  hide_done: boolean | number
  created_at?: string
  updated_at?: string
}

export interface FilterTemplate {
  name: string
  expression: string
  description: string
}

export interface AutocompleteItem {
  text: string
  type: 'field' | 'operator' | 'value' | 'function' | 'keyword' | 'username'
  description?: string
  insertText?: string
}

export interface SyncResult {
  success: boolean
  newCount?: number
  pollInterval?: number
  error?: string
  syncTime?: string // Added to support immediate sync time updates
}

export interface PaginatedNotificationsResult {
  notifications: StoredNotification[]
  totalCount: number
  hasMore: boolean
}

export interface TokenTestResult {
  success: boolean
  user?: any
  error?: string
}

export interface Preferences {
  autoSyncEnabled: boolean
  autoSyncIntervalSeconds: number
  showDesktopNotifications: boolean
  soundEnabled: boolean
}

declare global {
  interface Date {
    toTemporalInstant: typeof toTemporalInstant
  }
  interface Window {
    electron: ElectronAPI
    api: IpcBridgeApi
  }
}

Date.prototype.toTemporalInstant = toTemporalInstant;
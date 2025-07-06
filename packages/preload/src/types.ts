import type { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcBridgeApi } from '@app/main'

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
  interface Window {
    electron: ElectronAPI
    api: IpcBridgeApi
  }
}

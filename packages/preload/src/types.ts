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
  pr_number?: number
  pr_author?: string
  pr_state?: string
  pr_merged?: number // SQLite boolean
  pr_draft?: number // SQLite boolean
  pr_assignees?: string // JSON array of usernames
  pr_requested_reviewers?: string // JSON array of usernames
  pr_requested_teams?: string // JSON array of team names
  pr_labels?: string // JSON array of label names
  pr_head_ref?: string
  pr_base_ref?: string
  pr_head_repo?: string // full_name
  pr_base_repo?: string // full_name
  current_user_is_reviewer?: number // SQLite boolean
  current_user_team_is_reviewer?: number // SQLite boolean
}

export interface Inbox {
  id?: number
  name: string
  filter_expression: string
  desktop_notifications: number | boolean
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

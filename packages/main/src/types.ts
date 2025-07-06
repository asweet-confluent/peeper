import { toTemporalInstant } from '@js-temporal/polyfill';

export interface GitHubNotification {
  id: string
  unread: boolean
  reason: string
  updated_at: string
  last_read_at: string | null
  subject: {
    title: string
    url?: string
    latest_comment_url?: string
    type: 'PullRequest' | 'Issue' | 'Release' | 'RepositoryVulnerabilityAlert' | string
  }
  repository: {
    id: number
    node_id: string
    name: string
    full_name: string
    private: boolean
    owner: {
      login: string
      id: number
      node_id: string
      avatar_url: string
      gravatar_id: string
      url: string
      html_url: string
      type: string
      site_admin: boolean
    }
    html_url: string
    description: string | null
    fork: boolean
    url: string
  }
  url: string
  subscription_url: string
}

export interface PullRequestDetails {
  number: number
  title: string
  state: 'open' | 'closed' | 'merged'
  merged: boolean
  draft: boolean
  user: {
    login: string
    id: number
    type: string
  }
  assignees: Array<{
    login: string
    id: number
  }>
  requested_reviewers: Array<{
    login: string
    id: number
  }>
  requested_teams: Array<{
    name: string
    slug: string
    id: number
  }>
  head: {
    ref: string
    sha: string
    repo: {
      name: string
      full_name: string
      owner: {
        login: string
      }
    } | null
  }
  base: {
    ref: string
    sha: string
    repo: {
      name: string
      full_name: string
      owner: {
        login: string
      }
    }
  }
  created_at: string
  updated_at: string
  closed_at: string | null
  merged_at: string | null
  labels: Array<{
    name: string
    color: string
  }>
}

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
  unread: number // SQLite stores booleans as integers
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
  desktop_notifications: number | boolean // SQLite stores booleans as integers
  created_at?: string
  updated_at?: string
}

export interface SyncResult {
  success: boolean
  syncTime?: string // ISO string
  newCount?: number
  error?: string
}

export interface TokenTestResult {
  success: boolean
  user?: any
  error?: string
}

export interface NotificationFetchResult {
  notifications: GitHubNotification[]
  notModified: boolean
}

export interface FilterContext {
  id: string
  subject_title: string
  subject_type: string
  repository_name: string
  repository_full_name: string
  repository_owner: string
  reason: string
  unread: boolean
  updated_at: string
  // Pull Request fields
  pr_number?: number
  pr_author?: string
  pr_state?: string
  pr_merged?: boolean
  pr_draft?: boolean
  pr_assignees?: string[]
  pr_requested_reviewers?: string[]
  pr_requested_teams?: string[]
  pr_labels?: string[]
  pr_head_ref?: string
  pr_base_ref?: string
  pr_head_repo?: string
  pr_base_repo?: string
  current_user_is_reviewer?: boolean
  current_user_team_is_reviewer?: boolean
  contains: (field: string, value: string) => boolean
  equals: (field: string, value: string) => boolean
  startsWith: (field: string, value: string) => boolean
  endsWith: (field: string, value: string) => boolean
  matches: (field: string, regex: string) => boolean
  includes: (array: string[], value: string) => boolean
}

export interface FilterTemplate {
  name: string
  expression: string
}

export interface Preferences {
  autoSyncEnabled: boolean
  autoSyncIntervalSeconds: number // in seconds
  showDesktopNotifications: boolean
  soundEnabled: boolean
}

declare global {
  interface Date {
    toTemporalInstant: typeof toTemporalInstant
  }
}

Date.prototype.toTemporalInstant = toTemporalInstant;


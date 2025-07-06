import type { ColumnType, Generated, Insertable, JSONColumnType, Selectable, Updateable } from 'kysely'

export interface Database {
  config: ConfigTable
  notifications: NotificationTable
  inboxes: InboxTable
  quick_filter_configs: QuickFilterConfigTable
  user_profiles: UserProfileTable
}

export interface ConfigTable {
  key: string
  value: string
}

export interface NotificationTable {
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
  created_at: ColumnType<string, string | undefined, never>
  synced_at: ColumnType<string, string | undefined, string>
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

export interface InboxTable {
  id: Generated<number>
  name: string
  filter_expression: string | null
  desktop_notifications: number // SQLite stores booleans as integers
  created_at: ColumnType<string, string | undefined, never>
  updated_at: ColumnType<string, string | undefined, string>
}

export interface QuickFilterConfigTable {
  id: Generated<number>
  inbox_id: number
  hide_read: number // SQLite stores booleans as integers  
  hide_merged_prs: number // SQLite stores booleans as integers
  hide_drafts: number // SQLite stores booleans as integers
  hide_done: number // SQLite stores booleans as integers
  created_at: ColumnType<string, string | undefined, never>
  updated_at: ColumnType<string, string | undefined, string>
}

export interface UserProfileTable {
  username: string // Primary key
  login: string
  avatar_url: string
  name: string | null
  bio: string | null
  cached_at: string // ISO timestamp when cached
}

// Type helpers for better type safety
export type Config = Selectable<ConfigTable>
export type NewConfig = Insertable<ConfigTable>
export type ConfigUpdate = Updateable<ConfigTable>

export type Notification = Selectable<NotificationTable>
export type NewNotification = Insertable<NotificationTable>
export type NotificationUpdate = Updateable<NotificationTable>

export type Inbox = Selectable<InboxTable>
export type NewInbox = Insertable<InboxTable>
export type InboxUpdate = Updateable<InboxTable>

export type UserProfile = Selectable<UserProfileTable>
export type NewUserProfile = Insertable<UserProfileTable>
export type UserProfileUpdate = Updateable<UserProfileTable>

export type QuickFilterConfig = Selectable<QuickFilterConfigTable>
export type NewQuickFilterConfig = Insertable<QuickFilterConfigTable>
export type QuickFilterConfigUpdate = Updateable<QuickFilterConfigTable>

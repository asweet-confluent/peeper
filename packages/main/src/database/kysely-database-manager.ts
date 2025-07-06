import type { GitHubNotification, PullRequestDetails, StoredNotification, Preferences } from '../types.js'
import type { Database as KyselyDatabase, NewNotification, NewInbox, NewConfig, NewUserProfile, UserProfile, QuickFilterConfig, NewQuickFilterConfig, QuickFilterConfigUpdate } from './schema.js'
import { Kysely, SqliteDialect, sql } from 'kysely'
import BetterSqlite3 from 'better-sqlite3'
import * as path from 'node:path'
import CryptoJS from 'crypto-js'
import { app } from 'electron'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'
import { Temporal } from '@js-temporal/polyfill'
import { filterService } from './filter-service.js'

// Common interfaces for database operations
interface InboxRecord {
  id: number
  name: string
  filter_expression: string | null
  desktop_notifications: number
  created_at: string
  updated_at: string
}

interface QueryResult {
  id?: number
  changes?: number
}

interface InboxInput {
  id?: number
  name: string
  filter_expression?: string
  desktop_notifications?: boolean | number
}

interface UserInfo {
  login: string
  id: number
}

interface SaveNotificationParams {
  notification: GitHubNotification
  prDetails: PullRequestDetails | null
  currentUser: UserInfo | null
  userTeams: string[]
}

export class KyselyDatabaseManager {
  private dbPath: string
  private db: Kysely<KyselyDatabase> | null = null
  private encryptionKey: string = 'peeper-secret-key' // In production, this should be more secure
  private readonly USER_PROFILE_CACHE_TTL = Temporal.Duration.from({hours: 24 * 30})

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'peeper-notifications.db')
  }

  async initialize(): Promise<void> {
    const sqlite = new BetterSqlite3(this.dbPath)
    // Enable WAL mode for better concurrency
    sqlite.pragma('journal_mode = WAL')
    
    this.db = new Kysely<KyselyDatabase>({
      dialect: new SqliteDialect({
        database: sqlite,
      }),
    })

    await this.createTables()
  }

  private async createTables(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Create config table
    await this.db.schema
      .createTable('config')
      .ifNotExists()
      .addColumn('key', 'text', (col) => col.primaryKey())
      .addColumn('value', 'text')
      .execute()

    // Create notifications table
    await this.db.schema
      .createTable('notifications')
      .ifNotExists()
      .addColumn('id', 'text', (col) => col.primaryKey())
      .addColumn('thread_id', 'text')
      .addColumn('subject_title', 'text', (col) => col.notNull())
      .addColumn('subject_type', 'text', (col) => col.notNull())
      .addColumn('subject_url', 'text')
      .addColumn('repository_name', 'text', (col) => col.notNull())
      .addColumn('repository_full_name', 'text', (col) => col.notNull())
      .addColumn('repository_owner', 'text', (col) => col.notNull())
      .addColumn('reason', 'text', (col) => col.notNull())
      .addColumn('unread', 'integer', (col) => col.notNull())
      .addColumn('updated_at', 'text', (col) => col.notNull())
      .addColumn('last_read_at', 'text')
      .addColumn('url', 'text', (col) => col.notNull())
      .addColumn('subscription_url', 'text', (col) => col.notNull())
      .addColumn('created_at', 'text', (col) => col.defaultTo('CURRENT_TIMESTAMP').notNull())
      .addColumn('synced_at', 'text', (col) => col.defaultTo('CURRENT_TIMESTAMP').notNull())
      .addColumn('pr_number', 'integer')
      .addColumn('pr_author', 'text')
      .addColumn('pr_state', 'text')
      .addColumn('pr_merged', 'integer')
      .addColumn('pr_draft', 'integer')
      .addColumn('pr_assignees', 'text')
      .addColumn('pr_requested_reviewers', 'text')
      .addColumn('pr_requested_teams', 'text')
      .addColumn('pr_labels', 'text')
      .addColumn('pr_head_ref', 'text')
      .addColumn('pr_base_ref', 'text')
      .addColumn('pr_head_repo', 'text')
      .addColumn('pr_base_repo', 'text')
      .addColumn('current_user_is_reviewer', 'integer')
      .addColumn('current_user_team_is_reviewer', 'integer')
      .execute()

    // Create inboxes table
    await this.db.schema
      .createTable('inboxes')
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('name', 'text', (col) => col.notNull())
      .addColumn('filter_expression', 'text')
      .addColumn('desktop_notifications', 'integer', (col) => col.defaultTo(0))
      .addColumn('created_at', 'text', (col) => col.defaultTo('CURRENT_TIMESTAMP').notNull())
      .addColumn('updated_at', 'text', (col) => col.defaultTo('CURRENT_TIMESTAMP').notNull())
      .execute()

    // Create user_profiles table
    await this.db.schema
      .createTable('user_profiles')
      .ifNotExists()
      .addColumn('username', 'text', (col) => col.primaryKey())
      .addColumn('login', 'text', (col) => col.notNull())
      .addColumn('avatar_url', 'text', (col) => col.notNull())
      .addColumn('name', 'text')
      .addColumn('bio', 'text')
      .addColumn('cached_at', 'text', (col) => col.notNull())
      .execute()

    // Create quick_filter_configs table
    await this.db.schema
      .createTable('quick_filter_configs')
      .ifNotExists()
      .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
      .addColumn('inbox_id', 'integer', (col) => col.notNull().references('inboxes.id').onDelete('cascade'))
      .addColumn('hide_read', 'integer', (col) => col.defaultTo(0).notNull())
      .addColumn('hide_merged_prs', 'integer', (col) => col.defaultTo(1).notNull())
      .addColumn('hide_drafts', 'integer', (col) => col.defaultTo(1).notNull())
      .addColumn('hide_done', 'integer', (col) => col.defaultTo(1).notNull())
      .addColumn('created_at', 'text', (col) => col.defaultTo('CURRENT_TIMESTAMP').notNull())
      .addColumn('updated_at', 'text', (col) => col.defaultTo('CURRENT_TIMESTAMP').notNull())
      .execute()

    // Create indexes
    await this.createIndexes()

    // Run migrations for existing databases
    await this.runMigrations()

    // Create default inbox if none exist
    const inboxCount = await this.db
      .selectFrom('inboxes')
      .select(sql<number>`count(*)`.as('count'))
      .executeTakeFirst()

    if (inboxCount && inboxCount.count === 0) {
      await this.createInbox({
        name: 'All Notifications',
        filter_expression: 'true',
        desktop_notifications: 1,
      })
    }
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const indexes = [
      { name: 'idx_notifications_unread', table: 'notifications', column: 'unread' },
      { name: 'idx_notifications_repository', table: 'notifications', column: 'repository_full_name' },
      { name: 'idx_notifications_updated_at', table: 'notifications', column: 'updated_at' },
      { name: 'idx_notifications_pr_author', table: 'notifications', column: 'pr_author' },
      { name: 'idx_notifications_pr_state', table: 'notifications', column: 'pr_state' },
      { name: 'idx_notifications_current_user_reviewer', table: 'notifications', column: 'current_user_is_reviewer' },
      { name: 'idx_user_profiles_cached_at', table: 'user_profiles', column: 'cached_at' },
      { name: 'idx_quick_filter_configs_inbox_id', table: 'quick_filter_configs', column: 'inbox_id' },
    ]

    for (const index of indexes) {
      try {
        await this.db.schema
          .createIndex(index.name)
          .ifNotExists()
          .on(index.table)
          .column(index.column)
          .execute()
      } catch (error) {
        // Index might already exist, ignore errors
        console.warn(`Failed to create index ${index.name}:`, error)
      }
    }
  }

  async saveToken(token: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const encrypted = CryptoJS.AES.encrypt(token, this.encryptionKey).toString()
    
    await this.db
      .insertInto('config')
      .values({ key: 'github_token', value: encrypted })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value: encrypted }))
      .execute()

    return true
  }

  async getToken(): Promise<string | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result = await this.db
      .selectFrom('config')
      .select('value')
      .where('key', '=', 'github_token')
      .executeTakeFirst()

    if (!result) {
      return null
    }

    try {
      const decrypted = CryptoJS.AES.decrypt(result.value, this.encryptionKey)
      return decrypted.toString(CryptoJS.enc.Utf8)
    } catch (error) {
      console.error('Error decrypting token:', error)
      return null
    }
  }

  async saveLastModified(lastModified: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .insertInto('config')
      .values({ key: 'last_modified', value: lastModified })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value: lastModified }))
      .execute()
  }

  async getLastModified(): Promise<string | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result = await this.db
      .selectFrom('config')
      .select('value')
      .where('key', '=', 'last_modified')
      .executeTakeFirst()

    return result?.value || null
  }

  async saveLastSyncTime(timestamp: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .insertInto('config')
      .values({ key: 'last_sync_time', value: timestamp })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value: timestamp }))
      .execute()
  }

  async getLastSyncTime(): Promise<string | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result = await this.db
      .selectFrom('config')
      .select('value')
      .where('key', '=', 'last_sync_time')
      .executeTakeFirst()

    return result?.value || null
  }

  async saveNotifications(notifications: GitHubNotification[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db.transaction().execute(async (trx) => {
      for (const notification of notifications) {
        const newNotification: NewNotification = {
          id: notification.id,
          thread_id: notification.subject?.url || null,
          subject_title: notification.subject?.title || '',
          subject_type: notification.subject?.type || '',
          subject_url: notification.subject?.url || null,
          repository_name: notification.repository?.name || '',
          repository_full_name: notification.repository?.full_name || '',
          repository_owner: notification.repository?.owner?.login || '',
          reason: notification.reason || '',
          unread: notification.unread ? 1 : 0,
          updated_at: notification.updated_at || '',
          last_read_at: notification.last_read_at || null,
          url: notification.url || '',
          subscription_url: notification.subscription_url || '',
          synced_at: new Date().toISOString(),
        }

        await trx
          .insertInto('notifications')
          .values(newNotification)
          .onConflict((oc) => oc.column('id').doUpdateSet(newNotification))
          .execute()
      }
    })
  }

  async saveNotificationWithPRDetails(
    notification: GitHubNotification,
    prDetails: PullRequestDetails | null,
    currentUser: UserInfo | null,
    userTeams: string[],
  ): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    let isCurrentUserReviewer = false
    let isCurrentUserTeamReviewer = false

    if (prDetails && currentUser) {
      // Check if current user is in requested reviewers
      isCurrentUserReviewer = prDetails.requested_reviewers?.some(
        (reviewer: any) => reviewer.login === currentUser.login,
      ) || false

      // Check if any of user's teams are in requested teams
      if (userTeams.length > 0 && prDetails.requested_teams) {
        isCurrentUserTeamReviewer = prDetails.requested_teams.some(
          (team: any) => userTeams.includes(team.slug),
        )
      }
    }

    const newNotification: NewNotification = {
      id: notification.id,
      thread_id: notification.subject?.url || null,
      subject_title: notification.subject?.title || '',
      subject_type: notification.subject?.type || '',
      subject_url: notification.subject?.url || null,
      repository_name: notification.repository?.name || '',
      repository_full_name: notification.repository?.full_name || '',
      repository_owner: notification.repository?.owner?.login || '',
      reason: notification.reason || '',
      unread: notification.unread ? 1 : 0,
      updated_at: notification.updated_at || '',
      last_read_at: notification.last_read_at || null,
      url: notification.url || '',
      subscription_url: notification.subscription_url || '',
      synced_at: new Date().toISOString(),
      // PR fields
      pr_number: prDetails?.number || null,
      pr_author: prDetails?.user?.login || null,
      pr_state: prDetails?.state || null,
      pr_merged: prDetails?.merged ? 1 : 0,
      pr_draft: prDetails?.draft ? 1 : 0,
      pr_assignees: prDetails?.assignees ? JSON.stringify(prDetails.assignees.map((a: any) => a.login)) : null,
      pr_requested_reviewers: prDetails?.requested_reviewers ? JSON.stringify(prDetails.requested_reviewers.map((r: any) => r.login)) : null,
      pr_requested_teams: prDetails?.requested_teams ? JSON.stringify(prDetails.requested_teams.map((t: any) => t.slug)) : null,
      pr_labels: prDetails?.labels ? JSON.stringify(prDetails.labels.map((l: any) => l.name)) : null,
      pr_head_ref: prDetails?.head?.ref || null,
      pr_base_ref: prDetails?.base?.ref || null,
      pr_head_repo: prDetails?.head?.repo?.full_name || null,
      pr_base_repo: prDetails?.base?.repo?.full_name || null,
      current_user_is_reviewer: isCurrentUserReviewer ? 1 : 0,
      current_user_team_is_reviewer: isCurrentUserTeamReviewer ? 1 : 0,
    }

    await this.db
      .insertInto('notifications')
      .values(newNotification)
      .onConflict((oc) => oc.column('id').doUpdateSet(newNotification))
      .execute()
  }

  async getNotificationsPaginated(page: number = 0, pageSize: number = 50): Promise<{ notifications: StoredNotification[], totalCount: number, hasMore: boolean }> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Get total count
    const countResult = await this.db
      .selectFrom('notifications')
      .select(sql<number>`count(*)`.as('total'))
      .executeTakeFirst()
    
    const totalCount = countResult?.total || 0
    const offset = page * pageSize
    const hasMore = offset + pageSize < totalCount

    // Get paginated notifications
    const notifications = await this.db
      .selectFrom('notifications')
      .selectAll()
      .orderBy('updated_at', 'desc')
      .limit(pageSize)
      .offset(offset)
      .execute()

    return {
      notifications,
      totalCount,
      hasMore
    }
  }

  async getFilteredNotificationsPaginated(
    filterExpression: string, 
    quickFilterConfig: QuickFilterConfig | null = null,
    page: number = 0, 
    pageSize: number = 50
  ): Promise<{ notifications: StoredNotification[], totalCount: number, hasMore: boolean }> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    // Create base query
    let query = this.db
      .selectFrom('notifications')
      .selectAll()

    // Apply quick filters first
    if (quickFilterConfig) {
      if (quickFilterConfig.hide_read) {
        query = query.where('unread', '=', 1)
      }
      if (quickFilterConfig.hide_merged_prs) {
        query = query.where((eb) => eb.or([
          eb('subject_type', '!=', 'PullRequest'),
          eb('pr_merged', '!=', 1)
        ]))
      }
      if (quickFilterConfig.hide_drafts) {
        query = query.where((eb) => eb.or([
          eb('subject_type', '!=', 'PullRequest'),
          eb('pr_draft', '!=', 1)
        ]))
      }
      if (quickFilterConfig.hide_done) {
        query = query.where((eb) => eb.or([
          eb('done', 'is', null),
          eb('done', '!=', 1)
        ]))
      }
    }

    // Apply filter expression if provided
    if (filterExpression && filterExpression.trim() !== '' && filterExpression.trim() !== 'true') {
      try {
        query = filterService.applyFilterExpression(query, filterExpression)
      } catch (error) {
        console.error('Filter application error:', error)
        throw new Error(`Invalid filter expression: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Get total count with filter applied
    const countQuery = query
      .clearSelect()
      .select(sql<number>`count(*)`.as('total'))
    
    const countResult = await countQuery.executeTakeFirst()
    const totalCount = countResult?.total || 0
    
    // Calculate pagination
    const offset = page * pageSize
    const hasMore = offset + pageSize < totalCount

    // Get paginated notifications with filter applied
    const notifications = await query
      .orderBy('updated_at', 'desc')
      .limit(pageSize)
      .offset(offset)
      .execute()

    return {
      notifications,
      totalCount,
      hasMore
    }
  }

  async getUnreadCount(): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result = await this.db
      .selectFrom('notifications')
      .select(sql<number>`count(*)`.as('count'))
      .where('unread', '=', 1)
      .executeTakeFirst()

    return result?.count || 0
  }

  async markAsRead(notificationId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .updateTable('notifications')
      .set({ unread: 0 })
      .where('id', '=', notificationId)
      .execute()
  }

  async markAsUnread(notificationId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .updateTable('notifications')
      .set({ unread: 1 })
      .where('id', '=', notificationId)
      .execute()
  }

  async markAsDone(notificationId: string): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .updateTable('notifications')
      .set({ done: 1 })
      .where('id', '=', notificationId)
      .execute()
  }

  async createInbox(inbox: Omit<NewInbox, 'id'>): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result =    await this.db
      .insertInto('inboxes')
      .values({
        name: inbox.name,
        filter_expression: inbox.filter_expression || undefined,
        desktop_notifications: typeof inbox.desktop_notifications === 'boolean' 
          ? (inbox.desktop_notifications ? 1 : 0) 
          : inbox.desktop_notifications,
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    return result.id
  }

  async updateInbox(inbox: InboxInput & { id: number }): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .updateTable('inboxes')
      .set({
        name: inbox.name,
        filter_expression: inbox.filter_expression || undefined,
        desktop_notifications: typeof inbox.desktop_notifications === 'boolean' 
          ? (inbox.desktop_notifications ? 1 : 0) 
          : inbox.desktop_notifications,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', inbox.id)
      .execute()
  }

  async deleteInbox(id: number): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .deleteFrom('inboxes')
      .where('id', '=', id)
      .execute()
  }

  async getInboxes(): Promise<InboxRecord[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    return await this.db
      .selectFrom('inboxes')
      .selectAll()
      .orderBy('created_at', 'asc')
      .execute()
  }

  async getInbox(id: number): Promise<InboxRecord | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result = await this.db
      .selectFrom('inboxes')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst()

    return result || null
  }

  // Quick Filter Configuration methods
  async getQuickFilterConfig(inboxId: number): Promise<QuickFilterConfig | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result = await this.db
      .selectFrom('quick_filter_configs')
      .selectAll()
      .where('inbox_id', '=', inboxId)
      .executeTakeFirst()

    return result || null
  }

  async createQuickFilterConfig(config: NewQuickFilterConfig): Promise<number> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const result = await this.db
      .insertInto('quick_filter_configs')
      .values({
        inbox_id: config.inbox_id,
        hide_read: typeof config.hide_read === 'boolean' ? (config.hide_read ? 1 : 0) : config.hide_read,
        hide_merged_prs: typeof config.hide_merged_prs === 'boolean' ? (config.hide_merged_prs ? 1 : 0) : config.hide_merged_prs,
        hide_drafts: typeof config.hide_drafts === 'boolean' ? (config.hide_drafts ? 1 : 0) : config.hide_drafts,
        hide_done: typeof config.hide_done === 'boolean' ? (config.hide_done ? 1 : 0) : config.hide_done,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning('id')
      .executeTakeFirstOrThrow()

    return result.id
  }

  async updateQuickFilterConfig(inboxId: number, config: QuickFilterConfigUpdate): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    await this.db
      .updateTable('quick_filter_configs')
      .set({
        hide_read: typeof config.hide_read === 'boolean' ? (config.hide_read ? 1 : 0) : config.hide_read,
        hide_merged_prs: typeof config.hide_merged_prs === 'boolean' ? (config.hide_merged_prs ? 1 : 0) : config.hide_merged_prs,
        hide_drafts: typeof config.hide_drafts === 'boolean' ? (config.hide_drafts ? 1 : 0) : config.hide_drafts,
        hide_done: typeof config.hide_done === 'boolean' ? (config.hide_done ? 1 : 0) : config.hide_done,
        updated_at: new Date().toISOString(),
      })
      .where('inbox_id', '=', inboxId)
      .execute()
  }

  async getOrCreateQuickFilterConfig(inboxId: number): Promise<QuickFilterConfig> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    let config = await this.getQuickFilterConfig(inboxId)
    
    if (!config) {
      // Create default quick filter config
      const configId = await this.createQuickFilterConfig({
        inbox_id: inboxId,
        hide_read: 0, // Default to false - show read notifications
        hide_merged_prs: 1, // Default to true  
        hide_drafts: 1, // Default to true
        hide_done: 1, // Default to true
      })
      
      config = await this.getQuickFilterConfig(inboxId)
      if (!config) {
        throw new Error('Failed to create quick filter config')
      }
    }
    
    return config
  }

  close(): void {
    if (this.db) {
      this.db.destroy()
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      // Check if PR columns exist by trying to select them
      // This is a simple way to check for existing columns in SQLite
      try {
        await this.db
          .selectFrom('notifications')
          .select(['pr_number', 'current_user_is_reviewer'])
          .limit(1)
          .execute()
        // If no error, columns exist
      } catch (error) {
        // Columns don't exist, add them
        console.log('Adding PR columns to notifications table...')
        
        const prColumns = [
          'pr_number INTEGER',
          'pr_author TEXT',
          'pr_state TEXT',
          'pr_merged INTEGER',
          'pr_draft INTEGER',
          'pr_assignees TEXT',
          'pr_requested_reviewers TEXT',
          'pr_requested_teams TEXT',
          'pr_labels TEXT',
          'pr_head_ref TEXT',
          'pr_base_ref TEXT',
          'pr_head_repo TEXT',
          'pr_base_repo TEXT',
          'current_user_is_reviewer INTEGER',
          'current_user_team_is_reviewer INTEGER',
        ]

        for (const column of prColumns) {
          try {
            await sql`ALTER TABLE notifications ADD COLUMN ${sql.raw(column)}`.execute(this.db)
          } catch (columnError) {
            console.warn(`Failed to add column ${column}:`, columnError)
          }
        }
      }

      // Check if done column exists by trying to select it
      try {
        await this.db
          .selectFrom('notifications')
          .select('done')
          .limit(1)
          .execute()
        // If no error, column exists
      } catch (error) {
        // Column doesn't exist, add it
        console.log('Adding done column to notifications table...')
        try {
          await sql`ALTER TABLE notifications ADD COLUMN done INTEGER DEFAULT 0`.execute(this.db)
        } catch (columnError) {
          console.warn('Failed to add done column:', columnError)
        }
      }

      // Check if hide_done column exists in quick_filter_configs
      try {
        await this.db
          .selectFrom('quick_filter_configs')
          .select('hide_done')
          .limit(1)
          .execute()
        // If no error, column exists
      } catch (error) {
        // Column doesn't exist, add it
        console.log('Adding hide_done column to quick_filter_configs table...')
        try {
          await sql`ALTER TABLE quick_filter_configs ADD COLUMN hide_done INTEGER DEFAULT 1`.execute(this.db)
        } catch (columnError) {
          console.warn('Failed to add hide_done column:', columnError)
        }
      }

      // Check if user_profiles table exists and create it if it doesn't
      await this.createUserProfilesTableIfNotExists()
    } catch (error) {
      console.error('Migration error:', error)
      // Don't fail if migrations have issues, table might be new
    }
  }

  private async createUserProfilesTableIfNotExists(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      // Check if user_profiles table exists by trying to select from it
      await this.db
        .selectFrom('user_profiles')
        .select('username')
        .limit(1)
        .execute()
      // If no error, table exists
    } catch (error) {
      // Table doesn't exist, create it
      console.log('Creating user_profiles table...')
      
      try {
        await this.db.schema
          .createTable('user_profiles')
          .addColumn('username', 'text', (col) => col.primaryKey())
          .addColumn('login', 'text', (col) => col.notNull())
          .addColumn('avatar_url', 'text', (col) => col.notNull())
          .addColumn('name', 'text')
          .addColumn('bio', 'text')
          .addColumn('cached_at', 'text', (col) => col.notNull())
          .execute()

        // Create index for cached_at column
        await this.db.schema
          .createIndex('idx_user_profiles_cached_at')
          .on('user_profiles')
          .column('cached_at')
          .execute()

        console.log('Successfully created user_profiles table')
      } catch (createError) {
        console.error('Failed to create user_profiles table:', createError)
      }
    }
  }

  async getUniqueUsernames(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const usernames = new Set<string>()

      // Get unique usernames from PR authors
      const authors = await this.db
        .selectFrom('notifications')
        .select('pr_author')
        .where('pr_author', 'is not', null)
        .where('pr_author', '!=', '')
        .distinct()
        .execute()

      authors.forEach((row) => {
        if (row.pr_author) usernames.add(row.pr_author)
      })

      // Get usernames from PR assignees (JSON arrays)
      const assignees = await this.db
        .selectFrom('notifications')
        .select('pr_assignees')
        .where('pr_assignees', 'is not', null)
        .where('pr_assignees', '!=', '')
        .distinct()
        .execute()

      assignees.forEach((row) => {
        if (row.pr_assignees) {
          try {
            const assigneeList = JSON.parse(row.pr_assignees)
            assigneeList.forEach((username: string) => usernames.add(username))
          } catch {
            // Ignore JSON parse errors
          }
        }
      })

      // Get usernames from PR reviewers (JSON arrays)
      const reviewers = await this.db
        .selectFrom('notifications')
        .select('pr_requested_reviewers')
        .where('pr_requested_reviewers', 'is not', null)
        .where('pr_requested_reviewers', '!=', '')
        .distinct()
        .execute()

      reviewers.forEach((row) => {
        if (row.pr_requested_reviewers) {
          try {
            const reviewerList = JSON.parse(row.pr_requested_reviewers)
            reviewerList.forEach((username: string) => usernames.add(username))
          } catch {
            // Ignore JSON parse errors
          }
        }
      })

      return Array.from(usernames).sort()
    } catch (error) {
      console.error('Error getting unique usernames from notifications:', error)
      return []
    }
  }

  async getPreferences(): Promise<Preferences> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const prefs = await this.db
      .selectFrom('config')
      .select(['key', 'value'])
      .where('key', 'like', 'pref_%')
      .execute()

    const preferences: Preferences = {
      autoSyncEnabled: true,
      autoSyncIntervalSeconds: 60, // 1 minute default
      showDesktopNotifications: true,
      soundEnabled: false,
    }

    prefs.forEach((pref) => {
      switch (pref.key) {
        case 'pref_auto_sync_enabled':
          preferences.autoSyncEnabled = pref.value === 'true'
          break
        case 'pref_auto_sync_interval_seconds':
          preferences.autoSyncIntervalSeconds = Number.parseInt(pref.value) || 60
          break
        case 'pref_show_desktop_notifications':
          preferences.showDesktopNotifications = pref.value === 'true'
          break
        case 'pref_sound_enabled':
          preferences.soundEnabled = pref.value === 'true'
          break
      }
    })

    return preferences
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const prefMap = {
      pref_auto_sync_enabled: preferences.autoSyncEnabled.toString(),
      pref_auto_sync_interval_seconds: preferences.autoSyncIntervalSeconds.toString(),
      pref_show_desktop_notifications: preferences.showDesktopNotifications.toString(),
      pref_sound_enabled: preferences.soundEnabled.toString(),
    }

    await this.db.transaction().execute(async (trx) => {
      for (const [key, value] of Object.entries(prefMap)) {
        await trx
          .insertInto('config')
          .values({ key, value })
          .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
          .execute()
      }
    })
  }

  // Compatibility methods for the original DatabaseManager interface
  // These are deprecated and should not be used with the Kysely implementation
  async runQuery(_sql: string, _params: any[] = []): Promise<QueryResult> {
    throw new Error('runQuery is deprecated in KyselyDatabaseManager. Use Kysely query methods instead.')
  }

  async getQuery(_sql: string, _params: any[] = []): Promise<any> {
    throw new Error('getQuery is deprecated in KyselyDatabaseManager. Use Kysely query methods instead.')
  }

  async allQuery(_sql: string, _params: any[] = []): Promise<any[]> {
    throw new Error('allQuery is deprecated in KyselyDatabaseManager. Use Kysely query methods instead.')
  }

  // User Profile caching methods
  async getUserProfile(username: string): Promise<UserProfile | null> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const profile = await this.db
        .selectFrom('user_profiles')
        .selectAll()
        .where('username', '=', username)
        .executeTakeFirst()

      if (!profile) {
        return null
      }

      // Check if profile has expired
      const expiresAt = Temporal.Instant.from(profile.cached_at).add(this.USER_PROFILE_CACHE_TTL)
      const now = Temporal.Now.instant()

      if (Temporal.Instant.compare(now, expiresAt) > 0) {
        // Profile has expired, remove it and return null
        await this.db
          .deleteFrom('user_profiles')
          .where('username', '=', username)
          .execute()
        return null
      }

      return profile
    } catch (error) {
      console.error('Error fetching user profile from cache:', error)
      return null
    }
  }

  async saveUserProfile(profile: {
    username: string
    login: string
    avatar_url: string
    name?: string
    bio?: string
  }): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const now = new Date()

      const userProfile: NewUserProfile = {
        username: profile.username,
        login: profile.login,
        avatar_url: profile.avatar_url,
        name: profile.name || null,
        bio: profile.bio || null,
        cached_at: now.toISOString(),
      }

      await this.db
        .insertInto('user_profiles')
        .values(userProfile)
        .onConflict((oc) => oc.column('username').doUpdateSet({
          login: userProfile.login,
          avatar_url: userProfile.avatar_url,
          name: userProfile.name,
          bio: userProfile.bio,
          cached_at: userProfile.cached_at,
        }))
        .execute()
    } catch (error) {
      console.error('Error saving user profile to cache:', error)
      throw error
    }
  }

  async cleanupExpiredUserProfiles(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const cutoffTime = Temporal.Now.instant().subtract(this.USER_PROFILE_CACHE_TTL)

      const result = await this.db
        .deleteFrom('user_profiles')
        .where('cached_at', '<=', cutoffTime.toString())
        .execute()

      console.log(`Cleaned up ${result.length} expired user profiles`)
    } catch (error) {
      console.error('Error cleaning up expired user profiles:', error)
    }
  }

  async getUserProfileCacheStats(): Promise<{ total: number, expired: number }> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const now = new Date()
      const cutoffTime = Temporal.Now.instant().subtract(this.USER_PROFILE_CACHE_TTL)
      
      const [totalResult, expiredResult] = await Promise.all([
        this.db
          .selectFrom('user_profiles')
          .select(sql<number>`count(*)`.as('count'))
          .executeTakeFirst(),
        this.db
          .selectFrom('user_profiles')
          .select(sql<number>`count(*)`.as('count'))
          .where('cached_at', '<=', cutoffTime.toJSON())
          .executeTakeFirst()
      ])

      return {
        total: totalResult?.count || 0,
        expired: expiredResult?.count || 0,
      }
    } catch (error) {
      console.error('Error getting user profile cache stats:', error)
      return { total: 0, expired: 0 }
    }
  }
}

export class KyselyDatabaseManagerModule implements AppModule {
  private dbManager: KyselyDatabaseManager | null = null

  enable(context: ModuleContext) {
    this.dbManager = new KyselyDatabaseManager()
    context.dbManager = this.dbManager
    return this.dbManager.initialize()
  }
}

export function withKyselyDatabaseManager(...args: ConstructorParameters<typeof KyselyDatabaseManagerModule>) {
  return new KyselyDatabaseManagerModule(...args)
}

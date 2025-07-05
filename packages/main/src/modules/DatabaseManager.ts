import type { GitHubNotification, Inbox, Preferences, PullRequestDetails, StoredNotification } from '../types.js'
import * as path from 'node:path'
import CryptoJS from 'crypto-js'
import { app } from 'electron'
import sqlite3 from 'sqlite3'
import { convertApiUrlToWebUrl } from '../utils.js'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'

export class DatabaseManager {
  private dbPath: string
  private db: sqlite3.Database | null = null
  private encryptionKey: string = 'gh-notify-secret-key' // In production, this should be more secure

  constructor() {
    const userDataPath = app.getPath('userData')
    this.dbPath = path.join(userDataPath, 'github-notifications.db')
  }


  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err: any) => {
        if (err) {
          reject(err)
          return
        }
        this.createTables().then(resolve).catch(reject)
      })
    })
  }

  private async createTables(): Promise<void> {
    const tables = [
      `CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        subject_title TEXT,
        subject_type TEXT,
        subject_url TEXT,
        repository_name TEXT,
        repository_full_name TEXT,
        repository_owner TEXT,
        reason TEXT,
        unread INTEGER,
        updated_at TEXT,
        last_read_at TEXT,
        url TEXT,
        subscription_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
        pr_number INTEGER,
        pr_author TEXT,
        pr_state TEXT,
        pr_merged INTEGER,
        pr_draft INTEGER,
        pr_assignees TEXT,
        pr_requested_reviewers TEXT,
        pr_requested_teams TEXT,
        pr_labels TEXT,
        pr_head_ref TEXT,
        pr_base_ref TEXT,
        pr_head_repo TEXT,
        pr_base_repo TEXT,
        current_user_is_reviewer INTEGER,
        current_user_team_is_reviewer INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS inboxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        filter_expression TEXT,
        desktop_notifications INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(unread)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_repository ON notifications(repository_full_name)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_updated_at ON notifications(updated_at)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_pr_author ON notifications(pr_author)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_pr_state ON notifications(pr_state)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_current_user_reviewer ON notifications(current_user_is_reviewer)`,
    ]

    for (const table of tables) {
      await this.runQuery(table)
    }

    // Run migrations for existing databases
    await this.runMigrations()

    // Create default inbox if none exist
    const inboxCount = await this.getQuery('SELECT COUNT(*) as count FROM inboxes')
    if (inboxCount && inboxCount.count === 0) {
      await this.createInbox({
        name: 'All Notifications',
        filter_expression: 'true',
        desktop_notifications: 1,
      })
    }
  }

  private runQuery(sql: string, params: any[] = []): Promise<{ id?: number, changes?: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.run(sql, params, function (err) {
        if (err) {
          reject(err)
          return
        }
        resolve({ id: this.lastID, changes: this.changes })
      })
    })
  }

  private getQuery(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err)
          return
        }
        resolve(row)
      })
    })
  }

  private allQuery(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err)
          return
        }
        resolve(rows)
      })
    })
  }

  async saveToken(token: string): Promise<boolean> {
    const encrypted = CryptoJS.AES.encrypt(token, this.encryptionKey).toString()
    await this.runQuery(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      ['github_token', encrypted],
    )
    return true
  }

  async getToken(): Promise<string | null> {
    const result = await this.getQuery(
      'SELECT value FROM config WHERE key = ?',
      ['github_token'],
    )

    if (!result)
      return null

    try {
      const decrypted = CryptoJS.AES.decrypt(result.value, this.encryptionKey)
      return decrypted.toString(CryptoJS.enc.Utf8)
    }
    catch (error) {
      console.error('Error decrypting token:', error)
      return null
    }
  }

  async saveLastModified(lastModified: string): Promise<void> {
    await this.runQuery(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      ['last_modified', lastModified],
    )
  }

  async getLastModified(): Promise<string | null> {
    const result = await this.getQuery(
      'SELECT value FROM config WHERE key = ?',
      ['last_modified'],
    )
    return result ? result.value : null
  }

  async saveLastSyncTime(timestamp: string): Promise<void> {
    console.log('Saving last sync time to database:', timestamp)
    await this.runQuery(
      'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
      ['last_sync_time', timestamp],
    )
  }

  async getLastSyncTime(): Promise<string | null> {
    const result = await this.getQuery(
      'SELECT value FROM config WHERE key = ?',
      ['last_sync_time'],
    )
    console.log('Retrieved last sync time: from database', result ? result.value : null)
    return result ? result.value : null
  }

  async saveNotifications(notifications: GitHubNotification[]): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO notifications (
        id, thread_id, subject_title, subject_type, subject_url,
        repository_name, repository_full_name, repository_owner,
        reason, unread, updated_at, last_read_at, url, subscription_url,
        synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('BEGIN TRANSACTION')

        notifications.forEach((notification) => {
          stmt.run([
            notification.id,
            notification.subject?.url || null,
            notification.subject?.title || '',
            notification.subject?.type || '',
            convertApiUrlToWebUrl(notification.subject?.url || null) || '',
            notification.repository?.name || '',
            notification.repository?.full_name || '',
            notification.repository?.owner?.login || '',
            notification.reason || '',
            notification.unread ? 1 : 0,
            notification.updated_at || '',
            notification.last_read_at || null,
            notification.url || '',
            notification.subscription_url || '',
            new Date().toISOString(),
          ])
        })

        this.db!.run('COMMIT', (err) => {
          if (err) {
            reject(err)
            return
          }
          resolve()
        })
      })
    })
  }

  async saveNotificationWithPRDetails(
    notification: GitHubNotification,
    prDetails: PullRequestDetails | null,
    currentUser: { login: string, id: number } | null,
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

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO notifications (
        id, thread_id, subject_title, subject_type, subject_url,
        repository_name, repository_full_name, repository_owner,
        reason, unread, updated_at, last_read_at, url, subscription_url,
        synced_at, pr_number, pr_author, pr_state, pr_merged, pr_draft,
        pr_assignees, pr_requested_reviewers, pr_requested_teams, pr_labels,
        pr_head_ref, pr_base_ref, pr_head_repo, pr_base_repo,
        current_user_is_reviewer, current_user_team_is_reviewer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    return new Promise((resolve, reject) => {
      stmt.run([
        notification.id,
        notification.subject?.url || null,
        notification.subject?.title || '',
        notification.subject?.type || '',
        convertApiUrlToWebUrl(notification.subject?.url || null) || '',
        notification.repository?.name || '',
        notification.repository?.full_name || '',
        notification.repository?.owner?.login || '',
        notification.reason || '',
        notification.unread ? 1 : 0,
        notification.updated_at || '',
        notification.last_read_at || null,
        notification.url || '',
        notification.subscription_url || '',
        new Date().toISOString(),
        // PR fields
        prDetails?.number || null,
        prDetails?.user?.login || null,
        prDetails?.state || null,
        prDetails?.merged ? 1 : 0,
        prDetails?.draft ? 1 : 0,
        prDetails?.assignees ? JSON.stringify(prDetails.assignees.map((a: any) => a.login)) : null,
        prDetails?.requested_reviewers ? JSON.stringify(prDetails.requested_reviewers.map((r: any) => r.login)) : null,
        prDetails?.requested_teams ? JSON.stringify(prDetails.requested_teams.map((t: any) => t.slug)) : null,
        prDetails?.labels ? JSON.stringify(prDetails.labels.map((l: any) => l.name)) : null,
        prDetails?.head?.ref || null,
        prDetails?.base?.ref || null,
        prDetails?.head?.repo?.full_name || null,
        prDetails?.base?.repo?.full_name || null,
        isCurrentUserReviewer ? 1 : 0,
        isCurrentUserTeamReviewer ? 1 : 0,
      ], (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  async getNotifications(limit: number = 100, offset: number = 0): Promise<StoredNotification[]> {
    return await this.allQuery(`
      SELECT * FROM notifications 
      ORDER BY updated_at DESC 
      LIMIT ? OFFSET ?
    `, [limit, offset])
  }

  async getUnreadCount(): Promise<number> {
    const result = await this.getQuery(
      'SELECT COUNT(*) as count FROM notifications WHERE unread = 1',
    )
    return result ? result.count : 0
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.runQuery(
      'UPDATE notifications SET unread = 0 WHERE id = ?',
      [notificationId],
    )
  }

  async createInbox(inbox: Inbox): Promise<number> {
    const result = await this.runQuery(`
      INSERT INTO inboxes (name, filter_expression, desktop_notifications)
      VALUES (?, ?, ?)
    `, [inbox.name, inbox.filter_expression, inbox.desktop_notifications ? 1 : 0])

    return result.id || 0
  }

  async updateInbox(inbox: Inbox): Promise<void> {
    await this.runQuery(`
      UPDATE inboxes 
      SET name = ?, filter_expression = ?, desktop_notifications = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [inbox.name, inbox.filter_expression, inbox.desktop_notifications ? 1 : 0, inbox.id])
  }

  async deleteInbox(id: number): Promise<void> {
    await this.runQuery('DELETE FROM inboxes WHERE id = ?', [id])
  }

  async getInboxes(): Promise<Inbox[]> {
    return await this.allQuery('SELECT * FROM inboxes ORDER BY created_at ASC')
  }

  async getInbox(id: number): Promise<Inbox | null> {
    return await this.getQuery('SELECT * FROM inboxes WHERE id = ?', [id])
  }

  close(): void {
    if (this.db) {
      this.db.close()
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      // Check if PR columns exist, if not add them
      const columns = await this.allQuery(`PRAGMA table_info(notifications)`)
      const columnNames = columns.map((col: any) => col.name)

      // console.log('Existing columns:', columnNames)

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
        const columnName = column.split(' ')[0]
        if (!columnNames.includes(columnName)) {
          // console.log(`Adding column: ${columnName}`)
          try {
            await this.runQuery(`ALTER TABLE notifications ADD COLUMN ${column}`)
            // console.log(`Successfully added column: ${columnName}`)
          }
          catch (columnError) {
            console.error(`Failed to add column ${columnName}:`, columnError)
          }
        }
        else {
          // console.log(`Column already exists: ${columnName}`)
        }
      }

      // Verify all columns were added
      const updatedColumns = await this.allQuery(`PRAGMA table_info(notifications)`)
      const updatedColumnNames = updatedColumns.map((col: any) => col.name)

      // Update existing API URLs to web URLs
      await this.updateApiUrlsToWebUrls()
    }
    catch (error) {
      console.error('Migration error:', error)
      // Don't fail if migrations have issues, table might be new
    }
  }

  /**
   * Update existing API URLs to web URLs for better user experience
   */
  async updateApiUrlsToWebUrls(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    console.log('Updating API URLs to web URLs...')

    return new Promise((resolve, reject) => {
      this.db!.serialize(() => {
        this.db!.run('BEGIN TRANSACTION')

        // Get all notifications with API URLs
        this.db!.all(
          `SELECT id, subject_url FROM notifications WHERE subject_url LIKE 'https://api.github.com/%'`,
          (err, rows: any[]) => {
            if (err) {
              reject(err)
              return
            }

            if (rows.length === 0) {
              console.log('No API URLs found to convert')
              this.db!.run('COMMIT')
              resolve()
              return
            }

            console.log(`Converting ${rows.length} API URLs to web URLs...`)

            const updateStmt = this.db!.prepare(
              `UPDATE notifications SET subject_url = ? WHERE id = ?`,
            )

            let completed = 0
            let hasErrors = false

            rows.forEach((row) => {
              const webUrl = convertApiUrlToWebUrl(row.subject_url)
              if (webUrl && webUrl !== row.subject_url) {
                updateStmt.run([webUrl, row.id], (err) => {
                  if (err) {
                    console.error('Error updating URL for notification', row.id, err)
                    hasErrors = true
                  }

                  completed++
                  if (completed === rows.length) {
                    updateStmt.finalize()
                    if (hasErrors) {
                      this.db!.run('ROLLBACK')
                      reject(new Error('Some URLs failed to update'))
                    }
                    else {
                      this.db!.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                          reject(commitErr)
                        }
                        else {
                          console.log(`Successfully converted ${rows.length} API URLs to web URLs`)
                          resolve()
                        }
                      })
                    }
                  }
                })
              }
              else {
                completed++
                if (completed === rows.length) {
                  updateStmt.finalize()
                  if (hasErrors) {
                    this.db!.run('ROLLBACK')
                    reject(new Error('Some URLs failed to update'))
                  }
                  else {
                    this.db!.run('COMMIT', (commitErr) => {
                      if (commitErr) {
                        reject(commitErr)
                      }
                      else {
                        console.log(`Successfully processed ${rows.length} URLs`)
                        resolve()
                      }
                    })
                  }
                }
              }
            })
          },
        )
      })
    })
  }

  async getUniqueUsernames(): Promise<string[]> {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    try {
      const usernames = new Set<string>()

      // Get unique usernames from PR authors
      const authors = await this.allQuery(`
        SELECT DISTINCT pr_author 
        FROM notifications 
        WHERE pr_author IS NOT NULL AND pr_author != ''
      `)

      authors.forEach((row: any) => {
        if (row.pr_author)
          usernames.add(row.pr_author)
      })

      // Get usernames from PR assignees (JSON arrays)
      const assignees = await this.allQuery(`
        SELECT DISTINCT pr_assignees 
        FROM notifications 
        WHERE pr_assignees IS NOT NULL AND pr_assignees != ''
      `)

      assignees.forEach((row: any) => {
        if (row.pr_assignees) {
          try {
            const assigneeList = JSON.parse(row.pr_assignees)
            assigneeList.forEach((username: string) => usernames.add(username))
          }
          catch {
            // Ignore JSON parse errors
          }
        }
      })

      // Get usernames from PR reviewers (JSON arrays)
      const reviewers = await this.allQuery(`
        SELECT DISTINCT pr_requested_reviewers 
        FROM notifications 
        WHERE pr_requested_reviewers IS NOT NULL AND pr_requested_reviewers != ''
      `)

      reviewers.forEach((row: any) => {
        if (row.pr_requested_reviewers) {
          try {
            const reviewerList = JSON.parse(row.pr_requested_reviewers)
            reviewerList.forEach((username: string) => usernames.add(username))
          }
          catch {
            // Ignore JSON parse errors
          }
        }
      })

      return Array.from(usernames).sort()
    }
    catch (error) {
      console.error('Error getting unique usernames from notifications:', error)
      return []
    }
  }

  async getPreferences(): Promise<Preferences> {
    const prefs = await this.allQuery('SELECT key, value FROM config WHERE key LIKE "pref_%"')

    const preferences: Preferences = {
      autoSyncEnabled: true,
      autoSyncIntervalSeconds: 60, // 1 minute default
      showDesktopNotifications: true,
      soundEnabled: false,
    }

    prefs.forEach((pref: any) => {
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
    const prefMap = {
      pref_auto_sync_enabled: preferences.autoSyncEnabled.toString(),
      pref_auto_sync_interval: preferences.autoSyncIntervalSeconds.toString(),
      pref_show_desktop_notifications: preferences.showDesktopNotifications.toString(),
      pref_sound_enabled: preferences.soundEnabled.toString(),
    }

    for (const [key, value] of Object.entries(prefMap)) {
      await this.runQuery(
        'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)',
        [key, value],
      )
    }
  }
}

export class DatabaseManagerModule implements AppModule {
  private dbManager: DatabaseManager | null = null

  enable(context: ModuleContext) {
    this.dbManager = new DatabaseManager()
    context.dbManager = this.dbManager
    return this.dbManager.initialize()

  }

}

export function withDatabaseManager(...args: ConstructorParameters<typeof DatabaseManagerModule>) {
  return new DatabaseManagerModule(...args)
}
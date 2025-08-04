import type { BrowserWindow } from 'electron'
import type { KyselyDatabaseManager } from '../database/kysely-database-manager.js'
import type { GitHubAPI } from './GitHubAPI.js'
import type { FilterTemplate, GitHubNotification, Inbox, StoredNotification, SyncResult } from '../types.js'
import * as path from 'node:path'
import { Notification } from 'electron'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'
import type { IpcBridgeApiEmitter } from '../Api.js'
import { Temporal } from '@js-temporal/polyfill'
import { filterService } from '../database/filter-service.js'

export class NotificationManager {
  private dbManager: KyselyDatabaseManager
  private githubAPI: GitHubAPI
  private mainWindow: BrowserWindow | null
  private syncTimeout: NodeJS.Timeout | null = null
  // private lastNotificationCount: number = 0
  private syncInProgress: boolean = false

  // This gets set in the IpcHandlers module.
  // TODO: Come up with a better way of structuring this.
  // Ideally it would be a required argument to the constructor, but 
  // NotificationManager has to be created before IpcHandlers because it's used in the
  // constructor of createApiImplementations.
  emitterApi: IpcBridgeApiEmitter | null = null

  constructor(dbManager: KyselyDatabaseManager, githubAPI: GitHubAPI, mainWindow: BrowserWindow | null) {
    this.dbManager = dbManager
    this.githubAPI = githubAPI
    this.mainWindow = mainWindow
  }



  async startPeriodicSync(): Promise<void> {
    // Get user preferences for sync interval
    const preferences = await this.dbManager.getPreferences()
    if (!preferences.autoSyncEnabled) {
      console.log('Auto-sync is disabled, not starting periodic sync')
      return
    }

    console.log(`Starting periodic sync with ${preferences.autoSyncIntervalSeconds}s interval`)

    // Initial sync
    await this.syncNotifications()

    // Use user-configured interval for auto-sync
    const scheduleNextSync = () => {
      this.syncTimeout = setTimeout(async () => {
        await this.syncNotifications()

        // Check if auto-sync is still enabled after each sync
        const currentPrefs = await this.dbManager.getPreferences()
        if (currentPrefs.autoSyncEnabled) {
          scheduleNextSync()
        } else {
          console.log('Auto-sync was disabled, stopping periodic sync')
          this.stopSync()
        }
      }, preferences.autoSyncIntervalSeconds * 1000)
    }

    // Start the periodic sync
    scheduleNextSync()
  }

  stopSync(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
      this.syncTimeout = null
      console.log('Periodic sync stopped')
    }
  }

  async syncNotifications(): Promise<SyncResult> {
    const result = await this.#syncNotifications()
    // Always update sync time on successful sync, even if no new notifications
    if (result.success) {
      const syncTime = new Date().toISOString()
      await this.dbManager.saveLastSyncTime(syncTime)
      // Add the sync time to the result so the UI can update immediately
      result.syncTime = syncTime
    }
    if (this.emitterApi && this.mainWindow) {
      this.emitterApi.send.syncCompleted(this.mainWindow, result)
    }
    return result
  }
  /**
   * Starts the notification sync process.
   * This can either be triggered manually by the user or automatically
   * based on the configured poll interval.
   */
  async #syncNotifications(): Promise<SyncResult> {
    console.log('Syncing notifications...')
    try {
      // Prevent concurrent sync operations
      if (this.syncInProgress) {
        console.log('Sync already in progress, skipping...')
        return { success: true, newCount: 0 }
      }
      this.syncInProgress = true

      const result = await this.githubAPI.fetchNotifications()

      if (result.notModified) {
        return { success: true, newCount: 0 }
      }

      if (result.notifications.length > 0) {
        // Get current user info for PR analysis
        const currentUser = await this.githubAPI.getCurrentUser()
        const userTeams = currentUser ? await this.githubAPI.getUserTeams() : []
        
        
        const oldestNotificationInBatch = result.notifications.reduce((acc: GitHubNotification, current: GitHubNotification) => {
            const accUpdated = Temporal.Instant.from(acc.updated_at)
            const currentUpdated = Temporal.Instant.from(current.updated_at)
            return Temporal.Instant.compare(currentUpdated, accUpdated) < 0 ? current : acc
        });
        console.log(`Oldest notification in batch: ${oldestNotificationInBatch.id} at ${oldestNotificationInBatch.updated_at}`)

        // Process notifications and fetch PR details for pull requests
        for (const notification of result.notifications) {
          const fallbackSave = async () => {
            return this.dbManager.saveNotificationWithPRDetails(
              notification,
              null,
              currentUser,
              userTeams,
            )
          }
          if (notification.subject?.type === 'PullRequest' && notification.subject?.url) {
            // Extract PR number from URL
            const prNumber = this.githubAPI.extractPRNumberFromUrl(notification.subject.url)

            if (prNumber && notification.repository?.full_name) {
              try {
                const prDetails = await this.githubAPI.fetchPullRequestDetails(
                  notification.repository.full_name,
                  prNumber,
                )

                // Save notification with PR details
                await this.dbManager.saveNotificationWithPRDetails(
                  notification,
                  prDetails,
                  currentUser,
                  userTeams,
                )
              }
              catch (error) {
                console.warn(`Failed to fetch PR details for ${notification.repository.full_name}#${prNumber}:`, error)
                // Fall back to saving without PR details
                await fallbackSave()
              }
            }
            else {
              // Save PR notification without details
              await fallbackSave()
            }
          }
          else {
            // For non-PR notifications, save without PR details
            await fallbackSave()
          }
        }

        // Check for new notifications and show desktop notifications
        await this.checkForNewNotifications(oldestNotificationInBatch.updated_at)
      }

      return {
        success: true,
        newCount: result.notifications.length,
      }
    }
    catch (error) {
      console.error('Sync error:', error)
      return { success: false, error: (error as Error).message }
    }
    finally {
      this.syncInProgress = false
    }
  }

  private async checkForNewNotifications(startTime: string): Promise<void> {
    const inboxes = await this.dbManager.getInboxes()

    for (const inbox of inboxes) {
      if (inbox.desktop_notifications) {
        // Use database-level filtering to get matching new notifications
        // We'll fetch a larger page size since we only want to check the new notifications
        const filteredResult = await this.dbManager.getFilteredNotificationsPaginated(
          inbox.filter_expression || 'true',
          null,
          0,
          3, // For notification checking, we only need a few results
          startTime
        )
        
        if (filteredResult.notifications.length > 0) {
          console.log(`Showing desktop notification for inbox "${inbox.name}" with ${filteredResult.totalCount} new notifications`)
          this.showDesktopNotification(inbox as any, filteredResult.notifications)
        }
      }
    }
  }

  private showDesktopNotification(inbox: Inbox, notifications: StoredNotification[]): void {
    const count = notifications.length
    const title = `${inbox.name} - ${count} new notification${count > 1 ? 's' : ''}`
    const body = notifications.slice(0, 3).map(n => n.subject_title || 'Unknown').join('\n')

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const notification = new Notification({
      title,
      body: body + (count > 3 ? `\n... and ${count - 3} more` : ''),
    })

    notification.on('click', () => {
      this.mainWindow?.show()
    })

    notification.show()
  }


  async getFilteredNotificationsPaginated(inboxId: number, page: number = 0, pageSize: number = 50): Promise<{ notifications: StoredNotification[], totalCount: number, hasMore: boolean }> {
    const inbox = await this.dbManager.getInbox(inboxId)

    if (!inbox) {
      throw new Error('Inbox not found')
    }

    // Get quick filter configuration for this inbox
    const quickFilterConfig = await this.dbManager.getOrCreateQuickFilterConfig(inboxId)

    // Use database-level filtering for improved performance
    return await this.dbManager.getFilteredNotificationsPaginated(
      inbox.filter_expression || 'true',
      quickFilterConfig,
      page,
      pageSize
    )
  }

  // Predefined filter templates
  getFilterTemplates(): FilterTemplate[] {
    return [
      {
        name: 'All Notifications',
        expression: 'true',
      },
      {
        name: 'Unread Only',
        expression: 'unread',
      },
      {
        name: 'Pull Requests',
        expression: 'subject_type == "PullRequest"',
      },
      {
        name: 'Issues',
        expression: 'subject_type == "Issue"',
      },
      {
        name: 'Releases',
        expression: 'subject_type == "Release"',
      },
      {
        name: 'Mentions',
        expression: 'reason == "mention"',
      },
      {
        name: 'Assigned to Me',
        expression: 'reason == "assign"',
      },
      {
        name: 'Repository Contains "react"',
        expression: 'contains(repository_name, "react")',
      },
      {
        name: 'Specific Repository',
        expression: 'repository_full_name == "owner/repo"',
      },
      {
        name: 'Multiple Repositories',
        expression: 'repository_full_name == "owner/repo1" OR repository_full_name === "owner/repo2"',
      },
      {
        name: 'PRs by Specific Author',
        expression: 'subject_type == "PullRequest" AND pr_author === "username"',
      },
      {
        name: 'Open PRs',
        expression: 'subject_type == "PullRequest" AND pr_state === "open"',
      },
      {
        name: 'PRs Assigned to Me',
        expression: 'subject_type == "PullRequest" AND includes(pr_assignees, "your-username")',
      },
      {
        name: 'PRs I\'m Reviewing',
        expression: 'subject_type == "PullRequest" AND (current_user_is_reviewer OR current_user_team_is_reviewer)',
      },
      {
        name: 'Draft PRs',
        expression: 'subject_type == "PullRequest" AND pr_draft',
      },
      {
        name: 'Done Items',
        expression: 'done == true',
      },
      {
        name: 'Not Done Items',
        expression: 'done != true',
      },
    ]
  }

  /**
   * Validate a filter expression using the new grammar-based parser
   */
  validateFilterExpression(filterExpression: string): boolean {
    return filterService.validateFilterExpression(filterExpression)
  }
}

export class NotificationManagerModule implements AppModule {
  private notificationManager: NotificationManager | null = null

  enable(context: ModuleContext): Promise<void> {
    if (!context.dbManager) {
      throw new Error('DatabaseManager is not initialized in ModuleContext')
    }
    if (!context.githubAPI) {
      throw new Error('GitHubAPI is not initialized in ModuleContext')
    }
    if (!context.mainWindow) {
      throw new Error('Main window is not initialized in ModuleContext')
    }

    this.notificationManager = new NotificationManager(context.dbManager, context.githubAPI, context.mainWindow)
    context.notificationManager = this.notificationManager
    return Promise.resolve()
  }
}

export function withNotificationManager(...args: ConstructorParameters<typeof NotificationManagerModule>) {
  return new NotificationManagerModule(...args)
}

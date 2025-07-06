import type { BrowserWindow } from 'electron'
import type { KyselyDatabaseManager } from '../database/kysely-database-manager.js'
import type { GitHubAPI } from './GitHubAPI.js'
import type { FilterContext, FilterTemplate, GitHubNotification, Inbox, StoredNotification, SyncResult } from '../types.js'
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

        // Process notifications and fetch PR details for pull requests
        for (const notification of result.notifications) {
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
                await this.dbManager.saveNotificationWithPRDetails(
                  notification,
                  null,
                  currentUser,
                  userTeams,
                )
              }
            }
            else {
              // Save PR notification without details
              await this.dbManager.saveNotificationWithPRDetails(
                notification,
                null,
                currentUser,
                userTeams,
              )
            }
          }
          else {
            // For non-PR notifications, save without PR details
            await this.dbManager.saveNotificationWithPRDetails(
              notification,
              null,
              currentUser,
              userTeams,
            )
          }
        }

        // Check for new notifications and show desktop notifications
        await this.checkForNewNotifications(result.notifications)
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

  private async checkForNewNotifications(notifications: GitHubNotification[]): Promise<void> {
    const inboxes = await this.dbManager.getInboxes()

    for (const inbox of inboxes) {
      if (inbox.desktop_notifications) {
        // For desktop notifications, use simplified filtering since it's not performance-critical
        // and we're dealing with GitHub API notifications, not stored ones
        const filteredNotifications = this.filterNotifications(notifications, inbox.filter_expression || 'true')

        if (filteredNotifications.length > 0) {
          this.showDesktopNotification(inbox as any, filteredNotifications)
        }
      }
    }
  }

  private showDesktopNotification(inbox: Inbox, notifications: GitHubNotification[]): void {
    const count = notifications.length
    const title = `${inbox.name} - ${count} new notification${count > 1 ? 's' : ''}`
    const body = notifications.slice(0, 3).map(n => n.subject?.title || 'Unknown').join('\n')

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = dirname(__filename)
    const notification = new Notification({
      title,
      body: body + (count > 3 ? `\n... and ${count - 3} more` : ''),
      icon: path.join(__dirname, '..', 'buildResources/icons', 'icon.png'),
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

  // Legacy filtering methods - only used for desktop notifications with GitHub API notifications
  // Main inbox filtering now uses database-level filtering for better performance
  private filterNotifications(notifications: GitHubNotification[], filterExpression: string): GitHubNotification[] {
    if (!filterExpression || filterExpression.trim() === 'true') {
      return notifications
    }

    try {
      return notifications.filter((notification) => {
        return this.evaluateFilterForGitHubNotification(notification, filterExpression)
      })
    }
    catch (error) {
      console.error('Error applying filter:', error)
      return notifications // Return all notifications if filter fails
    }
  }

  private evaluateFilterForGitHubNotification(notification: GitHubNotification, expression: string): boolean {
    const context: FilterContext = {
      id: notification.id,
      subject_title: notification.subject?.title || '',
      subject_type: notification.subject?.type || '',
      repository_name: notification.repository?.name || '',
      repository_full_name: notification.repository?.full_name || '',
      repository_owner: notification.repository?.owner?.login || '',
      reason: notification.reason || '',
      unread: Boolean(notification.unread),
      updated_at: notification.updated_at || '',
      done: false, // GitHub notifications are never "done" by default
      // PR fields - not available for GitHubNotification
      pr_number: undefined,
      pr_author: undefined,
      pr_state: undefined,
      pr_merged: undefined,
      pr_draft: undefined,
      pr_assignees: undefined,
      pr_requested_reviewers: undefined,
      pr_requested_teams: undefined,
      pr_labels: undefined,
      pr_head_ref: undefined,
      pr_base_ref: undefined,
      pr_head_repo: undefined,
      pr_base_repo: undefined,
      current_user_is_reviewer: undefined,
      current_user_team_is_reviewer: undefined,

      contains: (field: string, value: string) => {
        return (field || '').toLowerCase().includes((value || '').toLowerCase())
      },

      equals: (field: string, value: string) => {
        return field === value
      },

      startsWith: (field: string, value: string) => {
        return (field || '').toLowerCase().startsWith((value || '').toLowerCase())
      },

      endsWith: (field: string, value: string) => {
        return (field || '').toLowerCase().endsWith((value || '').toLowerCase())
      },

      matches: (field: string, regex: string) => {
        try {
          return new RegExp(regex, 'i').test(field || '')
        }
        catch {
          return false
        }
      },

      includes: (array: string[], value: string) => {
        return array ? array.includes(value) : false
      },
    }

    return this.evaluateFilter(context, expression)
  }

  private evaluateFilter(context: FilterContext, expression: string): boolean {
    // Replace field references in the expression
    const processedExpression = expression
      .replace(/\bsubject_title\b/g, 'context.subject_title')
      .replace(/\bsubject_type\b/g, 'context.subject_type')
      .replace(/\brepository_name\b/g, 'context.repository_name')
      .replace(/\brepository_full_name\b/g, 'context.repository_full_name')
      .replace(/\brepository_owner\b/g, 'context.repository_owner')
      .replace(/\breason\b/g, 'context.reason')
      .replace(/\bunread\b/g, 'context.unread')
      .replace(/\bupdated_at\b/g, 'context.updated_at')
      .replace(/\bdone\b/g, 'context.done')
      // PR field replacements
      .replace(/\bpr_number\b/g, 'context.pr_number')
      .replace(/\bpr_author\b/g, 'context.pr_author')
      .replace(/\bpr_state\b/g, 'context.pr_state')
      .replace(/\bpr_merged\b/g, 'context.pr_merged')
      .replace(/\bpr_draft\b/g, 'context.pr_draft')
      .replace(/\bpr_assignees\b/g, 'context.pr_assignees')
      .replace(/\bpr_requested_reviewers\b/g, 'context.pr_requested_reviewers')
      .replace(/\bpr_requested_teams\b/g, 'context.pr_requested_teams')
      .replace(/\bpr_labels\b/g, 'context.pr_labels')
      .replace(/\bpr_head_ref\b/g, 'context.pr_head_ref')
      .replace(/\bpr_base_ref\b/g, 'context.pr_base_ref')
      .replace(/\bpr_head_repo\b/g, 'context.pr_head_repo')
      .replace(/\bpr_base_repo\b/g, 'context.pr_base_repo')
      .replace(/\bcurrent_user_is_reviewer\b/g, 'context.current_user_is_reviewer')
      .replace(/\bcurrent_user_team_is_reviewer\b/g, 'context.current_user_team_is_reviewer')
      // Function replacements
      .replace(/\bcontains\(/g, 'context.contains(')
      .replace(/\bequals\(/g, 'context.equals(')
      .replace(/\bstartsWith\(/g, 'context.startsWith(')
      .replace(/\bendsWith\(/g, 'context.endsWith(')
      .replace(/\bmatches\(/g, 'context.matches(')
      .replace(/\bincludes\(/g, 'context.includes(')
      // Logical operator replacements
      .replace(/\bAND\b/g, '&&')
      .replace(/\bOR\b/g, '||')
      .replace(/\bNOT\b/g, '!')
      // Handle == and != operators (but not === and !==)
      .replace(/(?<!=)==(?!=)/g, '===')
      .replace(/(?<!!)!=(?!=)/g, '!==')

    try {
      // Use Function constructor for safer evaluation
      const evaluator = new Function('context', `return ${processedExpression}`)
      return evaluator(context)
    }
    catch (error) {
      console.error('Filter evaluation error:', error)
      console.error('Original expression:', expression)
      console.error('Processed expression:', processedExpression)
      return false
    }
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
        expression: 'subject_type === "PullRequest"',
      },
      {
        name: 'Issues',
        expression: 'subject_type === "Issue"',
      },
      {
        name: 'Releases',
        expression: 'subject_type === "Release"',
      },
      {
        name: 'Mentions',
        expression: 'reason === "mention"',
      },
      {
        name: 'Assigned to Me',
        expression: 'reason === "assign"',
      },
      {
        name: 'Repository Contains "react"',
        expression: 'contains(repository_name, "react")',
      },
      {
        name: 'Specific Repository',
        expression: 'repository_full_name === "owner/repo"',
      },
      {
        name: 'Multiple Repositories',
        expression: 'repository_full_name === "owner/repo1" OR repository_full_name === "owner/repo2"',
      },
      {
        name: 'PRs by Specific Author',
        expression: 'subject_type === "PullRequest" AND pr_author === "username"',
      },
      {
        name: 'Open PRs',
        expression: 'subject_type === "PullRequest" AND pr_state === "open"',
      },
      {
        name: 'PRs Assigned to Me',
        expression: 'subject_type === "PullRequest" AND includes(pr_assignees, "your-username")',
      },
      {
        name: 'PRs I\'m Reviewing',
        expression: 'subject_type === "PullRequest" AND (current_user_is_reviewer OR current_user_team_is_reviewer)',
      },
      {
        name: 'Draft PRs',
        expression: 'subject_type === "PullRequest" AND pr_draft',
      },
      {
        name: 'Done Items',
        expression: 'done === true',
      },
      {
        name: 'Not Done Items',
        expression: 'done !== true',
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

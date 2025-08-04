import { Temporal } from '@js-temporal/polyfill';
import type { KyselyDatabaseManager } from '../database/kysely-database-manager.js'
import type { GitHubNotification, NotificationFetchResult, PullRequestDetails, TokenTestResult } from '../types.js'
import { Octokit } from '@octokit/rest'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'

export class GitHubAPI {
  private dbManager: KyselyDatabaseManager
  private octokit: Octokit | null = null
  private pollInterval: Temporal.Duration = Temporal.Duration.from('PT1M')

  constructor(dbManager: KyselyDatabaseManager) {
    this.dbManager = dbManager
  }

  private async getOctokit(): Promise<Octokit> {
    if (!this.octokit) {
      const token = await this.dbManager.getToken()
      if (!token) {
        throw new Error('No GitHub token found')
      }

      this.octokit = new Octokit({
        auth: token,
        userAgent: 'GitHub-Notifications-App',
      })
    }
    return this.octokit
  }

  // Reset Octokit instance when token changes
  resetClient(): void {
    this.octokit = null
  }

  async testToken(token: string): Promise<TokenTestResult> {
    try {
      // Create a temporary Octokit instance with the test token
      const testOctokit = new Octokit({
        auth: token,
        userAgent: 'GitHub-Notifications-App',
      })

      const { data: user } = await testOctokit.rest.users.getAuthenticated()
      return { success: true, user }
    }
    catch (error: any) {
      return { success: false, error: error.message || 'Unknown error' }
    }
  }

  async fetchNotifications(): Promise<NotificationFetchResult> {
    const octokit = await this.getOctokit()

    try {
      let lastModifiedHeader: string | null = null

      // Get the last modified time if we want to use conditional requests
      let since: string | undefined
      const lastModified = await this.dbManager.getLastModified()
      // If lastModified is available, that means we have fetched notifications before
      // and should begin polling by setting the `if-modified-since` header.
      // If it's not available, this is the first sync and we should set the `since` parameter
      // to a reasonable default (e.g., 1 day ago).
      if (!lastModified) {
        since = Temporal.Now.instant().subtract('PT24H').toString()
      }


      // Use Octokit's paginate to fetch all notifications
      const notifications = await octokit.paginate(
        octokit.rest.activity.listNotificationsForAuthenticatedUser,
        {
          all: true,
          participating: false,
          per_page: 500,
          ...(since && { since }),
          headers: {
            ...(lastModified && { 'if-modified-since': lastModified }),
          }
        },
        (response, _done) => {
          // Update poll interval if provided (only from first response)
          if (response.headers['x-poll-interval']) {
            this.pollInterval = Temporal.Duration.from({
              seconds: Number.parseInt(response.headers['x-poll-interval'] as string)
            })
          }

          // Save the Last-Modified header from the first response for next request
          if (!lastModifiedHeader && response.headers['last-modified']) {
            lastModifiedHeader = response.headers['last-modified'] as string
          }

          return response.data
        },
      )

      console.log(`Fetched ${notifications.length} notifications`)

      // Save the Last-Modified header for next request
      if (lastModifiedHeader) {
        await this.dbManager.saveLastModified(lastModifiedHeader)
      }

      return {
        notifications: notifications as GitHubNotification[],
        notModified: false,
      }
    }
    catch (error: any) {
      // Handle 304 Not Modified
      if (error.status === 304) {
        return { notifications: [], notModified: true }
      }

      console.error('Error fetching notifications:', error)
      throw error
    }
  }

  async markAsRead(notificationId: string): Promise<boolean> {
    const octokit = await this.getOctokit()

    try {
      await octokit.rest.activity.markThreadAsRead({
        thread_id: Number.parseInt(notificationId, 10),
      })

      // Update local database
      await this.dbManager.markAsRead(notificationId)
      return true
    }
    catch (error: any) {
      console.error('Error marking notification as read:', error)
      throw new Error(`Error marking as read: ${error.message}`)
    }
  }

  async markAsUnread(notificationId: string): Promise<boolean> {
    const octokit = await this.getOctokit()

    try {
      // GitHub API doesn't have a direct "mark as unread" endpoint
      // We can achieve this by marking the thread as unread using the subscription endpoint
      await octokit.rest.activity.setThreadSubscription({
        thread_id: Number.parseInt(notificationId, 10),
        subscribed: true,
        ignored: false,
      })

      // Update local database only after successful API call
      await this.dbManager.markAsUnread(notificationId)
      return true
    }
    catch (error: any) {
      console.error('Error marking notification as unread:', error)
      throw new Error(`Error marking as unread: ${error.message}`)
    }
  }

  async markAsDone(notificationId: string): Promise<boolean> {
    const octokit = await this.getOctokit()

    try {
      // For "done" status, we'll mark it as read on GitHub since there's no "done" concept there
      // but track "done" status locally in our database
      await octokit.rest.activity.markThreadAsRead({
        thread_id: Number.parseInt(notificationId, 10),
      })

      // Update local database with both read and done status
      await this.dbManager.markAsRead(notificationId)
      await this.dbManager.markAsDone(notificationId)
      return true
    }
    catch (error: any) {
      console.error('Error marking notification as done:', error)
      throw new Error(`Error marking as done: ${error.message}`)
    }
  }

  async markAllAsRead(_repositoryFullName?: string): Promise<boolean> {
    const octokit = await this.getOctokit()

    try {
      // For now, Octokit doesn't have a direct method for repo-specific mark all as read
      // We'll mark all notifications as read regardless of the repository parameter
      await octokit.rest.activity.markNotificationsAsRead({
        last_read_at: new Date().toISOString(),
      })

      return true
    }
    catch (error: any) {
      console.error('Error marking all notifications as read:', error)
      throw new Error(`Error marking all as read: ${error.message}`)
    }
  }

  getPollInterval(): Temporal.Duration {
    return this.pollInterval
  }

  async fetchPullRequestDetails(repoFullName: string, prNumber: number): Promise<PullRequestDetails | null> {
    const octokit = await this.getOctokit()

    try {
      const [owner, repo] = repoFullName.split('/')
      const { data: prData } = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      })

      return prData as PullRequestDetails
    }
    catch (error: any) {
      if (error.status === 404) {
        // PR might not exist anymore or we don't have access
        return null
      }

      console.warn(`Failed to fetch PR details for ${repoFullName}#${prNumber}: ${error.status}`)
      return null
    }
  }

  async getCurrentUser(): Promise<{ login: string, id: number } | null> {
    try {
      const octokit = await this.getOctokit()
      const { data: userData } = await octokit.rest.users.getAuthenticated()
      return { login: userData.login, id: userData.id }
    }
    catch (error: any) {
      console.error('Error fetching current user:', error)
      return null
    }
  }

  async getUserTeams(): Promise<string[]> {
    try {
      const octokit = await this.getOctokit()
      const { data: teams } = await octokit.rest.teams.listForAuthenticatedUser()
      return teams.map((team: any) => team.slug)
    }
    catch (error: any) {
      console.error('Error fetching user teams:', error)
      return []
    }
  }

  extractPRNumberFromUrl(url: string): number | null {
    // GitHub PR URLs have the format: https://api.github.com/repos/owner/repo/pulls/123
    const match = url.match(/\/pulls\/(\d+)$/)
    return match ? Number.parseInt(match[1], 10) : null
  }

  async fetchRepositoryCollaborators(repoFullName: string): Promise<string[]> {
    try {
      const octokit = await this.getOctokit()
      const [owner, repo] = repoFullName.split('/')
      const { data: collaborators } = await octokit.rest.repos.listCollaborators({
        owner,
        repo,
      })
      return collaborators.map((user: any) => user.login)
    }
    catch (error: any) {
      console.error(`Error fetching collaborators for ${repoFullName}:`, error)
      return []
    }
  }

  async searchUsers(query: string, limit: number = 10): Promise<string[]> {
    try {
      const octokit = await this.getOctokit()
      const { data: searchResult } = await octokit.rest.search.users({
        q: query,
        per_page: limit,
      })
      return searchResult.items.map((user: any) => user.login)
    }
    catch (error: any) {
      console.error(`Error searching users with query "${query}":`, error)
      return []
    }
  }

  async getUniqueUsernamesFromNotifications(): Promise<string[]> {
    if (!this.dbManager) {
      return []
    }

    try {
      return await this.dbManager.getUniqueUsernames()
    }
    catch (error) {
      console.error('Error getting unique usernames from notifications:', error)
      return []
    }
  }

  async fetchUserProfile(username: string): Promise<{ login: string, avatar_url: string, name?: string, bio?: string } | null> {
    if (!username)
      return null

    // Check database cache first
    const cached = await this.dbManager.getUserProfile(username)
    if (cached) {
      return {
        login: cached.login,
        avatar_url: cached.avatar_url,
        name: cached.name || undefined,
        bio: cached.bio || undefined,
      }
    }

    try {
      const octokit = await this.getOctokit()
      const { data: userData } = await octokit.rest.users.getByUsername({
        username,
      })

      const profile = {
        login: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name || undefined,
        bio: userData.bio || undefined,
      }

      // Cache the result in database (uses default TTL)
      await this.dbManager.saveUserProfile({
        username,
        login: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name || undefined,
        bio: userData.bio || undefined,
      })

      return profile
    }
    catch (error: any) {
      console.error(`Error fetching user profile for ${username}:`, error)
      return null
    }
  }

  // Cleanup expired user profiles from database cache
  async cleanupExpiredProfiles(): Promise<void> {
    try {
      await this.dbManager.cleanupExpiredUserProfiles()
    } catch (error) {
      console.error('Error cleaning up expired user profiles:', error)
    }
  }

  // Get user profile cache statistics
  async getProfileCacheStats(): Promise<{ total: number, expired: number }> {
    try {
      return await this.dbManager.getUserProfileCacheStats()
    } catch (error) {
      console.error('Error getting profile cache stats:', error)
      return { total: 0, expired: 0 }
    }
  }
}

export class GitHubAPIModule implements AppModule {

  githubAPI: GitHubAPI | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  enable(context: ModuleContext): Promise<void> {
    if (!context.dbManager) {
      throw new Error('DatabaseManager is not initialized in ModuleContext')
    }
    // Initialize GitHubAPI with the database manager
    this.githubAPI = new GitHubAPI(context.dbManager)
    context.githubAPI = this.githubAPI
    
    // Set up periodic cleanup of expired user profiles (every hour)
    this.cleanupInterval = setInterval(() => {
      this.githubAPI?.cleanupExpiredProfiles()
    }, 60 * 60 * 1000) // 1 hour
    
    context.app.on('quit', () => {
      this.githubAPI?.resetClient()
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval)
        this.cleanupInterval = null
      }
    })
    
    return Promise.resolve()
  }
}

export function withGitHubAPI(...args: ConstructorParameters<typeof GitHubAPIModule>) {
  return new GitHubAPIModule(...args)
}
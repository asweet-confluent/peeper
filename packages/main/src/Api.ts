import type { IpcMainInvokeEvent } from 'electron'
import type { IpcBridgeApiEmitterGenerator, IpcBridgeApiGenerator } from 'electron-typed-ipc-bridge/main'
import type { KyselyDatabaseManager } from './database/kysely-database-manager.js'
import type { GitHubAPI } from './modules/GitHubAPI.js'
import type { NotificationManager } from './modules/NotificationManager.js'
import type {
  Inbox,
  Preferences,
  StoredNotification,
  SyncResult,
} from './types.js'
import * as utils from './utils.js'

export function createApiImplementations(
  dbManager: KyselyDatabaseManager,
  githubAPI: GitHubAPI,
  notificationManager: NotificationManager,
  // mainWindow: Electron.BrowserWindow | null,
  updateAutoSyncCallback?: (preferences: any) => Promise<void>,
) {
  return {
    invoke: {
      openExternal: utils.openExternal,
      consoleOutput: utils.consoleOutput,
      // Token management
      getToken: () => dbManager.getToken(),

      saveToken: async (_event: IpcMainInvokeEvent, token: string): Promise<boolean> => {
        const result = await dbManager.saveToken(token)
        if (result) {
          // Reset the GitHub API client to use the new token
          githubAPI.resetClient()
        }
        return result
      },

      testToken: (_event: IpcMainInvokeEvent, token: string) => githubAPI.testToken(token),

      // Notification management
      getNotificationsPaginated: async (_event: IpcMainInvokeEvent, page: number = 0, pageSize: number = 50) => {
        return await dbManager.getNotificationsPaginated(page, pageSize)
      },

      syncNotifications: async (): Promise<SyncResult> => {
        console.log('Starting notification sync...')
        const result = await notificationManager.syncNotifications()
        return result

        // // Send sync completion event for all syncs (manual and automatic)
        // if (mainWindow && !mainWindow.isDestroyed()) {
        //   const syncResult = {
        //     ...result,
        //     syncTime: new Date().toISOString(),
        //   }
        //   mainWindow.webContents.send('sync-completed', syncResult)
        // }

      },

      markAsRead: async (_event: IpcMainInvokeEvent, notificationId: string): Promise<boolean> => {
        return await githubAPI.markAsRead(notificationId)
      },

      // Inbox management
      getInboxes: async (): Promise<Inbox[]> => {
        return await dbManager.getInboxes() as Inbox[]
      },

      createInbox: async (_event: IpcMainInvokeEvent, inbox: Inbox): Promise<number> => {
        return await dbManager.createInbox(inbox as any)
      },

      updateInbox: async (_event: IpcMainInvokeEvent, inbox: Inbox): Promise<void> => {
        return await dbManager.updateInbox(inbox as any)
      },

      deleteInbox: async (_event: IpcMainInvokeEvent, id: number): Promise<void> => {
        return await dbManager.deleteInbox(id)
      },

      getFilteredNotificationsPaginated: async (_event: IpcMainInvokeEvent, inboxId: number, page: number = 0, pageSize: number = 50) => {
        return await notificationManager.getFilteredNotificationsPaginated(inboxId, page, pageSize)
      },

      validateFilterExpression: async (_event: IpcMainInvokeEvent, filterExpression: string): Promise<{ valid: boolean, error?: string }> => {
        try {
          const valid = notificationManager.validateFilterExpression(filterExpression)
          return { valid }
        } catch (error) {
          return { 
            valid: false, 
            error: error instanceof Error ? error.message : String(error)
          }
        }
      },

      // Username autocompletion
      searchUsers: async (_event: IpcMainInvokeEvent, query: string, limit?: number): Promise<string[]> => {
        return await githubAPI.searchUsers(query, limit)
      },

      getUniqueUsernames: async (): Promise<string[]> => {
        return await githubAPI.getUniqueUsernamesFromNotifications()
      },

      fetchUserProfile: async (_event: IpcMainInvokeEvent, username: string): Promise<{ login: string, avatar_url: string, name?: string, bio?: string } | null> => {
        return await githubAPI.fetchUserProfile(username)
      },

      // Preferences
      getPreferences: async (): Promise<Preferences> => {
        return await dbManager.getPreferences()
      },

      savePreferences: async (_event: IpcMainInvokeEvent, preferences: Preferences): Promise<boolean> => {
        await dbManager.savePreferences(preferences)
        // Update auto-sync if preferences changed and callback is provided
        if (updateAutoSyncCallback) {
          await updateAutoSyncCallback(preferences)
        }
        return true
      },

      // Sync status
      getLastSyncTime: async (): Promise<string | null> => {
        return await dbManager.getLastSyncTime()
      },

      // Quick Filter Configuration
      getQuickFilterConfig: async (_event: IpcMainInvokeEvent, inboxId: number) => {
        return await dbManager.getOrCreateQuickFilterConfig(inboxId)
      },

      updateQuickFilterConfig: async (_event: IpcMainInvokeEvent, inboxId: number, config: any): Promise<void> => {
        return await dbManager.updateQuickFilterConfig(inboxId, config)
      },
    },
    on: {
      // App events - main to renderer communication
      notificationUpdate: (...args: any[]) => args,
      syncCompleted: (result: SyncResult) => result,
    },
  }
}

export type IpcBridgeApiEmitter = IpcBridgeApiEmitterGenerator<ReturnType<typeof createApiImplementations>>
export type IpcBridgeApi = IpcBridgeApiGenerator<ReturnType<typeof createApiImplementations>>


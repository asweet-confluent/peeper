import { getIpcBridgeApiEmitter, registerIpcHandler, initialise } from 'electron-typed-ipc-bridge/main'
import type { AppModule } from '../AppModule.js'
import { createApiImplementations } from '../Api.js'
import type { ModuleContext } from '../ModuleContext.js'
import type { Preferences } from '../types.js'

class IpcHandlers implements AppModule {
  private api: ReturnType<typeof createApiImplementations> | null = null
  private emitter: ReturnType<typeof getIpcBridgeApiEmitter> | null = null
  private context: ModuleContext | null = null

  enable(context: ModuleContext): void {
    this.context = context
    
    // Wait for app to be ready before setting up IPC
    context.app.whenReady().then(async () => {
      const { dbManager, githubAPI, notificationManager } = context
      if (!dbManager || !githubAPI || !notificationManager) {
        throw new Error('Module context is not fully initialized')
      }

      initialise({ logger: {} })

      // Create the updateAutoSyncCallback function
      const updateAutoSyncCallback = async (preferences: Preferences) => {
        if (preferences.autoSyncEnabled) {
          console.log('Starting periodic sync with interval:', preferences.autoSyncIntervalSeconds, 'seconds')
          notificationManager.stopSync() // Stop any existing sync
          await notificationManager.startPeriodicSync()
        } else {
          console.log('Stopping periodic sync')
          notificationManager.stopSync()
        }
      }

      this.api = createApiImplementations(dbManager, githubAPI, notificationManager, updateAutoSyncCallback)
      this.emitter = getIpcBridgeApiEmitter(this.api)
      registerIpcHandler(this.api)
      
      // Pass the API objects to any other modules that need them
      notificationManager.emitterApi = this.emitter

      // Start auto-sync if enabled in preferences
      try {
        const preferences = await dbManager.getPreferences()
        if (preferences.autoSyncEnabled) {
          console.log('Auto-sync is enabled, starting periodic sync...')
          await updateAutoSyncCallback(preferences)
        } else {
          console.log('Auto-sync is disabled')
        }
      } catch (error) {
        console.error('Error initializing auto-sync:', error)
      }
    })
  }

  disable(): void {
    // Stop any running sync when the app shuts down
    if (this.context?.notificationManager) {
      console.log('Stopping periodic sync on app shutdown')
      this.context.notificationManager.stopSync()
    }
  }


}

export function setupIpcHandlers(...args: ConstructorParameters<typeof IpcHandlers>) {
  return new IpcHandlers(...args)
}
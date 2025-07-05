import { getIpcBridgeApiEmitter, registerIpcHandler, initialise } from 'electron-typed-ipc-bridge/main'
import type { AppModule } from '../AppModule.js'
import { createApiImplementations } from '../Api.js'
import type { ModuleContext } from '../ModuleContext.js'

class IpcHandlers implements AppModule {
  private api: ReturnType<typeof createApiImplementations> | null = null
  private emitter: ReturnType<typeof getIpcBridgeApiEmitter> | null = null

  enable(context: ModuleContext): void {
    // Wait for app to be ready before setting up IPC
    context.app.whenReady().then(() => {
      const { dbManager, githubAPI, notificationManager } = context
      if (!dbManager || !githubAPI || !notificationManager) {
        throw new Error('Module context is not fully initialized')
      }

      initialise({ logger: {} })

      this.api = createApiImplementations(dbManager, githubAPI, notificationManager)
      this.emitter = getIpcBridgeApiEmitter(this.api)
      registerIpcHandler(this.api)
      
      // Pass the API objects to any other modules that need them
      notificationManager.emitterApi = this.emitter
    })
  }


}

export function setupIpcHandlers(...args: ConstructorParameters<typeof IpcHandlers>) {
  return new IpcHandlers(...args)
}
import type { AppInitConfig } from './AppInitConfig.js'
import { createModuleRunner } from './ModuleRunner.js'
import { terminateAppOnLastWindowClose } from './modules/ApplicationTerminatorOnLastWindowClose.js'
import { withKyselyDatabaseManager } from './database/kysely-database-manager.js'
import { withDevTools } from './modules/DevTools.js'
import { withGitHubAPI } from './modules/GitHubAPI.js'
import { setupIpcHandlers } from './modules/IpcHandlers.js'
import { withNotificationManager } from './modules/NotificationManager.js'
import { disallowMultipleAppInstance } from './modules/SingleInstanceApp.js'
import { createWindowManagerModule } from './modules/WindowManager.js'

export async function initApp(initConfig: AppInitConfig) {
  const moduleRunner = createModuleRunner()
  await moduleRunner.init(createWindowManagerModule({ initConfig, openDevTools: false }))
  await moduleRunner.init(disallowMultipleAppInstance())
  await moduleRunner.init(terminateAppOnLastWindowClose())
  await moduleRunner.init(withKyselyDatabaseManager())
  await moduleRunner.init(withGitHubAPI())
  await moduleRunner.init(withNotificationManager())
  await moduleRunner.init(setupIpcHandlers())
  // await moduleRunner.init(withDevTools())

  await moduleRunner
  
  // Now that all modules are initialized, load the window content
  const context = moduleRunner.getContext()
  if (context.loadWindowContent) {
    console.log('Loading window content after all modules are initialized...')
    await context.loadWindowContent()
    console.log('Window content loaded, showing window...')
    context.mainWindow?.show()
  }
}

export type { IpcBridgeApi } from './Api.js'
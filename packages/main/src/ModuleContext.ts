import { KyselyDatabaseManager } from './database/kysely-database-manager.js'
import { GitHubAPI } from './modules/GitHubAPI.js'
import { NotificationManager } from './modules/NotificationManager.js'

export interface ModuleContext {
  readonly app: Electron.App
  mainWindow?: Electron.BrowserWindow
  githubAPI?: GitHubAPI
  notificationManager?: NotificationManager
  dbManager?: KyselyDatabaseManager
  loadWindowContent?: () => Promise<void>
}

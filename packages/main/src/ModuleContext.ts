import { DatabaseManager } from './modules/DatabaseManager.js'
import { GitHubAPI } from './modules/GitHubAPI.js'
import { NotificationManager } from './modules/NotificationManager.js'

export interface ModuleContext {
  readonly app: Electron.App
  mainWindow?: Electron.BrowserWindow
  githubAPI?: GitHubAPI
  notificationManager?: NotificationManager
  dbManager?: DatabaseManager
  loadWindowContent?: () => Promise<void>
}

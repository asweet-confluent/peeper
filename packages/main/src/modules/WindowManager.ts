import type { AppInitConfig } from '../AppInitConfig.js'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'
import { BrowserWindow } from 'electron'

class WindowManager implements AppModule {
  readonly #preload: { path: string }
  readonly #renderer: { path: string } | URL
  readonly #openDevTools: boolean

  constructor({ initConfig, openDevTools = false }: { initConfig: AppInitConfig, openDevTools?: boolean }) {
    this.#preload = initConfig.preload
    this.#renderer = initConfig.renderer
    this.#openDevTools = openDevTools
  }

  async enable(context: ModuleContext): Promise<void> {
    if (!context.app.isReady()) {
      await context.app.whenReady()
    }
    
    context.app.setAppUserModelId('com.asweet.peeper')
    
    // Create window but don't show it yet
    context.mainWindow = await this.restoreOrCreateWindow(false)
    context.app.on('second-instance', () => this.restoreOrCreateWindow(true))
    context.app.on('activate', () => this.restoreOrCreateWindow(true))
    
    // Store a reference to load content later
    context.loadWindowContent = () => this.loadWindowContent(context.mainWindow!)
    
    return Promise.resolve()
  }

  async createWindow(): Promise<BrowserWindow> {
    console.log('WindowManager: Creating BrowserWindow...')
    const browserWindow = new BrowserWindow({
      show: false, // Use the 'ready-to-show' event to show the instantiated BrowserWindow.
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Sandbox disabled because the demo of preload script depend on the Node.js api
        webviewTag: false, // The webview tag is not recommended. Consider alternatives like an iframe or Electron's BrowserView. @see https://www.electronjs.org/docs/latest/api/webview-tag#warning
        preload: this.#preload.path,
      },
    })

    console.log('WindowManager: BrowserWindow created, deferring content loading...')
    // Don't load the content immediately - defer it until after all modules are ready
    return browserWindow
  }

  async loadWindowContent(window: BrowserWindow): Promise<void> {
    console.log('WindowManager: Loading window content...')
    if (this.#renderer instanceof URL) {
      console.log('WindowManager: Loading URL:', this.#renderer.href)
      await window.loadURL(this.#renderer.href)
    }
    else {
      console.log('WindowManager: Loading file:', this.#renderer.path)
      await window.loadFile(this.#renderer.path)
    }
    console.log('WindowManager: Window content loaded')
  }

  async restoreOrCreateWindow(show = false) {
    let window = BrowserWindow.getAllWindows().find(w => !w.isDestroyed())

    if (window === undefined) {
      window = await this.createWindow()
    }

    if (!show) {
      return window
    }

    if (window.isMinimized()) {
      window.restore()
    }

    window?.show()

    if (this.#openDevTools) {
      window?.webContents.openDevTools()
    }

    window.focus()

    return window
  }
}

export function createWindowManagerModule(...args: ConstructorParameters<typeof WindowManager>) {
  return new WindowManager(...args)
}

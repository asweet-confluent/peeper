import { Menu, shell, app } from 'electron'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'

/**
 * MenuManager module that creates the application menu
 * Includes a Help menu with "Check for Updates" option
 */
class MenuManager implements AppModule {
  private context: ModuleContext | null = null

  async enable(context: ModuleContext): Promise<void> {
    this.context = context
    
    // Wait for app to be ready before setting up the menu
    await context.app.whenReady()
    
    this.createMenu()
  }

  private createMenu(): void {
    const isMac = process.platform === 'darwin'
    
    const template: Electron.MenuItemConstructorOptions[] = [
      // App menu (macOS only)
      ...(isMac ? [{
        label: app.getName(),
        submenu: [
          { role: 'about' as const },
          { type: 'separator' as const },
          { role: 'services' as const, submenu: [] },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
          { role: 'quit' as const }
        ]
      }] : []),
      
      // File menu
      {
        label: 'File',
        submenu: [
          isMac ? { role: 'close' as const } : { role: 'quit' as const }
        ]
      },
      
      // Edit menu
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' as const },
          { role: 'redo' as const },
          { type: 'separator' as const },
          { role: 'cut' as const },
          { role: 'copy' as const },
          { role: 'paste' as const },
          ...(isMac ? [
            { role: 'pasteAndMatchStyle' as const },
            { role: 'delete' as const },
            { role: 'selectAll' as const },
            { type: 'separator' as const },
            {
              label: 'Speech',
              submenu: [
                { role: 'startSpeaking' as const },
                { role: 'stopSpeaking' as const }
              ]
            }
          ] : [
            { role: 'delete' as const },
            { type: 'separator' as const },
            { role: 'selectAll' as const }
          ])
        ]
      },
      
      // View menu
      {
        label: 'View',
        submenu: [
          { role: 'reload' as const },
          { role: 'forceReload' as const },
          { role: 'toggleDevTools' as const },
          { type: 'separator' as const },
          { role: 'resetZoom' as const },
          { role: 'zoomIn' as const },
          { role: 'zoomOut' as const },
          { type: 'separator' as const },
          { role: 'togglefullscreen' as const }
        ]
      },
      
      // Window menu
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' as const },
          ...(isMac ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const }
          ] : [
            { role: 'close' as const }
          ])
        ]
      },
      
      // Help menu
      {
        label: 'Help',
        submenu: [
          {
            label: 'Check for Updates...',
            click: async () => await this.handleCheckForUpdates()
          },
          { type: 'separator' as const },
          {
            label: 'About GitHub Notifications',
            click: () => this.handleAbout()
          },
          {
            label: 'Learn More',
            click: async () => {
              await shell.openExternal('https://github.com/asweet-confluent/peeper')
            }
          }
        ]
      }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  private async handleCheckForUpdates(): Promise<void> {
    if (!this.context?.checkForUpdates) {
      console.error('Update checking is not available')
      return
    }

    try {
      await this.context.checkForUpdates(true)
    } catch (error) {
      console.error('Error checking for updates:', error)
    }
  }

  private handleAbout(): void {
    if (!this.context?.mainWindow) {
      console.error('No main window available for about dialog')
      return
    }

    // Send IPC message to show about dialog
    this.context.mainWindow.webContents.send('menu-about')
  }
}

export function withMenuManager(...args: ConstructorParameters<typeof MenuManager>): AppModule {
  return new MenuManager(...args)
}
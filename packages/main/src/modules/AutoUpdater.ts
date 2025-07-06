import electronUpdater, { type AppUpdater } from 'electron-updater';
import { app, dialog } from 'electron'
import type { AppModule } from '../AppModule.js'
import type { ModuleContext } from '../ModuleContext.js'

export function getAutoUpdater(): AppUpdater {
   // Using destructuring to access autoUpdater due to the CommonJS module of 'electron-updater'.
   // It is a workaround for ESM compatibility issues, see https://github.com/electron-userland/electron-builder/issues/7976.
   const { autoUpdater } = electronUpdater;
   return autoUpdater;
}
/**
 * Auto-updater module using electron-updater
 * Handles automatic updates for the application
 */
export function withAutoUpdater(): AppModule {
  return {
    async enable(context: ModuleContext) {
      // Use console for logging for now - electron-log can be added later if needed
      const log = console

      // Log some basic info
      log.info('Auto-updater initialized')
      log.info(`App version: ${app.getVersion()}`)
      log.info(`Platform: ${process.platform}`)

      // Configure auto-updater following electron-updater best practices
      const autoUpdater = getAutoUpdater()
      autoUpdater.logger = log
      autoUpdater.autoDownload = false // Manual control over downloads for better UX
      autoUpdater.autoInstallOnAppQuit = true
      
      // Enable staged rollouts support
      autoUpdater.fullChangelog = true

      // Set up event handlers
      autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...')
      })

      autoUpdater.on('update-available', (info) => {
        log.info('Update available:', info)
        
        // Show a dialog to ask if user wants to download the update
        if (context.mainWindow) {
          const response = dialog.showMessageBoxSync(context.mainWindow, {
            type: 'info',
            buttons: ['Download Now', 'Download Later'],
            defaultId: 0,
            title: 'Update Available',
            message: `A new version (${info.version}) is available!`,
            detail: `Current version: ${app.getVersion()}\nNew version: ${info.version}\n\nWould you like to download it now? The update will be installed when you restart the app.`
          })

          if (response === 0) {
            log.info('User chose to download update')
            autoUpdater.downloadUpdate()
          } else {
            log.info('User chose to postpone update')
          }
        }
      })

      autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available:', info)
      })

      autoUpdater.on('error', (err) => {
        log.error('Error in auto-updater:', err)
        
        // Show error dialog only for critical errors, not network issues
        if (context.mainWindow && !err.message.includes('ENOTFOUND') && !err.message.includes('ECONNREFUSED')) {
          dialog.showMessageBoxSync(context.mainWindow, {
            type: 'error',
            title: 'Update Error',
            message: 'Failed to check for updates',
            detail: 'There was an error while checking for updates. Please try again later.'
          })
        }
      })

      autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent)
        log.info(`Download progress: ${percent}% (${progressObj.transferred}/${progressObj.total} bytes)`)
        
        // You could show a progress notification here
        // or update a progress bar in the UI
        // For now, just log the progress
      })

      autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded:', info)
        
        // Show a dialog asking if user wants to restart and install
        if (context.mainWindow) {
          const response = dialog.showMessageBoxSync(context.mainWindow, {
            type: 'info',
            buttons: ['Restart Now', 'Restart Later'],
            defaultId: 0,
            title: 'Update Ready',
            message: 'Update downloaded successfully!',
            detail: `Version ${info.version} has been downloaded and is ready to install.\n\nThe application will restart to apply the update.`
          })

          if (response === 0) {
            log.info('User chose to restart and install update')
            autoUpdater.quitAndInstall()
          } else {
            log.info('User chose to restart later')
          }
        }
      })

      // Check for updates when the app starts (after a delay to let everything load)
      setTimeout(() => {
        if (!app.isPackaged) {
          log.info('Skipping update check - app is not packaged')
          return
        }
        
        log.info('Checking for updates...')
        autoUpdater.checkForUpdatesAndNotify()
      }, 5000) // Wait 5 seconds after app start

      // Set up periodic checks (every hour)
      setInterval(() => {
        if (!app.isPackaged) {
          return
        }
        
        log.info('Periodic update check...')
        autoUpdater.checkForUpdatesAndNotify()
      }, 60 * 60 * 1000) // Check every hour

      log.info('Auto-updater module initialized')
    }
  }
}

import {  shell } from 'electron'

export async function openExternal(_event: Electron.IpcMainInvokeEvent, url: string) {
  try {
    await shell.openExternal(url)
  }
  catch (error) {
    console.error('Failed to open URL:', error)
  }
}

export function consoleOutput(_event: Electron.IpcMainInvokeEvent, level: string, ...args: any[]) {
  const timestamp = new Date().toISOString()
  const prefix = `[RENDERER ${timestamp}]`

  // Format arguments for terminal output
  const formattedArgs = args.map((arg) => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2)
      }
      catch {
        return String(arg)
      }
    }
    return String(arg)
  }).join(' ')

  // Output to terminal stdout with appropriate formatting
  switch (level) {
    case 'error':
      console.error(`${prefix} [ERROR]`, formattedArgs)
      break
    case 'warn':
      console.warn(`${prefix} [WARN]`, formattedArgs)
      break
    case 'info':
      console.info(`${prefix} [INFO]`, formattedArgs)
      break
    case 'debug':
      console.debug(`${prefix} [DEBUG]`, formattedArgs)
      break
    default:
      console.log(`${prefix} [LOG]`, formattedArgs)
  }
}

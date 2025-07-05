import { IpcBridgeApi } from '@app/main/src/Api.js'
import { ipcRenderer } from 'electron'
import { generateIpcBridgeApi, initialise } from 'electron-typed-ipc-bridge/preload'

initialise({ logger: {} });

function send(channel: string, message: string) {
  return ipcRenderer.invoke(channel, message)
}

export { send }
export { versions } from 'node:process'
export const api = await generateIpcBridgeApi<IpcBridgeApi>()
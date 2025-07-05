import type { ElectronAPI } from '@electron-toolkit/preload'
import type { IpcBridgeApi } from '@app/main'

declare global {
  interface Window {
    electron: ElectronAPI
    api: IpcBridgeApi
  }
}

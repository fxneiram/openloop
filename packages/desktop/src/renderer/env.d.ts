import type { ElectronAPI } from "../preload/types"

declare global {
  interface Window {
    api: ElectronAPI
    __OPENLOOP__?: {
      deepLinks?: string[]
    }
  }
}

import type { ElectronNative } from "../preload/types"

declare global {
  interface ImportMetaEnv {
    readonly SLEEPYCODE_TEST_ONBOARDING: boolean
  }

  interface Window {
    electron: ElectronNative
    __SLEEPYCODE__?: {
      deepLinks?: string[]
    }
  }
}

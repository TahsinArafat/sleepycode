interface ImportMetaEnv {
  readonly SLEEPYCODE_CHANNEL: string
  readonly SLEEPYCODE_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

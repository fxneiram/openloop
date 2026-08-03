declare global {
  const OPENLOOP_VERSION: string
  const OPENLOOP_CHANNEL: string
}

export const InstallationVersion = typeof OPENLOOP_VERSION === "string" ? OPENLOOP_VERSION : "local"
export const InstallationChannel = typeof OPENLOOP_CHANNEL === "string" ? OPENLOOP_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

import { Capacitor } from '@capacitor/core'

export type DistributionChannel = 'web' | 'app-store' | 'play-store'

type RuntimePlatform = 'android' | 'ios' | 'web'

export function resolveDistributionChannel(value: string | undefined): DistributionChannel {
  if (value === 'app-store' || value === 'play-store') {
    return value
  }
  return 'web'
}

export function resolveStoreBillingPolicy(
  channel: DistributionChannel,
  isNativePlatform: boolean,
  platform: RuntimePlatform,
) {
  const usesAppleStore = channel === 'app-store' || (isNativePlatform && platform === 'ios')
  const usesGooglePlay = channel === 'play-store' || (isNativePlatform && platform === 'android')

  return {
    usesAppleStore,
    usesGooglePlay,
    usesNativeStore: usesAppleStore || usesGooglePlay,
  }
}

export const DISTRIBUTION_CHANNEL = resolveDistributionChannel(
  import.meta.env.VITE_DISTRIBUTION_CHANNEL,
)

export function getStoreBillingPolicy() {
  const runtimePlatform = typeof Capacitor.getPlatform === 'function'
    ? Capacitor.getPlatform()
    : 'web'
  const isNativePlatform = typeof Capacitor.isNativePlatform === 'function'
    ? Capacitor.isNativePlatform()
    : runtimePlatform === 'ios' || runtimePlatform === 'android'
  return resolveStoreBillingPolicy(
    DISTRIBUTION_CHANNEL,
    isNativePlatform,
    runtimePlatform === 'ios' || runtimePlatform === 'android' ? runtimePlatform : 'web',
  )
}

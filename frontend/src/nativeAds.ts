import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  type BannerAdOptions,
} from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

const ANDROID_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'

const getAndroidBannerConfig = () => {
  if (import.meta.env.DEV) {
    return { adId: ANDROID_TEST_BANNER_ID, isTesting: true }
  }

  const adId = import.meta.env.VITE_ADMOB_ANDROID_BANNER_ID?.trim()
  return adId ? { adId, isTesting: false } : null
}

export const initializeNativeAds = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }

  const bannerConfig = getAndroidBannerConfig()
  if (!bannerConfig) {
    console.warn('[AdMob] VITE_ADMOB_ANDROID_BANNER_ID is not configured; banner disabled.')
    return
  }

  let consentInfo = await AdMob.requestConsentInfo()
  if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
    consentInfo = await AdMob.showConsentForm()
  }

  if (!consentInfo.canRequestAds) {
    return
  }

  await AdMob.initialize({ initializeForTesting: bannerConfig.isTesting })

  const bannerOptions: BannerAdOptions = {
    adId: bannerConfig.adId,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: bannerConfig.isTesting,
  }

  await AdMob.showBanner(bannerOptions)
}
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  type AdmobConsentInfo,
  type BannerAdOptions,
} from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

const ANDROID_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'
const ANDROID_PRODUCTION_BANNER_ID = 'ca-app-pub-2001944410031596/5270129152'
const PRIVACY_OPTIONS_REQUIRED = 'REQUIRED'

let latestConsentInfo: AdmobConsentInfo | null = null
let consentInfoRequest: Promise<AdmobConsentInfo> | null = null

const isNativeAndroid = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const requestConsentInfo = async () => {
  if (latestConsentInfo) {
    return latestConsentInfo
  }

  if (!consentInfoRequest) {
    consentInfoRequest = AdMob.requestConsentInfo()
      .then((consentInfo) => {
        latestConsentInfo = consentInfo
        return consentInfo
      })
      .finally(() => {
        consentInfoRequest = null
      })
  }

  return consentInfoRequest
}

const getAndroidBannerConfig = () => {
  if (import.meta.env.DEV) {
    return { adId: ANDROID_TEST_BANNER_ID, isTesting: true }
  }

  const adId = import.meta.env.VITE_ADMOB_ANDROID_BANNER_ID?.trim()
  return {
    adId: adId || ANDROID_PRODUCTION_BANNER_ID,
    isTesting: false,
  }
}

export const initializeNativeAds = async () => {
  if (!isNativeAndroid()) {
    return
  }

  const bannerConfig = getAndroidBannerConfig()

  let consentInfo = await requestConsentInfo()
  if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
    consentInfo = await AdMob.showConsentForm()
    latestConsentInfo = consentInfo
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

export const isPrivacyOptionsFormRequired = async () => {
  if (!isNativeAndroid()) {
    return false
  }

  const consentInfo = await requestConsentInfo()
  return consentInfo.privacyOptionsRequirementStatus === PRIVACY_OPTIONS_REQUIRED
}

export const showPrivacyOptionsForm = async () => {
  if (!isNativeAndroid()) {
    throw new Error('Privacy choices are only available in the Android app.')
  }

  const consentInfo = await requestConsentInfo()
  if (consentInfo.privacyOptionsRequirementStatus !== PRIVACY_OPTIONS_REQUIRED) {
    throw new Error('A privacy options form is not required for this user.')
  }

  await AdMob.showPrivacyOptionsForm()
}
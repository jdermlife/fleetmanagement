import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPosition,
  BannerAdSize,
  type BannerAdOptions,
} from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

const ANDROID_TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111'

export const initializeNativeAds = async () => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return
  }

  let consentInfo = await AdMob.requestConsentInfo()
  if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
    consentInfo = await AdMob.showConsentForm()
  }

  if (!consentInfo.canRequestAds) {
    return
  }

  await AdMob.initialize({ initializeForTesting: true })

  const bannerOptions: BannerAdOptions = {
    adId: ANDROID_TEST_BANNER_ID,
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: true,
  }

  await AdMob.showBanner(bannerOptions)
}
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type AdMobBannerSize,
} from "@capacitor-community/admob"
import { Capacitor } from "@capacitor/core"

export type AdPlacement = "home-main-card" | "social-league" | "post-workout-video"

const IOS_BANNER_AD_ID = "ca-app-pub-8384755176465345/2842070117"
const IOS_TEST_BANNER_AD_ID = "ca-app-pub-3940256099942544/2435281174"
const BANNER_BOTTOM_MARGIN = 76

type BannerState = "none" | "visible" | "hidden"

let initializationPromise: Promise<boolean> | null = null
let listenersRegistered = false
let bannerState: BannerState = "none"
let bannerShouldBeVisible = false

export function isAdEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_ADS !== "false"
}

export function isNativeAdPlatform(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios"
}

function isTestMode(): boolean {
  const override = import.meta.env.VITE_ADMOB_TEST_MODE
  return override === undefined ? import.meta.env.DEV : override === "true"
}

function setBannerHeight(height: number) {
  document.documentElement.style.setProperty("--admob-banner-height", `${Math.max(0, height)}px`)
}

async function registerBannerListeners() {
  if (listenersRegistered) return

  listenersRegistered = true
  await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
    console.info("[AdMob] Banner loaded", { testMode: isTestMode() })
    if (!bannerShouldBeVisible) {
      void AdMob.hideBanner().then(() => {
        bannerState = "hidden"
        setBannerHeight(0)
      }).catch((error) => {
        console.error("[AdMob] Could not hide a late banner response", error)
      })
    }
  })
  await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size: AdMobBannerSize) => {
    setBannerHeight(size.height)
    console.info("[AdMob] Banner size changed", size)
  })
  await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
    bannerState = "none"
    setBannerHeight(0)
    console.error("[AdMob] Banner failed to load", error)
  })
}

async function initializeNativeAds(): Promise<boolean> {
  if (!isAdEnabled() || !isNativeAdPlatform()) return false
  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    try {
      console.info("[AdMob] Initializing native iOS ads", { testMode: isTestMode() })
      await AdMob.initialize()
      await registerBannerListeners()

      let consentInfo = await AdMob.requestConsentInfo()
      console.info("[AdMob] Consent information loaded", consentInfo)

      if (
        consentInfo.isConsentFormAvailable &&
        consentInfo.status === AdmobConsentStatus.REQUIRED
      ) {
        consentInfo = await AdMob.showConsentForm()
        console.info("[AdMob] Consent form completed", consentInfo)
      }

      if (!consentInfo.canRequestAds) {
        console.warn("[AdMob] Ads are unavailable until consent permits requests")
        return false
      }

      return true
    } catch (error) {
      console.error("[AdMob] Initialization or consent failed", error)
      return false
    }
  })()

  return initializationPromise
}

export async function setNativeBannerVisible(visible: boolean): Promise<void> {
  if (!isNativeAdPlatform()) return
  bannerShouldBeVisible = visible && isAdEnabled()

  if (!bannerShouldBeVisible) {
    if (bannerState === "visible") {
      try {
        await AdMob.hideBanner()
        bannerState = "hidden"
      } catch (error) {
        console.error("[AdMob] Could not hide banner", error)
      }
    }
    setBannerHeight(0)
    return
  }

  if (!(await initializeNativeAds()) || !bannerShouldBeVisible || bannerState === "visible") return

  try {
    if (bannerState === "hidden") {
      await AdMob.resumeBanner()
      bannerState = "visible"
      if (!bannerShouldBeVisible) await setNativeBannerVisible(false)
      return
    }

    const testMode = isTestMode()
    await AdMob.showBanner({
      adId: testMode ? IOS_TEST_BANNER_AD_ID : IOS_BANNER_AD_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: BANNER_BOTTOM_MARGIN,
      isTesting: testMode,
      npa: true,
    })
    bannerState = "visible"
    if (!bannerShouldBeVisible) await setNativeBannerVisible(false)
  } catch (error) {
    bannerState = "none"
    setBannerHeight(0)
    console.error("[AdMob] Could not show banner", error)
  }
}

export function getAdLabel(placement: AdPlacement): string {
  switch (placement) {
    case "home-main-card":
      return "Sponsored"
    case "social-league":
      return "Sponsored"
    case "post-workout-video":
      return "Video Ad"
  }
}

export async function showPostWorkoutVideoAd(): Promise<void> {
  if (!isAdEnabled()) return

  // The current AdMob unit is a banner; keep the existing video placeholder until a video unit is added.
  await new Promise((resolve) => window.setTimeout(resolve, 2800))
}

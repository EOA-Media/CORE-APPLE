import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  type AdMobBannerSize,
} from "@capacitor-community/admob"
import { Capacitor } from "@capacitor/core"

export type AdPlacement = "home-main-card" | "social-league" | "post-workout-video"

const IOS_BANNER_AD_ID = "ca-app-pub-8384755176465345/2842070117"
const IOS_TEST_BANNER_AD_ID = "ca-app-pub-3940256099942544/2435281174"
const IOS_POST_WORKOUT_INTERSTITIAL_AD_ID = "ca-app-pub-8384755176465345/2354956703"
const IOS_TEST_INTERSTITIAL_AD_ID = "ca-app-pub-3940256099942544/4411468910"
const BANNER_BOTTOM_MARGIN = 76
const INTERSTITIAL_LOAD_TIMEOUT_MS = 8_000
const INTERSTITIAL_SHOW_TIMEOUT_MS = 5_000

type BannerState = "none" | "visible" | "hidden"

let initializationPromise: Promise<boolean> | null = null
let listenersRegistered = false
let bannerState: BannerState = "none"
let bannerShouldBeVisible = false
let interstitialPreparationPromise: Promise<boolean> | null = null
let interstitialReady = false

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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
    promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timeout)
        reject(error)
      }
    )
  })
}

async function registerAdListeners() {
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
  await AdMob.addListener(InterstitialAdPluginEvents.Loaded, (info) => {
    interstitialReady = true
    console.info("[AdMob] Post-workout interstitial loaded", info)
  })
  await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => {
    interstitialReady = false
    console.error("[AdMob] Post-workout interstitial failed to load", error)
  })
  await AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
    console.info("[AdMob] Post-workout interstitial shown")
  })
  await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
    interstitialReady = false
    console.info("[AdMob] Post-workout interstitial dismissed")
  })
  await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (error) => {
    interstitialReady = false
    console.error("[AdMob] Post-workout interstitial failed to show", error)
  })
}

async function initializeNativeAds(): Promise<boolean> {
  if (!isAdEnabled() || !isNativeAdPlatform()) return false
  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    try {
      console.info("[AdMob] Initializing native iOS ads", { testMode: isTestMode() })
      await AdMob.initialize()
      await registerAdListeners()

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

export async function preparePostWorkoutInterstitial(): Promise<boolean> {
  if (!isAdEnabled() || !isNativeAdPlatform()) return false
  if (interstitialReady) return true
  if (interstitialPreparationPromise) return interstitialPreparationPromise

  interstitialPreparationPromise = (async () => {
    if (!(await initializeNativeAds())) return false

    const testMode = isTestMode()
    console.info("[AdMob] Preparing post-workout interstitial", { testMode })
    try {
      await withTimeout(
        AdMob.prepareInterstitial({
          adId: testMode
            ? IOS_TEST_INTERSTITIAL_AD_ID
            : IOS_POST_WORKOUT_INTERSTITIAL_AD_ID,
          isTesting: testMode,
          npa: true,
        }),
        INTERSTITIAL_LOAD_TIMEOUT_MS,
        "Post-workout interstitial load"
      )
      interstitialReady = true
      return true
    } catch (error) {
      interstitialReady = false
      console.error("[AdMob] Could not prepare post-workout interstitial", error)
      return false
    }
  })().finally(() => {
    interstitialPreparationPromise = null
  })

  return interstitialPreparationPromise
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

export async function showPostWorkoutInterstitialAd(): Promise<void> {
  if (!isAdEnabled()) return

  if (!isNativeAdPlatform()) {
    await new Promise((resolve) => window.setTimeout(resolve, 1200))
    return
  }

  if (!(await preparePostWorkoutInterstitial())) return

  try {
    await withTimeout(
      AdMob.showInterstitial(),
      INTERSTITIAL_SHOW_TIMEOUT_MS,
      "Post-workout interstitial show"
    )
  } catch (error) {
    console.error("[AdMob] Could not show post-workout interstitial", error)
  } finally {
    interstitialReady = false
  }
}

export type AdPlacement = "home-main-card" | "social-league" | "post-workout-video"

export function isAdEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_ADS !== "false"
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

  // Native AdMob rewarded/interstitial video plugs in here after Capacitor iOS is configured.
  await new Promise((resolve) => window.setTimeout(resolve, 2800))
}

// Shared PWA constants (used by the layout, the tracker and the API routes).

// iPhone launch screens in public/splash, generated for light and dark mode.
// [pixel width, pixel height, css device-width, css device-height, pixel ratio]
export const IOS_SPLASH: [number, number, number, number, number][] = [
  [1320, 2868, 440, 956, 3], // iPhone 16 Pro Max
  [1206, 2622, 402, 874, 3], // iPhone 16 Pro
  [1080, 2340, 360, 780, 3], // iPhone 12/13 mini
  [1290, 2796, 430, 932, 3],
  [1179, 2556, 393, 852, 3],
  [1284, 2778, 428, 926, 3],
  [1170, 2532, 390, 844, 3],
  [1125, 2436, 375, 812, 3],
  [1242, 2688, 414, 896, 3],
  [828, 1792, 414, 896, 2],
  [1242, 2208, 414, 736, 3],
  [750, 1334, 375, 667, 2],
]

export const PWA_EVENT_TYPES = ["prompt_shown", "prompt_accepted", "prompt_dismissed", "installed", "launch"] as const
export type PwaEventType = (typeof PWA_EVENT_TYPES)[number]

export const PWA_PLATFORMS = ["android", "ios", "desktop", "other"] as const
export type PwaPlatform = (typeof PWA_PLATFORMS)[number]

// Server-only collection: one anonymous document per device, no personal data.
export const PWA_DEVICES = "pwaDevices"

// In-page event the install prompt uses to tell the tracker what happened.
export const PWA_TRACK_EVENT = "carerunners:pwa"

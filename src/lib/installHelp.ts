// How to install the app on the device in hand. Chrome, Edge, Samsung Internet and other Chromium browsers offer
// their own install prompt (beforeinstallprompt); every other browser needs steps, and a few can't install at all.
export type InstallHelp =
  | "ios" // iPhone/iPad: Share, then Add to Home Screen (any iOS browser on iOS 16.4+)
  | "ios-in-app" // Facebook/Instagram/... browser on iOS: open in Safari first
  | "android-in-app" // Facebook/Instagram/... browser on Android: open in Chrome first
  | "firefox-android" // Firefox on Android: menu, then Install
  | "mac-safari" // Safari on a Mac: File, then Add to Dock
  | "desktop-firefox" // Firefox on a computer can't install apps
  | "browser-menu"; // a Chromium browser that hasn't offered its prompt: use the browser menu

const IN_APP = /FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|LinkedInApp|Twitter|Snapchat|GSA\/|MicroMessenger/i;

// `ua`, `platform` and `touchPoints` come from navigator; passed in so this can be tested.
export function installHelpFor(ua: string, platform = "", touchPoints = 0): InstallHelp {
  // iPadOS 13+ reports a Mac user agent, so a touch-capable "Mac" is an iPad.
  const ios = /iphone|ipad|ipod/i.test(ua) || (platform === "MacIntel" && touchPoints > 1);
  if (ios) return IN_APP.test(ua) ? "ios-in-app" : "ios";
  if (/android/i.test(ua)) {
    // "; wv)" marks an Android WebView, which is what in-app browsers use.
    if (IN_APP.test(ua) || /; wv\)/.test(ua)) return "android-in-app";
    if (/firefox/i.test(ua)) return "firefox-android";
    return "browser-menu";
  }
  if (/firefox/i.test(ua)) return "desktop-firefox";
  if (/macintosh/i.test(ua) && /safari/i.test(ua) && !/chrome|chromium|crios|edg|opr/i.test(ua)) return "mac-safari";
  return "browser-menu";
}

// The steps shown for each case.
export const INSTALL_STEPS: Record<InstallHelp, string> = {
  ios: "Tap the Share button, then Add to Home Screen.",
  "ios-in-app": "This browser can't install apps. Open the menu, choose Open in Safari, then tap Share and Add to Home Screen.",
  "android-in-app": "This browser can't install apps. Open the menu (⋮), choose Open in Chrome (or your browser), then install from there.",
  "firefox-android": "Open the Firefox menu (⋮), then tap Install (or Add to Home screen).",
  "mac-safari": "In Safari's menu bar, choose File, then Add to Dock.",
  "desktop-firefox": "Firefox can't install apps on a computer. Open this site in Chrome or Edge, then click Install.",
  "browser-menu": "Open your browser's menu (⋮), then choose Install Care Runners (or Add to Home screen).",
};

// Phones where people won't find the steps by themselves: the banner shows them without being asked.
export const SHOW_STEPS_UNASKED: InstallHelp[] = ["ios", "ios-in-app", "android-in-app", "firefox-android"];

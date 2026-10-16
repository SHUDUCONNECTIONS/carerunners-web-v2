import { describe, expect, it } from "vitest";
import { installHelpFor } from "./installHelp";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidSamsung: "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  androidFacebook: "Mozilla/5.0 (Linux; Android 14; SM-A546B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US;FBAV/480.0.0.0]",
  androidWebView: "Mozilla/5.0 (Linux; Android 14; SM-A546B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  windowsFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
};

describe("installHelpFor", () => {
  it("iPhone and iPad: Share, then Add to Home Screen (in any iOS browser)", () => {
    expect(installHelpFor(UA.iphoneSafari)).toBe("ios");
    expect(installHelpFor(UA.iphoneChrome)).toBe("ios");
    expect(installHelpFor(UA.ipad, "MacIntel", 5)).toBe("ios");
  });

  it("apps' built-in browsers: open in Safari or Chrome first", () => {
    expect(installHelpFor(UA.iphoneInstagram)).toBe("ios-in-app");
    expect(installHelpFor(UA.androidFacebook)).toBe("android-in-app");
    expect(installHelpFor(UA.androidWebView)).toBe("android-in-app");
  });

  it("Firefox: menu steps on Android, can't install on a computer", () => {
    expect(installHelpFor(UA.androidFirefox)).toBe("firefox-android");
    expect(installHelpFor(UA.windowsFirefox)).toBe("desktop-firefox");
  });

  it("Safari on a Mac (no touch screen): Add to Dock", () => {
    expect(installHelpFor(UA.macSafari, "MacIntel", 0)).toBe("mac-safari");
  });

  it("Chromium browsers: their own prompt, or the browser menu", () => {
    for (const ua of [UA.androidChrome, UA.androidSamsung, UA.macChrome, UA.windowsEdge]) expect(installHelpFor(ua)).toBe("browser-menu");
  });
});

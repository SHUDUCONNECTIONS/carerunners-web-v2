import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/service-worker-register"
import InstallPrompt from "@/components/InstallPrompt";
import PwaTracker from "@/components/PwaTracker";
import { IOS_SPLASH } from "@/lib/pwa";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Carerunners",
  applicationName: "Care Runners",
  description: "Pick-ups, deliveries and the MarketPortal marketplace. Fast. Safe. Reliable.",
  manifest: "/manifest.json",
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Colours the browser bar / Android status bar, and lets the app use the full
// screen on notched phones.
export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Opens the connection to Peach early so the payment form loads faster. */}
        <link rel="preconnect" href="https://card.peachpayments.com" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Carerunners" />
        {/* iOS only reads this tag for the home-screen icon (it ignores
            manifest.json's icons array) — must be square and opaque, or
            Safari squashes/blacks-out a wide or transparent source image. */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        {/* iPhone launch screens: teal in light mode, deep navy in dark mode. */}
        {IOS_SPLASH.flatMap(([w, h, dw, dh, ratio]) =>
          (["light", "dark"] as const).map((scheme) => (
            <link
              key={`${w}x${h}-${scheme}`}
              rel="apple-touch-startup-image"
              media={`(device-width: ${dw}px) and (device-height: ${dh}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait) and (prefers-color-scheme: ${scheme})`}
              href={`/splash/splash-${w}x${h}-${scheme}.png`}
            />
          ))
        )}
        {/* Sets the `dark` class on <html> before hydration to avoid a
            flash of the wrong theme. Reads localStorage, falling back to
            prefers-color-scheme. Kept as a plain inline script (no
            external deps) since it must run synchronously pre-hydration. */}
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <ServiceWorkerRegister />
          <InstallPrompt />
          <PwaTracker />
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}

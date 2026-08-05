import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/service-worker-register"
import InstallPrompt from "@/components/InstallPrompt";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Carerunners",
  description: "Carerunners, trust us with your documents",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#0d9488" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Carerunners" />
        <link rel="apple-touch-icon" href="/carerunnerlogo.png" />
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
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}

import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaSetup } from "@/components/pwa";
import { Toaster } from "@/components/ui/toast";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · mso-pm" },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  category: "productivity",
  creator: "mshinan.com",

  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "mso-pm: free project management tool for software teams" }],
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: ["/og.png"] },
  formatDetection: { telephone: false },
  // Opened from the iPhone Home Screen: full screen, app name under the icon.
  appleWebApp: { capable: true, title: "mso-pm", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f4" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  viewportFit: "cover",
};

// Runs before first paint so there is no light flash. The choice ("system",
// "light" or "dark") lives in localStorage; see ThemeSwitch in the account menu.
const THEME_SCRIPT = `(function(){try{var m=matchMedia('(prefers-color-scheme: dark)');function a(){var t=localStorage.getItem('theme')||'system';document.documentElement.dataset.theme=t==='dark'||(t==='system'&&m.matches)?'dark':'light'}a();m.addEventListener('change',a);window.addEventListener('storage',a)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <Toaster>{children}</Toaster>
        <PwaSetup />
        {/* Cookieless page views; only collects once Web Analytics is enabled for the Vercel project.
            Vercel serves its script, so elsewhere (CI, `next start`) it would only 404. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}

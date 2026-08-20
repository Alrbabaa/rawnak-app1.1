import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const APP_URL = "https://rawnak.app";

export const metadata: Metadata = {
  title: "رَونق | مساعدتك الذكية للجمال والعناية بالبشرة",
  description:
    "رَونق — خبيرة الجمال والبشرة الشخصية بالذكاء الاصطناعي. تحليل ذكي للبشرة، روتين مخصص، ونصائح جمالية يومية.",
  keywords: ["رَونق", "العناية بالبشرة", "الجمال", "ذكاء اصطناعي", "تحليل البشرة", "skincare", "beauty"],
  authors: [{ name: "Rawnak" }],
  applicationName: "Rawnak",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "رَونق",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/rawnak-logo.jpg", type: "image/jpeg" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: "/rawnak-icon.jpg",
    shortcut: "/rawnak-icon.jpg",
  },
  openGraph: {
    title: "رَونق | مساعدتك الذكية للجمال",
    description: "خبيرة الجمال الشخصية بالذكاء الاصطناعي",
    type: "website",
    url: APP_URL,
    siteName: "رَونق",
    images: [{ url: "/rawnak-logo.jpg", width: 1254, height: 1254, alt: "رَونق" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "رَونق | مساعدتك الذكية للجمال",
    description: "خبيرة الجمال الشخصية بالذكاء الاصطناعي",
    images: ["/rawnak-logo.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* iOS PWA + Safari */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="رَونق" />
        <link rel="apple-touch-icon" href="/rawnak-icon.jpg" />
        <link rel="icon" href="/rawnak-logo.jpg" type="image/jpeg" />
        <link rel="shortcut icon" href="/rawnak-icon.jpg" />
      </head>
      <body
        className={`${cairo.variable} font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}

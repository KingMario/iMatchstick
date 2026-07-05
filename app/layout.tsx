import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "巧移火柴我最棒 | iMatchstick PWA",
  description: "Move exactly one matchstick to correct the equation.",
  manifest: "./manifest.webmanifest",
  icons: {
    icon: "./icons/icon.svg",
    apple: "./icons/icon.svg",
  },
  appleWebApp: {
    capable: true,
    title: "巧移火柴",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#f5c542",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

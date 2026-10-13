import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./academy.css";

export const metadata: Metadata = {
  title: "巧移火柴我最棒 | iMatchstick PWA",
  description: "Move exactly one matchstick to correct the equation.",
  manifest: "./manifest.webmanifest?v=b8307a0197bc",
  icons: {
    icon: [
      {
        url: "./icons/favicon.ico?v=1f17e484b41f",
        type: "image/x-icon",
        sizes: "16x16 32x32 48x48",
      },
      {
        url: "./icons/favicon-16.png?v=36ca601da2a9",
        type: "image/png",
        sizes: "16x16",
      },
      {
        url: "./icons/favicon-32.png?v=0a7aa922a96b",
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: "./icons/favicon-48.png?v=8e4d857d9034",
        type: "image/png",
        sizes: "48x48",
      },
    ],
    apple: [
      {
        url: "./icons/apple-touch-icon.png?v=b1b6f8fdf668",
        sizes: "180x180",
        type: "image/png",
      },
    ],
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
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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

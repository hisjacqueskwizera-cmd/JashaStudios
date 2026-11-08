import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import { publicEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: "Jasha Studios",
    template: "%s | Jasha Studios",
  },
  description: "An AI-powered virtual photography studio.",
  applicationName: "Jasha Studios",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#10100f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}

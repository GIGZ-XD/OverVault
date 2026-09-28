import React from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/app/providers";
import { ToastProvider } from "@/components/ui/toast";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "OverVault - Enterprise Blockchain Document Storage",
  description: "Blockchain-audited enterprise document storage on MST Blockchain with BridgeKey Wallet identity and signing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="font-sans bg-bg text-text antialiased selection:bg-accent-soft selection:text-accent">
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  );
}

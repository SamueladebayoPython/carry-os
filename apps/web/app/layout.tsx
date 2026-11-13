import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import "@near-wallet-selector/modal-ui/styles.css";

export const metadata: Metadata = {
  title: "Carry OS — NFT custody and beneficiary control",
  description: "Multichain NFT custody and beneficiary control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700&family=Schibsted+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

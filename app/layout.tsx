import type { Metadata } from "next";
import { Public_Sans, IBM_Plex_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const sans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Trove",
  description: "Drop anything in. Ask it anything later.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${sans.variable} ${mono.variable} h-full antialiased`}
        style={{ fontFamily: "var(--font-public-sans)" }}
      >
        <body className="min-h-full overflow-x-hidden bg-canvas text-ink">
          <div className="grain" />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const sans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        style={{ fontFamily: "var(--font-geist-sans)" }}
      >
        <body className="min-h-full overflow-x-hidden bg-[var(--color-canvas)] text-[var(--color-text-primary)]">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
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
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <header className="flex items-center justify-between px-6 py-3 border-b border-black/5">
            <Link href="/" className="text-sm font-medium">
              Trove
            </Link>
            <nav className="flex items-center gap-4 text-sm text-black/60">
              <Link href="/wiki" className="hover:text-black">
                wiki
              </Link>
              <Link href="/digest" className="hover:text-black">
                digest
              </Link>
              <Link href="/pipelines" className="hover:text-black">
                pipelines
              </Link>
              <Show when="signed-out">
                <SignInButton />
              </Show>
              <Show when="signed-in">
                <UserButton />
              </Show>
            </nav>
          </header>

          {children}

          <footer className="mt-auto border-t border-black/5 px-6 py-4 text-xs text-black/50">
            <p className="mb-2">Accepted formats</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              <li>text and links</li>
              <li>PDF</li>
              <li>images (png, jpg, gif, webp)</li>
              <li>Word .docx</li>
              <li>Excel .xlsx</li>
              <li>plain text (txt, md, csv, tsv, json, html, xml, log, yaml)</li>
            </ul>
          </footer>
        </body>
      </html>
    </ClerkProvider>
  );
}

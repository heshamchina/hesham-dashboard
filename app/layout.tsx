import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "HeshamChina — Command Center",
  description: "Personal command center for Hesham — deals, content, contacts, finance.",
  icons: { icon: "/logo.png" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F0F0F",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans surface-base min-h-screen text-ink-primary antialiased`}>
        {children}
      </body>
    </html>
  )
}

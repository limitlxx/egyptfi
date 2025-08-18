import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import { Toaster } from "react-hot-toast";
import { Providers } from "@/components/providers";
import { NetworkStatusProvider } from "@/components/NetworkStatusProvider";

export const metadata: Metadata = {
  title: 'EgyptFi',
  description: 'Created with Limitlxx'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>
        <NetworkStatusProvider>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </NetworkStatusProvider>
      </body>
    </html>
  )
}

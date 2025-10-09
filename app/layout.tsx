import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "@/components/providers";
import { NetworkStatusProvider } from "@/components/NetworkStatusProvider";
import { ChipiProvider } from "@chipi-stack/nextjs";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "EgyptFi",
  description: "The Future of Decentralized Finance for Merchants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning={true}>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            href="https://fonts.googleapis.com/css2?family=Lexend:wght@100;200;300;400;500;600;700;800;900&family=Lato:wght@100;300;400;700;900&display=swap"
            rel="stylesheet"
          />
          <style>{`
html {
  font-family: 'Lato', sans-serif;
  --font-heading: 'Lexend', sans-serif;
  --font-body: 'Lato', sans-serif;
}
        `}</style>
        </head>
        <body>
          <NetworkStatusProvider>
            <Providers>
              <ChipiProvider>
                {children}
                <Toaster />
              </ChipiProvider>
            </Providers>
          </NetworkStatusProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

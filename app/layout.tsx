import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LayoutWrapper from "./components/LayoutWrapper";
import PWARegister from "./components/PWARegister";
import { ActivityTracker } from "./components/ActivityTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Nuovo export per viewport e themeColor
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export const metadata: Metadata = {
  metadataBase: new URL('https://deepfly.app'),
  title: "Deep - Diventa il protagonista",
  description: "Trasforma i tuoi momenti a scuola in scene da film con l'IA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Deep",
  },
  openGraph: {
    title: "Deep - Trasforma i tuoi POV in Cinema",
    description: "Sei stato invitato ad unirti a Deep!",
    url: "https://deepfly.app/feed",
    siteName: "Deep",
    images: [
      {
        url: "/logo_01.png",
        width: 1200,
        height: 630,
        alt: "Deep Logo",
      },
    ],
    locale: "it_IT",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        
        {/* iOS PWA Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Deep" />
        
        {/* iOS Icons */}
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icon-192x192.png" />
        
        {/* Favicon */}
        <link rel="icon" href="/icon-192x192.png" type="image/png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black`}
      >
        {/* LOGICA "CALAMITA": 
            Questo script viene eseguito immediatamente al caricamento del browser.
            Controlla se c'è un video in sospeso (pending_production) creato nell'ultima ora.
            MODIFICA: Escludiamo esplicitamente la pagina /crea per evitare conflitti durante la generazione.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const pending = localStorage.getItem('pending_production');
                  const path = window.location.pathname;
                  if (pending && !path.startsWith('/finalizzazione') && !path.startsWith('/crea')) {
                    const data = JSON.parse(pending);
                    // Controlliamo che la sessione sia "fresca" (creata meno di 1 ora fa)
                    const isFresh = Date.now() - data.timestamp < 1000 * 60 * 60;
                    if (isFresh && data.category) {
                      window.location.href = '/finalizzazione?category=' + data.category;
                    }
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <PWARegister />
        <ActivityTracker />
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
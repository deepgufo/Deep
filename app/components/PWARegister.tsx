'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    // 1. Registrazione Service Worker (più semplice e universale)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerServiceWorker = async () => {
        try {
          // Registra il file sw.js che deve essere nella cartella /public
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('✅ Service Worker registrato:', registration.scope);
        } catch (error) {
          console.error('❌ Errore SW:', error);
        }
      };

      registerServiceWorker();
    }

    // 2. Gestione Installazione PWA
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      console.log('💾 PWA pronta per essere installata');
      // Qui potresti salvare 'e' in uno stato se avessi un pulsante "Installa"
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return null;
}
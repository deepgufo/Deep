'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashScreen() {
  const router = useRouter();
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    // Mostra lo splash, poi redirect automatico alla pagina principale
    const timer = setTimeout(() => {
      setIsAnimating(false);
      router.push('/crea');
    }, 1500); // 1.5 secondi di permanenza

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0A0A0A]">
      
      {/* Particelle di sfondo molto sottili (opzionali, rimosso il giallo) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-1 h-1 bg-white/10 rounded-full animate-pulse"></div>
        <div className="absolute bottom-32 right-1/4 w-1 h-1 bg-white/10 rounded-full animate-pulse delay-700"></div>
      </div>

      {/* Container Logo e Scritta */}
      <div 
        className={`relative z-10 flex flex-col items-center gap-8 transition-all duration-[1000ms] ease-in-out ${
          isAnimating 
            ? 'scale-100 opacity-100' 
            : 'scale-[1.1] opacity-0'
        }`}
      >
        {/* LOGO DEEP IMAGE */}
        <div className="relative w-32 h-32 md:w-40 md:h-40">
          {/* Effetto bagliore soffuso dietro il logo */}
          <div className="absolute inset-0 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
          
          <img 
            src="/logo_01.png" 
            alt="Deep Logo" 
            className="w-full h-full object-contain relative z-10"
          />
        </div>

        {/* TESTO DEEP */}
        <div className="text-center">
          <h1 className="text-3xl font-light tracking-[0.6em] uppercase text-white ml-[0.6em]">
            Deep
          </h1>
          {/* Linea di decoro minimale */}
          <div className="w-10 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mt-4 mx-auto" />
        </div>
      </div>

      {/* Rimosso il tagline vecchio "Cinema Scuola AI" per pulizia totale */}
    </main>
  );
}
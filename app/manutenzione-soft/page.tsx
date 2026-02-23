'use client';

import React from 'react';
import PageBackground from '../components/PageBackground';
import { Flame, Clock } from 'lucide-react';

export default function ManutenzioneSoftPage() {
  return (
    <PageBackground>
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center px-6 text-center">
        
        {/* Cerchio di luce soffusa dietro al contenuto */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-red-600/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md space-y-8 animate-fadeIn">
          
          {/* ICONA E TITOLO */}
          <div className="space-y-2">
            <div className="flex justify-center">
              <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20 animate-pulse">
                <Flame size={40} className="text-red-500" />
              </div>
            </div>
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase">
              Server in fiamme! 🔥
            </h1>
          </div>

          {/* GIF CONTAINER */}
          <div className="relative aspect-video w-full rounded-[32px] overflow-hidden border-2 border-white/10 shadow-2xl bg-zinc-900">
            {/* ISTRUZIONI GIF: 
                Rinomina la tua gif in 'manutenzione.gif' 
                e caricala nella cartella 'public' del tuo progetto.
            */}
            <img 
              src="/manutenzione.gif" 
              alt="Manutenzione in corso"
              className="w-full h-full object-cover"
            />
            
            {/* Overlay gradiente sulla gif per profondità */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* MESSAGGIO */}
          <div className="space-y-4">
            <p className="text-zinc-300 text-lg font-medium leading-relaxed">
              Avete fuso tutto. Torniamo online appena smette di uscire fumo.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-full">
              <Clock size={14} className="text-yellow-400" />
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">
                Rimanete connessi
              </span>
            </div>
          </div>

        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out forwards;
        }
      `}</style>
    </PageBackground>
  );
}
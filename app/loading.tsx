'use client';

import React from 'react';

export default function Loading() {
  return (
    // Contenitore fisso, nero profondo, sopra ogni altra cosa
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0A0A0A]">
      
      {/* Gruppo centrale: Logo + Scritta */}
      <div className="flex flex-col items-center gap-6">
        
        {/* LOGO DEEP con pulsazione lenta */}
        <div className="w-24 h-24 md:w-32 md:h-32">
          <img
            src="/logo_01.png" 
            alt="Deep Logo"
            className="w-full h-full object-contain animate-deep-pulse"
          />
        </div>

        {/* SCRITTA DEEP */}
        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-light tracking-[0.6em] uppercase text-zinc-100 ml-[0.6em]">
            Deep
          </h1>
          {/* Sottile bagliore sotto la scritta */}
          <div className="w-8 h-[1px] bg-white/20 mt-3 shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
        </div>

      </div>

      <style jsx global>{`
        @keyframes deep-pulse {
          0%, 100% { opacity: 1; transform: scale(1); filter: brightness(1); }
          50% { opacity: 0.7; transform: scale(0.97); filter: brightness(0.8); }
        }
        .animate-deep-pulse {
          animation: deep-pulse 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
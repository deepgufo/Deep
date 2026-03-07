'use client';

import { useState, useEffect } from 'react';
import { Share, PlusSquare, X, ChevronRight, MonitorSmartphone, Sparkles } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [os, setOs] = useState<'ios' | 'android' | 'other'>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // 1. Verifichiamo se l'app è già installata (Standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                         || (window.navigator as any).standalone 
                         || document.referrer.includes('android-app://');

    if (isStandalone) return;

    // 2. Rilevamento OS
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setOs('ios');
    } else if (/android/.test(ua)) {
      setOs('android');
    }

    // 3. Logica Trigger
    const checkTriggers = () => {
      const interactions = parseInt(localStorage.getItem('deep_interactions') || '0');
      
      // BLOCCO 48 ORE RIMOSSO PER SEMPRE: Ora il controllo è puramente sulle interazioni (timer)
      if (interactions >= 3) {
        setShowPrompt(true);
      }
    };

    // Listener per Android (Evento nativo)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      checkTriggers();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // IMPORTANTE: Ascoltiamo i cambiamenti del localStorage lanciati dai timer nel Feed/Finalizzazione
    window.addEventListener('storage', checkTriggers);
    
    // Controllo al caricamento e dopo un breve delay per sicurezza
    checkTriggers();
    const safetyTimeout = setTimeout(checkTriggers, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('storage', checkTriggers);
      clearTimeout(safetyTimeout);
    };
  }, []);

  const closePrompt = () => {
    // Resettiamo il contatore per permettere al timer di ripartire alla prossima sessione
    localStorage.setItem('deep_interactions', '0');
    localStorage.setItem('pwa_prompt_last_shown', Date.now().toString());
    setShowPrompt(false);
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('deep_interactions', '0');
      closePrompt();
    }
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center px-4 pb-10 sm:pb-20 animate-fadeIn">
      {/* Overlay con sfocatura cinematografica */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={closePrompt} />

      <div className="relative w-full max-w-md bg-zinc-900 border border-[#FFCC00]/30 rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-slideUp">
        
        {/* Header con chiusura */}
        <button onClick={closePrompt} className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        <div className="p-8 pt-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-[#FFCC00] rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(255,204,0,0.2)]">
              <img src="/logo_01.png" alt="Deep" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white italic tracking-tighter uppercase">Posto in Prima Fila</h3>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#FFCC00]" />
                <span className="text-[10px] font-bold text-[#FFCC00] uppercase tracking-[0.2em]">Upgrade Esperienza</span>
              </div>
            </div>
          </div>

          <p className="text-zinc-400 text-sm leading-relaxed mb-8">
            Installa <span className="text-white font-bold">Deep</span> sulla tua Home. Accesso immediato, niente barre del browser e anteprime esclusive dei nuovi attori.
          </p>

          {/* TUTORIAL DINAMICO PER iOS */}
          {os === 'ios' ? (
            <div className="space-y-4 bg-black/40 rounded-2xl p-5 border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <Share className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xs text-zinc-300">Tocca il tasto <span className="text-white font-bold">"Condividi"</span> in basso</p>
              </div>
              <div className="h-px bg-white/5 w-full" />
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <PlusSquare className="w-4 h-4 text-white" />
                </div>
                <p className="text-xs text-zinc-300">Seleziona <span className="text-white font-bold">"Aggiungi alla schermata Home"</span></p>
              </div>
            </div>
          ) : (
            /* BOTTONE PER ANDROID */
            <button 
              onClick={handleAndroidInstall}
              className="w-full py-4 bg-[#FFCC00] text-black font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(255,204,0,0.15)]"
            >
              PRENDI IL TUO POSTO <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <p className="text-center mt-6 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
            Installazione rapida • 0MB di spazio
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slideUp {
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { Home, Plus, User, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface BottomNavProps {
  userAvatar?: string | null;
}

export default function BottomNav({ userAvatar: initialAvatar }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Stato per gestire l'avatar dinamicamente
  const [avatar, setAvatar] = useState<string | null>(initialAvatar || null);

  // --- RECUPERO AVATAR DA SUPABASE CON CORREZIONE BUCKET ---
  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data, error } = await supabase
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

          if (data?.avatar_url) {
            // --- LOGICA DI CORREZIONE PERCORSO ---
            // Rimuoviamo ogni riferimento al vecchio bucket 'avatars' e forziamo 'ia-faces'
            const rawUrl = data.avatar_url;
            let finalUrl = rawUrl;

            if (rawUrl.includes('/public/avatars/')) {
              // Se l'URL è completo e contiene 'avatars', lo sostituiamo
              finalUrl = rawUrl.replace('/public/avatars/', '/public/ia-faces/');
            } else if (!rawUrl.startsWith('http')) {
              // Se è un percorso relativo, costruiamo l'URL corretto su ia-faces
              finalUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ia-faces/${rawUrl}`;
            }

            setAvatar(finalUrl);
          }
        }
      } catch (error) {
        console.error('Errore caricamento avatar navbar:', error);
      }
    };

    fetchAvatar();
  }, []);

  // Calcola posizione indicatore oro basandosi sul path - Ora perfettamente centrato su colonne 1/4
  const getIndicatorPosition = () => {
    if (pathname === '/feed') return 'left-[12.5%]';
    if (pathname === '/crea') return 'left-[37.5%]';
    if (pathname === '/cerca') return 'left-[62.5%]';
    if (pathname === '/profilo') return 'left-[87.5%]';
    return 'left-1/2'; 
  };

  // Determina se tab è attivo
  const isActive = (path: string) => pathname === path;

  // Gestisce il click sull'avatar con controllo autenticazione e profilo
  const handleProfileClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    try {
      // Verifica se l'utente ha una sessione attiva
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.user) {
        // Non è loggato → redirect a /auth
        console.log('⚠️ Utente non loggato, redirect a /auth');
        router.push('/auth');
        return;
      }
      
      // È loggato, verifica se ha un profilo
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .single();
      
      if (profileError && profileError.code === 'PGRST116') {
        // Profilo non esiste → redirect a /completamento-profilo
        console.log('⚠️ Profilo non trovato, redirect a /completamento-profilo');
        router.push('/completamento-profilo');
        return;
      }
      
      if (profileError) {
        // Altri errori → redirect a /auth per sicurezza
        console.error('❌ Errore verifica profilo:', profileError);
        router.push('/auth');
        return;
      }
      
      // Tutto ok, vai al profilo
      router.push('/profilo');
      
    } catch (err) {
      console.error('❌ Errore gestione click profilo:', err);
      router.push('/auth');
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[999]">
      {/* Background Grigio Scuro */}
      <div className="relative bg-[#1C1C1C] border-t border-white/5">
        {/* Barra Oro Sliding - Sotto icona attiva */}
        <div
          className={`absolute top-0 ${getIndicatorPosition()} -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-400 transition-all duration-300 ease-out`}
        ></div>

        {/* Icone Navigation - Organizzate in colonne da 1/4 con altezza maggiore e testi */}
        <div className="flex items-center w-full h-[65px] pt-1 pb-2">
          {/* Feed Icon (Casetta - Sinistra) */}
          <Link
            href="/feed"
            className={`w-1/4 flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/feed') ? 'scale-105' : ''
            }`}
            aria-label="Feed Per Te"
          >
            <Home
              className={`w-[18px] h-[18px] transition-colors ${
                isActive('/feed') ? 'text-white' : 'text-white/60'
              }`}
              strokeWidth={isActive('/feed') ? 2.5 : 2}
            />
            <span className={`text-[10px] mt-1 font-medium transition-colors ${
              isActive('/feed') ? 'text-white' : 'text-white/60'
            }`}>
              Film
            </span>
          </Link>

          {/* Create Icon (+) */}
          <Link
            href="/crea"
            className={`w-1/4 flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/crea') ? 'scale-105' : ''
            }`}
            aria-label="Crea Video"
          >
            <Plus
              className={`w-[22px] h-[22px] transition-colors ${
                isActive('/crea') ? 'text-white' : 'text-white/60'
              }`}
              strokeWidth={isActive('/crea') ? 2.5 : 2}
            />
            <span className={`text-[10px] mt-1 font-medium transition-colors ${
              isActive('/crea') ? 'text-white' : 'text-white/60'
            }`}>
              Crea
            </span>
          </Link>

          {/* Search Icon (Lente) */}
          <Link
            href="/cerca"
            className={`w-1/4 flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/cerca') ? 'scale-105' : ''
            }`}
            aria-label="Cerca Utenti"
          >
            <Search
              className={`w-[18px] h-[18px] transition-colors ${
                isActive('/cerca') ? 'text-white' : 'text-white/60'
              }`}
              strokeWidth={isActive('/cerca') ? 2.5 : 2}
            />
            <span className={`text-[10px] mt-1 font-medium transition-colors ${
              isActive('/cerca') ? 'text-white' : 'text-white/60'
            }`}>
              Cerca
            </span>
          </Link>

          {/* Profile Icon (Avatar/User - Destra) */}
          <button
            onClick={handleProfileClick}
            className={`w-1/4 flex flex-col items-center justify-center transition-all duration-200 ${
              isActive('/profilo') ? 'scale-105' : ''
            }`}
            aria-label="Profilo"
          >
            <div
              className={`flex flex-col items-center justify-center w-7 h-7 rounded-full transition-all duration-200 overflow-hidden ${
                isActive('/profilo')
                  ? 'ring-2 ring-yellow-400'
                  : 'ring-1 ring-white/20'
              }`}
            >
              {avatar ? (
                <Image
                  src={avatar}
                  alt="Profilo"
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <User
                    className={`w-[16px] h-[16px] ${
                      isActive('/profilo') ? 'text-white' : 'text-white/60'
                    }`}
                  />
                </div>
              )}
            </div>
            <span className={`text-[10px] mt-1 font-medium transition-colors ${
              isActive('/profilo') ? 'text-white' : 'text-white/60'
            }`}>
              Profilo
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}
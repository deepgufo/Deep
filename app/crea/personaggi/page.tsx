"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type Personaggio = {
  id: number;
  name: string;
  tag: string;
  thumb_url: string;
  gender: string;
};

export default function SceltaPersonaggio() {
  const [personaggi, setPersonaggi] = useState<Personaggio[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('gender')
        .eq('id', user.id)
        .single();
      
      const gender = profile?.gender || 'attore';

      const { data } = await supabase
        .from('personaggi')
        .select('*')
        .eq('gender', gender)
        .order('id', { ascending: true });
      
      if (data) setPersonaggi(data);
      setLoading(false);
    }
    loadData();
  }, [router]);

  const selectCharacter = (p: Personaggio) => {
    localStorage.setItem('selectedCharacter', JSON.stringify(p));
    router.push('/crea');
  };

  const handleRandom = () => {
    if (personaggi.length > 0) {
      const random = personaggi[Math.floor(Math.random() * personaggi.length)];
      selectCharacter(random);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return '';
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/video-clips/${path}`;
  };

  return (
    // 1. BLOCCO TOTALE SCHERMO (Nessuno scroll esterno)
    <div className="fixed inset-0 bg-neutral-950 flex justify-center overflow-hidden font-sans">
      
      {/* 2. STRUTTURA APP MOBILE (Flex Column) */}
      <div className="w-full max-w-md bg-black h-full flex flex-col relative shadow-2xl shadow-yellow-900/20 border-x border-white/5">

        {/* A. HEADER FISSO (Non scrolla) */}
        <div className="flex-none z-50 bg-black/80 backdrop-blur-md px-4 py-4 flex justify-between items-center border-b border-white/10">
          <button 
            onClick={() => router.back()} 
            className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
          >
            Indietro
          </button>
          
          {/* Titolo e Sottotitolo allineati a destra */}
          <div className="flex flex-col items-end">
            <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-500 to-yellow-600 tracking-wider leading-none">
              PERSONAGGI
            </h1>
            <span className="text-[10px] text-white font-medium mt-1 tracking-tight">
              scegli il tuo personaggio per il POV
            </span>
          </div>
          
          <button 
            onClick={handleRandom} 
            className="bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all transform hover:scale-105 shadow-[0_0_15px_rgba(234,179,8,0.4)] ml-2"
          >
            Casuale
          </button>
        </div>

        {/* B. AREA SCROLLABILE (Occupa lo spazio rimanente) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-32 scrollbar-hide">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-yellow-500 text-sm animate-pulse">Caricamento star...</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              {personaggi.map((p) => (
                <div 
                  key={p.id} 
                  onClick={() => selectCharacter(p)} 
                  className="group relative flex flex-col cursor-pointer active:scale-95 transition-transform duration-200"
                >
                  
                  {/* Container Immagine */}
                  <div className="relative w-full aspect-[3/4] mb-3 rounded-2xl p-1 bg-gradient-to-b from-yellow-600/20 to-transparent">
                    {/* Glow Effect al passaggio del mouse */}
                    <div className="absolute inset-0 bg-yellow-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full"></div>
                    
                    <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/10 group-hover:border-yellow-500/60 transition-colors shadow-2xl">
                      <img 
                        src={getImageUrl(p.thumb_url)} 
                        alt={p.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      {/* Fallback */}
                      <div className="hidden w-full h-full flex items-center justify-center bg-gray-900 text-gray-500 text-xs">
                        NO IMG
                      </div>
                      
                      {/* Sfumatura per leggibilità testo */}
                      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
                      
                      {/* Tag sovrapposto in basso a sinistra */}
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-yellow-500/90 rounded text-[10px] font-bold text-black uppercase tracking-wider">
                        {p.tag}
                      </div>
                    </div>
                  </div>

                  {/* Nome Personaggio */}
                  <div className="text-center mt-[-10px] z-10">
                     <h3 className="text-white font-bold text-lg leading-none group-hover:text-yellow-400 transition-colors drop-shadow-md">
                       {p.name}
                     </h3>
                  </div>
                </div>
              ))}
              
              {/* Spazio vuoto finale per non coprire l'ultimo elemento col footer */}
              <div className="h-10 w-full col-span-2"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sparkles, Film, Users, Zap, User, RefreshCw, ArrowLeft } from 'lucide-react'; 
import PageBackground from '../components/PageBackground';

// TIPO PERSONAGGIO
type Personaggio = {
  id: number;
  name: string;
  tag: string;
  thumb_url: string;
  video_url: string;
};

const SINGLE_SUGGESTIONS = [
  { id: 1, text: 'POV: Hai preso 3 alla verifica ma sai già che il tuo video farà più visualizzazioni dello stipendio del prof', emoji: '📉' },
  { id: 2, text: 'POV: La campanella suona e tu scappi via dall\'aula come se avessi appena rapinato una banca', emoji: '🏃‍♂️' },
  { id: 3, text: 'POV: Il prof ti interroga a sorpresa ma tu sei troppo occupato a pensare a cosa mangerai a ricreazione', emoji: '🥪' },
  { id: 4, text: 'POV: Ascolti il compagno "lecchino" che parla con il prof e ti chiedi se vive in una simulazione (è un NPC)', emoji: '🤖' },
  { id: 5, text: 'POV: stai fumando nelle scale del polo ma pullappa Gallo e ti chiede due tiri', emoji: '🚬' },
  { id: 6, text: 'POV: Catania ha pippato tutta la notte e ti mette una nota solo perche è in astinenza', emoji: '👀' },
];

const COUPLE_SUGGESTIONS = [
  { id: 1, text: '❤️ Io e lei come nessuno mai', emoji: '❤️' },
  { id: 2, text: '🚗 Io e il bro abbiamo investito una vecchia', emoji: '🚗' },
  { id: 3, text: '🏃 Noi due contro il mondo in un inseguimento', emoji: '🏃' },
  { id: 4, text: '💰 Io e la mia tipa in una rapina finita male', emoji: '💰' },
  { id: 5, text: '💎 Io e il mio complice dopo il colpo del secolo', emoji: '💎' },
  { id: 7, text: '🏜️ Io e il mio migliore amico dispersi nel deserto', emoji: '🏜️' },
];

const LOADING_MESSAGES = [
  'Corrompendo il regista...',
  'Cucinando i popcorn...',
  'Scrivendo il finale strappalacrime...',
  'Cercando una controfigura economica...',
  'Mettendo in ordine i pixel...',
];

export default function CreaPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isSystemChecking, setIsSystemChecking] = useState(true);
  
  const [isCoupleMode, setIsCoupleMode] = useState(false);
  const [coupleName, setCoupleName] = useState('');

  // STATI PER IL LIMITE GIORNALIERO E INVITI
  const [dailyCount, setDailyCount] = useState(0);
  const [isLimitError, setIsLimitError] = useState(false);
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [lastInviteDate, setLastInviteDate] = useState<string | null>(null);

  // NUOVI STATI PER IL PERSONAGGIO E FACCIA
  const [userFace, setUserFace] = useState<string | null>(null);
  const [selectedChar, setSelectedChar] = useState<Personaggio | null>(null);

  const currentSuggestions = useMemo(() => {
    return isCoupleMode ? COUPLE_SUGGESTIONS : SINGLE_SUGGESTIONS;
  }, [isCoupleMode]);

  useEffect(() => {
    const savedPrompt = localStorage.getItem("tempPrompt");
    if (savedPrompt) setPrompt(savedPrompt);

    const savedChar = localStorage.getItem("selectedCharacter");
    if (savedChar) setSelectedChar(JSON.parse(savedChar));

    setIsGenerating(false);
    
    const checkAuthAndLimits = async () => {
      try {
        const { data: config } = await supabase
          .from('system_config')
          .select('maintenance_mode')
          .eq('id', 1)
          .single();
        
        if (config?.maintenance_mode) {
          router.push('/manutenzione-soft');
          return;
        }
      } catch (err) {
        console.error("Errore controllo manutenzione", err);
      }
      setIsSystemChecking(false);

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        
        const { data: profile } = await supabase
          .from('profiles')
          .select('daily_video_count, last_video_date, ia_face_url, last_invite_date')
          .eq('id', session.user.id)
          .single();

        // --- FORZATURA NUCLEARE BUCKET ia-faces ---
        if (profile?.ia_face_url) {
            const rawValue = profile.ia_face_url;
            const cleanPath = rawValue
                .replace(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`, '')
                .replace(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ia-faces/`, '')
                .replace('avatars/', '')
                .replace('ia-faces/', '');
            
            const forcedFaceUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ia-faces/${cleanPath}`;
            setUserFace(forcedFaceUrl);
        } else {
            setUserFace(null);
        }

        const today = new Date().toISOString().split('T')[0];
        if (profile?.last_video_date === today) {
          setDailyCount(profile.daily_video_count || 0);
        } else {
          setDailyCount(0);
        }

        if (profile?.last_invite_date) {
          setLastInviteDate(profile.last_invite_date);
        }
      }
    };
    
    checkAuthAndLimits();
  }, [router]);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
    }, 800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handlePromptChange = (val: string) => {
      setPrompt(val);
      localStorage.setItem("tempPrompt", val);
      setSelectedId(null);
  };

  const handlePillClick = (text: string, id: number) => {
    handlePromptChange(text);
    setSelectedId(id);
  };

  const getCharImageUrl = (path: string) => {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/video-clips/${path}`;
  };

  const goToSelection = () => {
    localStorage.setItem("tempPrompt", prompt);
    router.push("/crea/personaggi");
  };

  // LOGICA RESET ORE 08:00 PER INVITO
  const canUseInvite = useMemo(() => {
    if (!lastInviteDate) return true;
    
    const now = new Date();
    const lastInvite = new Date(lastInviteDate);
    
    // Calcoliamo l'ultimo reset point (le 8 di stamattina o di ieri)
    const lastReset = new Date();
    lastReset.setHours(8, 0, 0, 0);
    
    if (now < lastReset) {
      // Se non sono ancora le 8, il reset valido è quello di ieri alle 8
      lastReset.setDate(lastReset.getDate() - 1);
    }
    
    return lastInvite < lastReset;
  }, [lastInviteDate]);

  const handleInviteAction = async () => {
    if (!canUseInvite) {
      alert("Hai già sbloccato i video per oggi! Torna domani dopo le 08:00.");
      return;
    }

    const message = "sei stato invitato ad unirti a deep, o ne vuoi restare furoi? https://deepfly.app/feed";
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ 
            daily_video_count: 2, 
            last_invite_date: new Date().toISOString() 
          })
          .eq('id', user.id);
        
        if (!error) {
          setDailyCount(2);
          setLastInviteDate(new Date().toISOString());
          setShowInvitePopup(false);
        }
      }
    } catch (err) {
      console.error("Errore sblocco:", err);
    }
  };

  // --- LOGICA DI GENERAZIONE ---
  const handleGenerateFilm = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();

    if (!isLoggedIn || !session || !user) {
      setShowAuthPrompt(true);
      setTimeout(() => setShowAuthPrompt(false), 4000);
      return;
    }

    // CONTROLLO LIMITE VIDEO (3/3)
    if (dailyCount >= 3) {
      setShowInvitePopup(true);
      return;
    }

    if (!prompt.trim()) {
      alert('Scrivi prima cosa vuoi creare! ✍️');
      return;
    }

    if (isCoupleMode && !coupleName.trim()) {
      alert('Inserisci il nome del tuo complice! 👥');
      return;
    }

    if (!selectedChar) {
        goToSelection();
        return;
    }

    if (!userFace) {
        alert("Non hai una foto profilo! Vai a caricarla.");
        router.push("/completamento-profilo");
        return;
    }

    try {
      localStorage.removeItem('pending_production');
      localStorage.removeItem('predictionId');

      setIsGenerating(true);

      const targetVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/video-clips/${selectedChar.video_url}`;

      const response = await fetch("/api/face-swap", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          videoUrl: targetVideoUrl,
          faceUrl: userFace,
          prompt: prompt,
          userId: user.id
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Errore generazione");

      const sessionData = {
        videoUrl: targetVideoUrl,
        initialPrompt: prompt,
        category: selectedChar.tag.replace('#', ''),
        timestamp: Date.now()
      };
      localStorage.setItem('pending_production', JSON.stringify(sessionData));

      localStorage.removeItem("tempPrompt");
      localStorage.setItem("predictionId", data.id);
      
      router.push(`/finalizzazione?category=${selectedChar.tag.replace('#','')}&prompt=${encodeURIComponent(prompt)}`);

    } catch (error) {
      console.error('❌ Errore:', error);
      setIsGenerating(false);
      alert('C\'è stato un problema durante la creazione. Riprova!');
    }
  };

  const toggleCoupleMode = () => {
    setIsCoupleMode(!isCoupleMode);
    setSelectedId(null);
    if (!isCoupleMode) setCoupleName('');
  };

  const isPromptReady = prompt.length >= 10;

  if (isSystemChecking) {
    return <div className="h-[100dvh] w-full bg-[#0A0A0A]" />;
  }

  return (
    <PageBackground>
      <div className={`h-[100dvh] w-full bg-[#0A0A0A] text-white font-sans overflow-hidden flex flex-col px-4 pt-10 pb-6 relative transition-all duration-500 ${showInvitePopup ? 'blur-xl scale-[0.95]' : ''}`}>
        
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#2A0845] opacity-20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-10%] w-[60vw] h-[60vw] bg-[#001B3A] opacity-30 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-md mx-auto h-full flex flex-col justify-between">
          
          <div className="flex-shrink-0 animate-fadeIn relative flex justify-between items-center mb-4">
            
            <button
              onClick={toggleCoupleMode}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-300 border ${
                isCoupleMode
                  ? 'bg-[#FFCC00]/10 border-[#FFCC00] shadow-[0_0_10px_rgba(255,204,0,0.2)]'
                  : 'bg-[#1A1A1A] border-zinc-800 hover:bg-[#1F2937]'
              }`}
            >
              <Users className={`w-3.5 h-3.5 ${isCoupleMode ? 'text-[#FFCC00]' : 'text-gray-400'}`} />
              <span className={`text-[11px] font-bold tracking-wide ${isCoupleMode ? 'text-[#FFCC00]' : 'text-gray-400'}`}>
                {isCoupleMode ? 'COPPIA' : 'COPPIA'}
              </span>
            </button>

            <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] border border-[#FFCC00] rounded-full shadow-[0_0_15px_rgba(255,204,0,0.15)] animate-floating">
              <Zap className="w-3.5 h-3.5 text-[#FFCC00] fill-[#FFCC00]" />
              <span className="text-[12px] font-bold text-white mt-[1px]">
                {Math.max(0, 3 - dailyCount)}/3
              </span>
            </div>
          </div>

          <div className="text-center animate-fadeIn mb-4">
            <h1 className="text-[26px] sm:text-[28px] font-extrabold text-[#FFFFFF] tracking-tight leading-tight">
              Trasforma il tuo POV<br/>in Cinema
            </h1>
          </div>

          <div className="flex-shrink-0 flex flex-col gap-2.5 animate-fadeIn delay-200">
            <p className="text-[13px] font-medium text-[#9CA3AF] text-left pl-1">
              Droppa la hit del giorno e l&apos;IA lo trasforma in un film
            </p>

            <div className="relative rounded-[24px] p-[1px] bg-gradient-to-br from-[#FFD700] to-transparent shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
              <div className="relative w-full h-[105px] bg-[#000000]/80 backdrop-blur-[10px] rounded-[23px] overflow-hidden flex flex-col">
                <textarea
                  value={prompt}
                  onChange={(e) => handlePromptChange(e.target.value)}
                  placeholder="Scrivi la tua pazzia qui..."
                  className="w-full h-full bg-transparent border-none px-4 py-3.5 text-white placeholder-[#4B5563] focus:outline-none resize-none text-[15px] leading-relaxed"
                  maxLength={150}
                />
                <div className="absolute bottom-2 right-4 text-[#4B5563] text-[9px] font-bold">
                  {prompt.length}/150
                </div>
              </div>
            </div>

            {isCoupleMode && (
              <div className="animate-fadeIn">
                <input
                  type="text"
                  value={coupleName}
                  onChange={(e) => setCoupleName(e.target.value)}
                  placeholder="Nome del tuo complice..."
                  className="w-full bg-[#1F2937]/40 border border-zinc-800 rounded-[18px] px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-all text-[14px]"
                />
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center animate-fadeIn delay-300 mt-4 mb-4">
            <div className="grid grid-cols-2 gap-3 h-full max-h-[190px]">
              {currentSuggestions.slice(0, 3).map((suggestion, index) => (
                <button
                  key={`${isCoupleMode ? 'couple' : 'single'}-${suggestion.id}`}
                  onClick={() => handlePillClick(suggestion.text, suggestion.id)}
                  className={`group relative flex flex-col justify-center items-center p-3 bg-[#1F2937]/40 backdrop-blur-md rounded-[24px] border border-transparent transition-all duration-300 overflow-hidden text-center hover:shadow-[0_0_15px_rgba(255,204,0,0.4)] hover:border-[#FFCC00]/50 ${
                    index === 2 ? 'col-span-2' : 'col-span-1'
                  } ${
                    selectedId === suggestion.id 
                    ? 'shadow-[0_0_15px_rgba(255,204,0,0.6)] border-[#FFCC00] bg-[#1F2937]/70' 
                    : ''
                  }`}
                >
                  <span className="absolute top-2 right-3 text-[18px] drop-shadow-lg group-hover:scale-110 transition-transform opacity-50 group-hover:opacity-100">
                    {suggestion.emoji}
                  </span>
                  <p className={`text-[11px] font-medium leading-[1.4] w-full px-2 mt-3 line-clamp-3 ${selectedId === suggestion.id ? 'text-[#FFCC00]' : 'text-gray-300'}`}>
                    {suggestion.text.replace('POV:', '').trim()}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-shrink-0 flex flex-col items-center pb-8 pt-0 relative z-20 gap-3">
            
            <div className="absolute bottom-[130px] w-full flex flex-col items-center gap-2 pointer-events-none z-30">
              {isLimitError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-xl text-xs font-bold animate-fadeIn">
                  🚫 Limite giornaliero raggiunto (3/3)
                </div>
              )}
              
              {showAuthPrompt && (
                <div className="bg-[#FFCC00] text-black px-4 py-2 rounded-xl text-xs font-bold shadow-[0_0_15px_rgba(255,204,0,0.5)] animate-fadeIn">
                  Effettua il login per creare!
                </div>
              )}
            </div>

            {selectedChar && !isGenerating && (
                 <div onClick={goToSelection} className="w-[85%] bg-[#1F2937]/60 border border-[#FFCC00] rounded-[18px] p-2 flex items-center gap-3 cursor-pointer hover:bg-[#1F2937] transition-all relative group shadow-[0_0_10px_rgba(255,204,0,0.1)]">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-[#FFCC00]/50 flex-shrink-0">
                        <img src={getCharImageUrl(selectedChar.thumb_url)} alt="char" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start">
                        <span className="text-[9px] text-[#FFCC00] font-bold uppercase tracking-wide leading-none">{selectedChar.tag}</span>
                        <span className="text-white text-[13px] font-bold truncate leading-tight">{selectedChar.name}</span>
                    </div>
                    <div className="mr-2 text-gray-400">
                        <RefreshCw className="w-4 h-4 group-hover:text-[#FFCC00] transition-colors" />
                    </div>
                 </div>
            )}

            <button
              onClick={handleGenerateFilm}
              disabled={isGenerating}
              className={`w-[85%] relative inline-flex items-center justify-center h-[48px] bg-[#FFCC00] text-[#000000] font-extrabold text-[13px] tracking-widest rounded-[18px] transition-all duration-300 disabled:cursor-not-allowed ${
                isGenerating 
                  ? 'opacity-70 cursor-wait' 
                  : (isPromptReady || dailyCount >= 3)
                    ? 'opacity-100 shadow-[0_0_20px_rgba(255,204,0,0.5)] animate-pulse-glow hover:scale-[1.02] active:scale-[0.98]' 
                    : 'opacity-40'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2 relative z-10"></div>
                  <span className="relative z-10 text-[12px] normal-case">{LOADING_MESSAGES[loadingMessageIndex]}</span>
                </>
              ) : (
                <>
                  {selectedChar ? (
                      <Film className="w-4 h-4 mr-2 relative z-10" />
                  ) : (
                      <User className="w-4 h-4 mr-2 relative z-10" />
                  )}
                  <span className="relative z-10 font-sans tracking-wide">
                      {dailyCount >= 3 ? 'SBLOCCA VIDEO' : selectedChar ? 'GENERA FILM' : 'SCEGLI PERSONAGGIO'}
                  </span>
                  {(isPromptReady && dailyCount < 3) && <Sparkles className="w-4 h-4 ml-2 relative z-10" />}
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* POP-UP INVITO AMICO (BOTTOM SHEET) */}
      {showInvitePopup && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInvitePopup(false)} />
          
          <div className="relative w-full max-w-md bg-[#1A1A1A] border-t border-[#FFCC00]/40 rounded-t-[40px] px-8 pt-16 pb-12 shadow-[0_-20px_50px_rgba(0,0,0,1)] animate-slideUp">
            
            <button 
              onClick={() => setShowInvitePopup(false)}
              className="absolute top-6 left-8 text-gray-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            <div className="text-center space-y-6">
              <div className="inline-flex p-4 bg-[#FFCC00]/10 rounded-full border border-[#FFCC00]/20">
                <Zap className="w-8 h-8 text-[#FFCC00]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Set al completo!</h3>
                <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                  Invita un amico sul set per sbloccare altri <span className="text-[#FFCC00]">2 video gratis</span> e continuare a girare.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleInviteAction}
                  className="w-full py-5 border-2 border-[#FFCC00] text-[#FFCC00] font-black rounded-2xl active:scale-95 transition-all shadow-[0_0_30px_rgba(255,204,0,0.1)] uppercase tracking-widest text-sm"
                >
                  Invita un amico
                </button>
                <p className="mt-6 text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">
                  Il reset avviene ogni mattina alle 08:00
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
        }

        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slideUp {
          animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes floating {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
          100% { transform: translateY(0px); }
        }
        .animate-floating {
          animation: floating 3s ease-in-out infinite;
        }

        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(255,204,0,0.3); transform: scale(1); }
          50% { box-shadow: 0 0 20px rgba(255,204,0,0.6); transform: scale(1.02); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 2s infinite ease-in-out;
        }
      `}</style>
    </PageBackground>
  );
}
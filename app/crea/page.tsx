'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Sparkles, Film, Users, Zap, User, RefreshCw, ArrowLeft, Camera, ShieldAlert, X, Loader2 } from 'lucide-react'; 
import PageBackground from '../components/PageBackground';
import { validateFaceImage } from '@/utils/faceValidation';

// TIPO PERSONAGGIO
type Personaggio = {
  id: number;
  name: string;
  tag: string;
  thumb_url: string;
  video_url: string;
};

// --- NUOVI TIPI ---
type Maschera = {
  id: number;
  name: string;
  image_url: string;
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

  // --- STATI E REFS PER IL POPUP FOTO IA ---
  const [showFacePopup, setShowFacePopup] = useState(false);
  const iaFaceInputRef = useRef<HTMLInputElement>(null);
  const [iaFacePreview, setIaFacePreview] = useState<string | null>(null);
  const [selectedIaFaceFile, setSelectedIaFaceFile] = useState<File | null>(null);
  const [isFaceLoading, setIsFaceLoading] = useState(false);
  const [faceLoadingMessage, setFaceLoadingMessage] = useState('');
  const [faceError, setFaceError] = useState('');
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isFallbackActive, setIsFallbackActive] = useState(false);

  // --- NUOVI STATI MASCHERE ---
  const [maschere, setMaschere] = useState<Maschera[]>([]);
  const [isMaschereLoading, setIsMaschereLoading] = useState(true);

  // --- STATO POP-UP REGISTRAZIONE ---
  const [showAuthModal, setShowAuthModal] = useState(false);

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

  // --- EFFETTO DELAY PER POP-UP REGISTRAZIONE ---
  useEffect(() => {
    if (!isSystemChecking && !isLoggedIn) {
      const timer = setTimeout(() => {
        setShowAuthModal(true);
      }, 6000); // 6 secondi di delay
      return () => clearTimeout(timer);
    }
  }, [isSystemChecking, isLoggedIn]);

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prevIndex) => (prevIndex + 1) % LOADING_MESSAGES.length);
    }, 800);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // --- NUOVO EFFETTO FETCH MASCHERE ---
  useEffect(() => {
    if (!showFacePopup) return;
    const fetchMaschere = async () => {
      setIsMaschereLoading(true);
      try {
        const { data, error } = await supabase
          .from('maschere')
          .select('*')
          .eq('is_active', true)
          .order('id', { ascending: true })
          .limit(9); // Griglia 3x3 potenziale
        if (error) throw error;
        setMaschere(data || []);
      } catch (err) {
        console.error("Errore fetch maschere:", err);
      } finally {
        setIsMaschereLoading(false);
      }
    };
    fetchMaschere();
  }, [showFacePopup]);

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

  // --- LOGICA FOTO IA (DAL VECCHIO COMPLETAMENTO PROFILO) ---
  const calculateBrightness = (imageFile: File): Promise<{ brightness: number, img: HTMLImageElement, canvas: HTMLCanvasElement }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context non disponibile'));
            return;
          }
          
          const scale = Math.min(400 / img.width, 400 / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            totalBrightness += brightness;
          }
          
          const averageBrightness = totalBrightness / (data.length / 4);
          resolve({ brightness: averageBrightness, img, canvas });
        };
        
        img.onerror = () => reject(new Error('Errore caricamento immagine'));
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => reject(new Error('Errore lettura file'));
      reader.readAsDataURL(imageFile);
    });
  };

  const handleIaFaceClick = () => {
    iaFaceInputRef.current?.click();
  };

  const handleIaFaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setFaceError('Seleziona un file immagine');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setFaceError('L\'immagine deve essere inferiore a 5MB');
        return;
      }

      try {
        setIsFaceLoading(true);
        setFaceLoadingMessage('Analisi biometrica...');
        setIsFaceDetected(false);
        setIsFallbackActive(false);

        const { brightness, img, canvas } = await calculateBrightness(file);
        
        if (brightness < 45) {
          setFaceError('⚠️ Foto troppo scura! Spostati in un punto più illuminato.');
          setIaFacePreview(null);
          setSelectedIaFaceFile(null);
          setIsFaceLoading(false);
          return; 
        }

        const validationPromise = validateFaceImage(img, canvas);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), 5000)
        );

        try {
          const validation = await Promise.race([validationPromise, timeoutPromise]) as { valid: boolean; error?: string };
          
          if (!validation.valid) {
            setFaceError(`⚠️ ${validation.error}`);
            setIaFacePreview(null);
            setSelectedIaFaceFile(null);
            setIsFaceLoading(false);
            return;
          }
          setIsFaceDetected(true);
        } catch (err: any) {
          if (err.message === 'TIMEOUT') {
            setIsFallbackActive(true);
            setIsFaceDetected(true);
          } else {
            throw err;
          }
        }
        
        setSelectedIaFaceFile(file);
        setFaceError('');
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setIaFacePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setIsFaceLoading(false);

        // Tracciamento aggiunto come nel vecchio file
        try {
          const { data: { session } } = await supabase.auth.getSession();
          let funnelSid = localStorage.getItem('funnel_sid');
          if (funnelSid) {
            await supabase.from('funnel_events').insert({
              step_name: 'photo_added',
              user_id: session?.user?.id || null,
              session_id: funnelSid
            });
          }
        } catch (e) { }
        
      } catch (err) {
        console.error('Errore validazione:', err);
        setFaceError('Errore durante l\'analisi. Riprova.');
        setIsFaceLoading(false);
      }
    }
  };

  const handleSaveFaceAndGenerate = async () => {
    if (!selectedIaFaceFile) {
      setFaceError('⚠️ È obbligatorio scattare la foto per procedere.');
      return; 
    }

    setIsFaceLoading(true);
    setFaceLoadingMessage('Salvataggio identità...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Errore di sessione');

      const userId = session.user.id;
      const iaExt = selectedIaFaceFile.name.split('.').pop();
      const iaFileName = `${userId}/ia-face-${Date.now()}.${iaExt}`;
      
      const { error: iaUploadError } = await supabase.storage
        .from('ia-faces')
        .upload(iaFileName, selectedIaFaceFile, { cacheControl: '3600', upsert: true });

      if (iaUploadError) throw new Error(`Errore caricamento: ${iaUploadError.message}`);
      
      const { data: iaUrlData } = supabase.storage.from('ia-faces').getPublicUrl(iaFileName);
      const newIaFaceUrl = iaUrlData.publicUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ ia_face_url: newIaFaceUrl })
        .eq('id', userId);

      if (profileError) throw new Error(`Errore database: ${profileError.message}`);

      // Imposta lo stato per by-passare il controllo
      setUserFace(newIaFaceUrl);
      setShowFacePopup(false);
      setIsFaceLoading(false);

      // Fa partire direttamente la generazione!
      handleGenerateFilmWithFace(newIaFaceUrl);
      
    } catch (err: any) {
      console.error("Errore salvataggio faccia:", err);
      setFaceError(err.message || 'Errore imprevisto durante il salvataggio');
      setIsFaceLoading(false);
    }
  };

  // --- NUOVA LOGICA SELEZIONE MASCHERA ---
  const handleMaskSelection = (maskUrl: string) => {
    setShowFacePopup(false);
    handleGenerateFilmWithFace(maskUrl);
  };

  // Logica spezzata per permettere al popup di passare l'URL fresco
  const handleGenerateFilm = async () => {
    // 1. Permettiamo a TUTTI di scegliere il personaggio (anche non loggati)
    if (!selectedChar) {
        goToSelection();
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();

    // MODIFICA: Ora apre il grande modale di registrazione invece del piccolo prompt
    if (!isLoggedIn || !session || !user) {
      setShowAuthModal(true);
      return;
    }

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

    // IL BIVIO JUST-IN-TIME
    if (!userFace) {
        setShowFacePopup(true);
        return;
    }

    handleGenerateFilmWithFace(userFace);
  };

  const handleGenerateFilmWithFace = async (faceUrlToUse: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      localStorage.removeItem('pending_production');
      localStorage.removeItem('predictionId');

      setIsGenerating(true);

      // LOGICA 70/30: Scelta 30% video.mp4 e 70% video_02.mp4
      const useSecondClip = Math.random() < 0.7;
      const finalVideoPath = useSecondClip 
        ? selectedChar!.video_url.replace('video.mp4', 'video_02.mp4') 
        : selectedChar!.video_url;

      const targetVideoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/video-clips/${finalVideoPath}`;

      const response = await fetch("/api/face-swap", {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          videoUrl: targetVideoUrl,
          faceUrl: faceUrlToUse,
          prompt: prompt,
          userId: session.user.id
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Errore generazione");

      const sessionData = {
        videoUrl: targetVideoUrl,
        initialPrompt: prompt,
        category: selectedChar!.tag.replace('#', ''),
        timestamp: Date.now()
      };
      localStorage.setItem('pending_production', JSON.stringify(sessionData));

      localStorage.removeItem("tempPrompt");
      localStorage.setItem("predictionId", data.id);
      
      router.push(`/finalizzazione?category=${selectedChar!.tag.replace('#','')}&prompt=${encodeURIComponent(prompt)}`);

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

  // --- NUOVA LOGICA CHIUSURA POPUP FACCIA ---
  const closeFacePopup = () => {
    setShowFacePopup(false);
    setIsGenerating(false);
    // Resettiamo lo stato biometrico se chiudono il popup a metà
    setIaFacePreview(null);
    setSelectedIaFaceFile(null);
    setFaceError('');
    setIsFaceDetected(false);
  };

  const isPromptReady = prompt.length >= 10;

  if (isSystemChecking) {
    return <div className="h-[100dvh] w-full bg-[#0A0A0A]" />;
  }

  return (
    <PageBackground>
      <div className={`h-[100dvh] w-full bg-[#0A0A0A] text-white font-sans overflow-hidden flex flex-col px-4 pt-6 pb-8 relative transition-all duration-500 ${(showInvitePopup || showFacePopup || showAuthModal) ? 'blur-xl scale-[0.95]' : ''}`}>
        
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#2A0845] opacity-20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-10%] w-[60vw] h-[60vw] bg-[#001B3A] opacity-30 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 w-full max-md mx-auto h-full flex flex-col justify-between">
          
          <div className="flex-shrink-0 animate-fadeIn relative flex justify-between items-center mb-3">
            
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

          <div className="text-center animate-fadeIn mb-3">
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
                  placeholder="Scrivi il tuo POV del giorno qui..."
                  className="w-full h-full bg-transparent border-none px-4 py-3.5 text-white placeholder-[#4B5563] focus:outline-none resize-none text-[15px] leading-relaxed"
                  maxLength={150}
                />
                <div className="absolute bottom-2 right-4 text-[#4B5563] text-[9px] font-bold">
                  {prompt.length}/150
                </div>
              </div>
            </div>

            {/* Il campo coupleName viene rimosso visivamente per far spazio al messaggio "in arrivo" */}
            {isCoupleMode && null}
          </div>

          <div className="flex-1 flex flex-col justify-center animate-fadeIn delay-300 mt-2 mb-6">
            {!isCoupleMode ? (
              <>
                <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-2 pl-1">POV di esempio:</p>
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
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-6 bg-[#1F2937]/20 border border-yellow-400/10 rounded-[32px] backdrop-blur-md text-center">
                <span className="text-4xl mb-4 animate-bounce">🔥</span>
                <h2 className="text-white font-black text-xl uppercase tracking-tighter leading-tight">
                  funzione in arrivo..<br/>
                  <span className="text-[#FFCC00] text-sm tracking-widest font-bold">rimanete connessi!!</span>
                </h2>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 flex flex-col items-center pb-12 pt-0 relative z-20 gap-3">
            
            <div className="absolute bottom-[150px] w-full flex flex-col items-center gap-2 pointer-events-none z-30">
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
              disabled={isGenerating || isCoupleMode}
              className={`w-[85%] relative inline-flex items-center justify-center h-[48px] bg-[#FFCC00] text-[#000000] font-extrabold text-[13px] tracking-widest rounded-[18px] transition-all duration-300 disabled:cursor-not-allowed ${
                isGenerating || isCoupleMode
                  ? 'opacity-40 cursor-not-allowed' 
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
                      {isCoupleMode ? 'NON DISPONIBILE' : dailyCount >= 3 ? 'SBLOCCA VIDEO' : selectedChar ? 'GENERA FILM' : 'SCEGLI PERSONAGGIO'}
                  </span>
                  {(isPromptReady && dailyCount < 3 && !isCoupleMode) && <Sparkles className="w-4 h-4 ml-2 relative z-10" />}
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* POP-UP IDENTITA IA (PRIMO VIDEO) - NUOVA STRUTTURA A BIVIO */}
      {showFacePopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={closeFacePopup} />
          
          <div className="relative w-full max-w-[360px] bg-[#0A0A0A] border border-white/10 rounded-[32px] p-6 shadow-2xl animate-slideUp flex flex-col items-center max-h-[90dvh] overflow-y-auto custom-scrollbar">
            
            <button 
              onClick={closeFacePopup}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* SEZIONE 1: SCELTA INIZIALE O BIOMETRIA */}
            {!selectedIaFaceFile ? (
                // --- SCENARIO A: BIVIO DI SCELTA ---
                <div className="w-full flex flex-col items-center animate-fadeIn">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-3 mt-4">
                        <User className="w-6 h-6 text-purple-400" />
                    </div>

                    <h3 className="text-xl font-extrabold text-white mb-6 uppercase tracking-tight">Scegli il Protagonista</h3>

                    {/* PRIMO BOTTONE: CARICA LA TUA FACCIA (COMPATTO E VIOLA) */}
                    <button
                        type="button"
                        onClick={handleIaFaceClick}
                        className="w-full py-4 mb-8 rounded-2xl bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 hover:border-purple-500 flex flex-col items-center justify-center gap-1 transition-all duration-300 active:scale-95"
                    >
                        <span className="text-sm font-black text-purple-400 uppercase tracking-widest">Usa la tua faccia</span>
                    </button>

                    {/* SEPARATORE */}
                    <div className="w-full flex items-center gap-3 mb-6">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest whitespace-nowrap">oppure scegli una maschera</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* GRIGLIA MASCHERE PREPARATE (3 COLONNE) */}
                    {isMaschereLoading ? (
                        <div className="flex items-center justify-center h-48 w-full">
                            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3 w-full mb-2">
                            {maschere.map((mask) => (
                                <button
                                    key={mask.id}
                                    onClick={() => handleMaskSelection(mask.image_url)}
                                    className="relative aspect-[3/4] rounded-xl border border-white/10 overflow-hidden hover:border-[#FFCC00]/50 transition-colors group"
                                >
                                    <img 
                                        src={mask.image_url} 
                                        alt={mask.name} 
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
                                    <span className="absolute bottom-2 left-2 right-2 text-[9px] font-bold text-white truncate text-left leading-tight">{mask.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {maschere.length === 0 && !isMaschereLoading && (
                        <p className="text-[10px] text-zinc-600 py-6">Nessuna maschera disponibile.</p>
                    )}
                </div>
            ) : (
                // --- SCENARIO B: LOGICA BIOMETRICA ESISTENTE (DOPO SCATTO) ---
                <div className="w-full flex flex-col items-center animate-fadeIn">
                    <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center mb-4 mt-2">
                      <Camera className="w-6 h-6 text-purple-400" />
                    </div>

                    <p className="text-sm text-white text-center mb-4 leading-relaxed font-medium">
                      Verifica il selfie. Sarà il tuo pass universale per ogni POV della scuola. Fallo bene una volta.
                    </p>
                    <p className="text-[11px] text-zinc-400 text-center mb-4 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10">
                      💡 <span className="font-bold text-yellow-400">Regola d'oro:</span> Una foto chiara, da solo e ben illuminata garantisce un Face-Swap da paura. Niente occhiali, niente distrazioni.
                    </p>
                    <p className="text-[11px] text-red-500 font-bold text-center mb-6 px-2">
                      La tua faccia è al sicuro. Usiamo la Foto AI solo per creare il tuo video.
                    </p>

                    <div className="w-full flex flex-col items-center mb-6">
                      <div className="relative mb-2">
                        <div className={`absolute -inset-2 border-2 rounded-xl pointer-events-none transition-all duration-500 ${
                          isFaceDetected 
                            ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                            : 'border-purple-400/30'
                        }`} />
                        
                        <button
                          type="button"
                          onClick={handleIaFaceClick}
                          className="relative w-20 h-28 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group overflow-hidden"
                        >
                          {iaFacePreview && (
                            <img 
                              src={iaFacePreview} 
                              alt="IA Face preview" 
                              className="w-full h-full object-cover"
                            />
                          )}
                        </button>
                      </div>

                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-[10px] font-bold tracking-wider ${isFaceDetected ? 'text-green-400 animate-pulse' : 'text-zinc-500'}`}>
                          {isFaceDetected ? 'VISO RILEVATO' : 'ERRORE RILEVAMENTO'}
                        </span>
                        {isFallbackActive && (
                          <span className="text-[8px] text-orange-400 flex items-center gap-1 mt-1">
                            <ShieldAlert size={10} /> Qualità bassa, ci proviamo
                          </span>
                        )}
                      </div>
                    </div>

                    {faceError && (
                      <div className="w-full mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <p className="text-[10px] text-red-400 text-center font-bold">
                          {faceError}
                        </p>
                      </div>
                    )}

                    <div className="w-full flex gap-3 mt-2">
                        <button
                            onClick={() => {
                                setSelectedIaFaceFile(null);
                                setIaFacePreview(null);
                                setFaceError('');
                            }}
                            className="flex-1 py-4 bg-zinc-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-300 active:scale-95"
                        >
                            Riprova
                        </button>
                        <button
                          onClick={handleSaveFaceAndGenerate}
                          disabled={isFaceLoading || !selectedIaFaceFile || (!isFaceDetected && !isFallbackActive)}
                          className="flex-[2] py-4 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all duration-300 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500 active:scale-95 flex items-center justify-center"
                        >
                          {isFaceLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {faceLoadingMessage}
                            </>
                          ) : (
                            'Continua'
                          )}
                        </button>
                    </div>
                </div>
            )}
  
              <input
                ref={iaFaceInputRef}
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleIaFaceChange}
                className="hidden"
              />

          </div>
        </div>
      )}

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

      {/* MODALE: REGISTRAZIONE (FLASH AUTH - DELAY 6 SECONDI O TENTATIVO CREAZIONE) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setShowAuthModal(false)} />
          
          <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl p-8 flex flex-col items-center text-center">
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="w-16 h-16 bg-[#FFCC00]/10 rounded-full flex items-center justify-center mb-6">
              <Film className="w-8 h-8 text-[#FFCC00]" />
            </div>

            <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tighter italic">
              Il regista sei tu! 🎬
            </h3>
            
            <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-8">
              Per dare vita alla tua prima hit AI e sbloccare tutte le maschere leggendarie, devi registrarti. Ci metti meno di un intervallo!
            </p>

            <button
              onClick={() => router.push('/auth')}
              className="w-full py-5 bg-[#FFCC00] text-black font-black rounded-2xl active:scale-95 transition-all shadow-[0_0_30px_rgba(255,204,0,0.2)] uppercase tracking-widest text-sm"
            >
              SBLOCCA LA CREAZIONE
            </button>

            <button 
              onClick={() => setShowAuthModal(false)}
              className="mt-6 text-[10px] font-bold text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors"
            >
              Continua a esplorare
            </button>
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

        /* NUOVA ANIMAZIONE PULSAZIONE LENTA BORDORATO */
        @keyframes pulse-glow-slow {
          0%, 100% { box-shadow: 0 0 15px rgba(255,204,0,0.15); border-color: rgba(255,204,0,0.8); }
          50% { box-shadow: 0 0 25px rgba(255,204,0,0.3); border-color: rgba(255,204,0,1); }
        }
        .animate-pulse-glow-slow {
          animation: pulse-glow-slow 3s infinite ease-in-out;
        }

        /* STILE SCROLLBAR SOTTILE */
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </PageBackground>
  );
}
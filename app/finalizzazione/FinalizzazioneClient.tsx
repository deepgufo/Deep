'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Film, Download, Share2, RotateCcw, Edit2, Play, Pause, AlertCircle, Sparkles, Wand2, ChevronUp, Lock, Globe, ArrowLeft } from 'lucide-react';
import PageBackground from '../components/PageBackground';
import { supabase } from '@/lib/supabase';

export default function FinalizzazioneClient({ 
  videoUrl: propVideoUrl, 
  initialPrompt, 
  category 
}: { 
  videoUrl: string; 
  initialPrompt: string; 
  category: string;
}) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // --- FRENO A MANO ANTI-DUPLICATO ---
  const hasStartedRequest = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(initialPrompt);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showIcon, setShowIcon] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');

  // Gestiamo il videoUrl internamente per permettere il recupero da localStorage
  const [currentVideoUrl, setCurrentVideoUrl] = useState(propVideoUrl);

  // Stati per la gestione della pubblicazione
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [loadingMessage, setLoadingMessage] = useState("L'IA sta studiando i tuoi lineamenti...");
  const messages = [
    "Analisi dei tratti somatici in corso...",
    "Sincronizzazione dei movimenti del volto...",
    "Applicazione luci cinematografiche...",
    "Rendering dei fotogrammi finali...",
    "Quasi pronto: il tuo debutto è vicino!"
  ];

  // --- FUNZIONE DI TRACCIAMENTO SATISFACTION FUNNEL ---
  const trackSatisfactionEvent = async (eventName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let funnelSid = localStorage.getItem('funnel_sid');
      if (!funnelSid) {
        funnelSid = Math.random().toString(36).substring(7);
        localStorage.setItem('funnel_sid', funnelSid);
      }
      await supabase.from('funnel_events').insert({
        step_name: eventName,
        user_id: session?.user?.id || null,
        session_id: funnelSid
      });
    } catch (err) {
      console.error('Errore tracciamento evento:', err);
    }
  };

  // --- RECUPERO USERNAME ---
  useEffect(() => {
    const fetchUsername = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();
        if (data?.username) {
          setUsername(data.username);
        }
      }
    };
    fetchUsername();
  }, []);

  // --- LOGICA DI PERSISTENZA ---
  useEffect(() => {
    if (propVideoUrl && propVideoUrl !== "undefined" && propVideoUrl !== "") {
      const sessionData = {
        videoUrl: propVideoUrl,
        finalVideoUrl: finalVideoUrl, 
        initialPrompt,
        category,
        timestamp: Date.now()
      };
      localStorage.setItem('pending_production', JSON.stringify(sessionData));
      
      if (initialPrompt && initialPrompt !== "Il mio Film") {
        setEditedPrompt(initialPrompt);
      }
    } else {
      const saved = localStorage.getItem('pending_production');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Date.now() - parsed.timestamp < 1000 * 60 * 60 * 2) { 
          setCurrentVideoUrl(parsed.videoUrl);
          
          if (parsed.initialPrompt && parsed.initialPrompt !== "") {
            setEditedPrompt(parsed.initialPrompt);
          }

          if (parsed.finalVideoUrl) {
            setFinalVideoUrl(parsed.finalVideoUrl);
            setIsLoading(false);
            setProgress(100);
          }
        }
      }
    }
  }, [propVideoUrl, initialPrompt, category, finalVideoUrl]);

  const clearPendingSession = () => {
    localStorage.removeItem('pending_production');
    localStorage.removeItem('predictionId');
  };

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let msgInterval: NodeJS.Timeout;
    let msgIndex = 0;

    msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % messages.length;
      setLoadingMessage(messages[msgIndex]);
    }, 4000);

    const startFaceSwap = async () => {
      if (hasStartedRequest.current) return;

      if (finalVideoUrl) {
        hasStartedRequest.current = true;
        return;
      }

      const storedPredictionId = localStorage.getItem('predictionId');

      if (!storedPredictionId) {
        console.log("⏱️ Nessun ID produzione trovato. Attendo o Errore.");
        if (!currentVideoUrl) {
           setError("Dati mancanti per avviare la produzione.");
           setIsLoading(false);
        }
        return; 
      }

      hasStartedRequest.current = true;
      trackSatisfactionEvent('video_start');

      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error("Sessione non valida. Effettua nuovamente il login.");
        }

        console.log("--- RIPRESA PRODUZIONE DA ID ESISTENTE: ", storedPredictionId);
        
        const predictionId = storedPredictionId;
        setProgress(10);

        pollInterval = setInterval(async () => {
          try {
            const checkRes = await fetch(`/api/face-swap?id=${predictionId}&t=${Date.now()}`);
            if (!checkRes.ok) {
                const errData = await checkRes.json();
                throw new Error(errData.error || "Errore di connessione al server.");
            }

            const prediction = await checkRes.json();
            console.log("Stato Replicate:", prediction.status);

            if (prediction.status === 'succeeded') {
              clearInterval(pollInterval);
              clearInterval(msgInterval);
              
              setTimeout(() => {
                setFinalVideoUrl(prediction.output);
                setProgress(100);
                setIsLoading(false);
                trackSatisfactionEvent('video_ready');
              }, 1500);
              
            } else if (prediction.status === 'failed') {
              throw new Error(prediction.error || "L'elaborazione cinematografica non è andata a buon fine.");
            } else if (prediction.status === 'starting') {
              setProgress((prev) => (prev < 15 ? prev + 1 : prev));
            } else if (prediction.status === 'processing') {
              setProgress((prev) => {
                if (prev < 30) return prev + 3; 
                if (prev < 85) return prev + 2; 
                if (prev < 98) return prev + 0.5;
                return prev;
              });
            }
          } catch (pollErr: any) {
             console.error("Polling Error:", pollErr);
             setError(pollErr.message);
             clearInterval(pollInterval);
             clearInterval(msgInterval);
             setIsLoading(false);
             hasStartedRequest.current = false;
          }
        }, 3000);

      } catch (err: any) {
        console.error("ERRORE CRITICO:", err);
        setError(err.message);
        setIsLoading(false);
        hasStartedRequest.current = false;
        
        await supabase.from('debug_logs').insert([{
          device_info: navigator.userAgent,
          error_message: "Client Error: " + err.message,
          context: "FinalizzazioneClient_Start"
        }]);
      }
    };

    startFaceSwap();

    return () => { 
      if (pollInterval) clearInterval(pollInterval); 
      if (msgInterval) clearInterval(msgInterval);
    };
  }, [currentVideoUrl, finalVideoUrl]); 

  const handlePublishAction = async (status: 'pubblico' | 'privato') => {
    if (!finalVideoUrl) return;
    setIsPublishing(true);
    setShowPublishMenu(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessione scaduta, effettua nuovamente il login");

      let schoolName = null;
      try {
        const { data: userData, error: userError } = await supabase
          .from('profiles') 
          .select('school_name')
          .eq('id', session.user.id)
          .single();
        
        if (!userError && userData) {
          schoolName = userData.school_name;
        }
      } catch (fetchError) {
        console.error("Impossibile recuperare school_name:", fetchError);
      }

      const response = await fetch('/api/save-video', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          videoUrl: finalVideoUrl,
          status: status,
          category: category,
          prompt: editedPrompt || initialPrompt,
          school_name: schoolName 
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Errore durante il salvataggio sul server");
      }

      if (status === 'pubblico') {
        trackSatisfactionEvent('video_published');
      } else {
        trackSatisfactionEvent('video_saved_private');
      }

      clearPendingSession();

      if (status === 'pubblico') {
        router.push('/feed');
      } else {
        router.push('/profilo?tab=provini');
      }

    } catch (err: any) {
      alert("Errore durante il salvataggio: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setShowIcon(true);
      setTimeout(() => setShowIcon(false), 800);
    }
  };

  // --- LOGICA WATERMARK CON USERNAME ---
  const getWatermarkedBlob = async (videoUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("Canvas context non disponibile");

        const stream = canvas.captureStream(30);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));

        recorder.start();

        const drawFrame = () => {
          if (video.ended || video.paused) {
            recorder.stop();
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Ombra per rendere il testo leggibile su ogni sfondo
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 10;

          // DISEGNO WATERMARK "DEEP"
          ctx.font = `bold ${canvas.width * 0.05}px sans-serif`;
          ctx.fillStyle = "#FFCC00";
          ctx.textAlign = "right";
          ctx.fillText("DEEP", canvas.width - 25, canvas.height - 55);
          
          // DISEGNO @USERNAME
          ctx.font = `bold ${canvas.width * 0.035}px sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fillText(`@${username || 'user'}`, canvas.width - 25, canvas.height - 25);
          
          requestAnimationFrame(drawFrame);
        };

        drawFrame();
      };
      
      video.onerror = () => reject("Errore caricamento video per watermark");
    });
  };

  const handleDownloadVideo = async () => {
    trackSatisfactionEvent('video_downloaded');
    const targetUrl = finalVideoUrl || currentVideoUrl;
    if (!targetUrl) return;

    try {
      const blob = await getWatermarkedBlob(targetUrl);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `deep_film_${category}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(targetUrl, '_blank');
    }
  };

  const handleShare = async () => {
    trackSatisfactionEvent('video_shared');
    const targetUrl = finalVideoUrl || currentVideoUrl;

    if (!targetUrl) return;

    try {
      const blob = await getWatermarkedBlob(targetUrl);
      const file = new File([blob], `deep_film_${category}.mp4`, { type: 'video/mp4' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Guarda il mio film su Deep!',
          text: `Ho creato questo film con Cinema Scuola.`,
        });
      } 
      else if (navigator.share) {
        await navigator.share({
          title: 'Guarda il mio film!',
          url: targetUrl,
          text: `Ho creato un film "${editedPrompt}" con Cinema Scuola.`,
        });
      } 
      else {
        throw new Error("Condivisione non supportata");
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(targetUrl);
        alert("Link copiato negli appunti! 📋");
      } catch (copyErr) {
        console.error('Errore condivisione:', err);
      }
    }
  };

  return (
    <PageBackground>
      <div className="h-[100dvh] overflow-hidden flex items-start justify-center px-4 pt-6">
        <div className="w-full max-md mx-auto relative">
          
          {error ? (
            <div className="text-center pt-20 animate-fadeIn bg-black/40 p-6 rounded-3xl border border-red-500/30 backdrop-blur-md">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-white font-bold mb-2">Ops! Qualcosa è andato storto</h3>
              <p className="text-gray-400 text-sm mb-6">{error}</p>
              <button 
                onClick={() => {
                  if (error.toLowerCase().includes("faccia") || error.toLowerCase().includes("foto")) {
                    clearPendingSession();
                    router.push('/completamento-profilo');
                  } else {
                    router.push('/crea');
                  }
                }} 
                className="w-full py-3 bg-yellow-400 text-black font-bold rounded-xl active:scale-95 transition-all"
              >
                {error.toLowerCase().includes("faccia") ? "Carica Foto" : "Torna alla Creazione"}
              </button>
            </div>
          ) : isLoading ? (
            <div className="text-center animate-fadeIn pt-10">
              <div className="relative w-48 h-48 mx-auto mb-8">
                <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-[50px] animate-pulse" />
                <div className="relative flex items-center justify-center h-full bg-black/60 rounded-full border-2 border-yellow-400/30 overflow-hidden">
                    <Wand2 className="w-16 h-16 text-yellow-400 animate-bounce" />
                    <Sparkles className="absolute top-4 right-4 w-6 h-6 text-yellow-200 animate-ping" />
                    <Sparkles className="absolute bottom-6 left-8 w-4 h-4 text-yellow-500 animate-pulse delay-700" />
                </div>
              </div>

              <div className="space-y-2 mb-8 px-6">
                <h2 className="text-white font-bold text-lg leading-tight">{loadingMessage}</h2>
                <p className="text-gray-500 text-xs font-medium">L'IA sta generando il tuo capolavoro...</p>
              </div>

              <div className="px-10">
                <div className="relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-yellow-600 transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Rendering</span>
                  <span className="text-[10px] text-yellow-400 font-black">{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-fadeIn space-y-3">
              <div className="w-full">
                {isEditingText ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedPrompt}
                      maxLength={500}
                      onChange={(e) => setEditedPrompt(e.target.value)}
                      className="w-full bg-black/60 border-2 border-yellow-400/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setIsEditingText(false)} className="px-3 py-1 text-xs text-gray-300">Annulla</button>
                      <button onClick={() => setIsEditingText(false)} className="px-3 py-1 text-xs bg-yellow-400 text-black font-semibold rounded-lg">Salva</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-xl">
                    <p className="text-white text-sm leading-relaxed italic font-light">
                      &quot;{editedPrompt || initialPrompt}&quot;
                    </p>
                  </div>
                )}
              </div>

              {!isEditingText && (
                <button onClick={() => setIsEditingText(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 text-xs bg-zinc-800/50 rounded-md hover:bg-zinc-800 transition-colors">
                  <Edit2 className="w-3 h-3" /> Modifica Testo
                </button>
              )}

              <div 
                onClick={togglePlay}
                className="relative w-full aspect-square rounded-[32px] overflow-hidden border-2 border-white/20 shadow-2xl bg-black cursor-pointer group"
              >
                {finalVideoUrl ? (
                  <video
                    key="final-video"
                    ref={videoRef}
                    src={finalVideoUrl}
                    playsInline
                    loop
                    className="w-full h-full object-cover"
                    onLoadedData={() => videoRef.current?.play().catch(() => {})}
                  />
                ) : (
                  <video
                    key="preview-video"
                    ref={videoRef}
                    src={currentVideoUrl}
                    autoPlay
                    loop
                    playsInline
                    muted 
                    className="w-full h-full object-cover"
                  />
                )}
                
                <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none ${showIcon || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                  <div className="bg-black/40 backdrop-blur-md p-5 rounded-full border border-white/20">
                    {isPlaying ? <Pause className="w-10 h-10 text-white fill-white" /> : <Play className="w-10 h-10 text-white fill-white" />}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 relative z-20">
                <div className="relative">
                  <button 
                    onClick={() => setShowPublishMenu(!showPublishMenu)}
                    disabled={isPublishing}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-yellow-400 text-black font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-yellow-400/20"
                  >
                    <Film className="w-5 h-5" /> 
                    {isPublishing ? "Salvataggio..." : "Pubblica"}
                    <ChevronUp className={`w-4 h-4 transition-transform ${showPublishMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {showPublishMenu && (
                    <div className="absolute bottom-full left-0 w-full mb-3 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-fadeIn z-50">
                      <button 
                        onClick={() => handlePublishAction('pubblico')}
                        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-yellow-400/10 border-b border-zinc-800 transition-colors"
                      >
                        <Globe className="w-5 h-5 text-yellow-400" />
                        <div className="text-left">
                          <p className="text-white text-sm font-extrabold uppercase tracking-tight">Pubblica</p>
                          <p className="text-yellow-400/60 text-[10px] font-bold">In Oro nel Feed</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => handlePublishAction('privato')}
                        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/5 transition-colors"
                      >
                        <Lock className="w-5 h-5 text-zinc-500" />
                        <div className="text-left">
                          <p className="text-white text-sm font-extrabold uppercase tracking-tight">Provini</p>
                          <p className="text-zinc-500 text-[10px] font-bold">Privato (Grigio)</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 py-4 bg-zinc-900 border border-white/10 text-white font-bold rounded-2xl active:scale-95 transition-all"
                >
                  <Share2 className="w-5 h-5" /> Condividi
                </button>
              </div>

              <div className="border-t border-zinc-800 my-2" />

              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleDownloadVideo} className="flex items-center justify-center gap-1.5 px-3 py-2 bg-black/40 border border-zinc-700 text-gray-300 text-xs rounded-lg active:scale-95">
                  <Download className="w-3.5 h-3.5" /> Scarica
                </button>
                <button 
                  onClick={() => {
                    clearPendingSession();
                    router.push('/crea');
                  }} 
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-black/40 border border-zinc-700 text-gray-300 text-xs rounded-lg active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Nuovo Take
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageBackground>
  );
}
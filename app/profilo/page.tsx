'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Camera, 
  X, 
  Upload, 
  User as UserIcon, 
  Menu, 
  LogOut, 
  Home, 
  Film, 
  Lock, 
  Globe, 
  Settings, 
  ChevronLeft, 
  Play, 
  Trash2, 
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  Monitor,
  Smartphone,
  Download,
  Share2,
  MoreVertical,
  Globe2,
  Sparkles,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import Image from 'next/image';
import { validateFaceImage } from '@/utils/faceValidation';

// --- INTERFACCE E TIPI ---
interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  ia_face_url: string | null;
  username: string;
  bio: string | null;
  gender: string;
  total_oscar_received?: number; // Integrato per conteggio globale
}

interface Video {
  id: string;
  video_url: string;
  caption: string; // Allineato a public_videos (mappato da prompt per privati)
  status: 'pubblico' | 'privato';
  oscar_count?: number;
  has_user_liked?: boolean; // Stato per il like locale
  created_at: string;
}

/**
 * COMPONENTE CONTENUTO PROFILO
 * Contiene tutta la logica originale integrata con la visualizzazione TikTok-style per i video pubblici.
 */
function ProfiloContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const menuRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const feedVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  
  // --- STATI PRINCIPALI ---
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // --- STATI VIDEO ---
  const [videos, setVideos] = useState<Video[]>([]);
  const [activeTab, setActiveTab] = useState<'film' | 'provini'>('film');
  const [isLoadingVideos, setIsLoadingVideos] = useState(true);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [pausedVideos, setPausedVideos] = useState<Set<string>>(new Set());
  
  // --- STATI FOLLOWER ---
  const [followerCount, setFollowerCount] = useState(0);

  // --- STATI MODIFICA PROFILO ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // --- STATI FOTO AI (LOGICA CREA) ---
  const iaFaceInputRef = useRef<HTMLInputElement>(null);
  const [iaFacePreview, setIaFacePreview] = useState<string | null>(null);
  const [selectedIaFaceFile, setSelectedIaFaceFile] = useState<File | null>(null);
  const [isFaceLoading, setIsFaceLoading] = useState(false);
  const [faceLoadingMessage, setFaceLoadingMessage] = useState('');
  const [faceError, setFaceError] = useState('');
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  
  // --- STATI UI AGGIUNTIVI ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // --- STATO INSTALLAZIONE PWA ---
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // --- STATO ANIMAZIONE VOLO ---
  const [isFlyingId, setIsFlyingId] = useState<string | null>(null);

  // --- LOGICA DI NAVIGAZIONE E URL ---
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'provini') {
      setActiveTab('provini');
    } else {
      setActiveTab('film');
    }
  }, [searchParams]);

  const handleTabChange = (newTab: 'film' | 'provini') => {
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', newTab);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // --- CONTROLLO AMBIENTE PER TASTO INSTALLA ---
  useEffect(() => {
    const checkInstallation = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                            || (window.navigator as any).standalone;
      
      const ua = window.navigator.userAgent.toLowerCase();
      const isMobile = /iphone|ipad|ipod|android/.test(ua);

      // Mostra il tasto solo se è su mobile e NON è già installata
      if (isMobile && !isStandalone) {
        setShowInstallBtn(true);
      }
    };

    checkInstallation();
  }, []);

  const triggerInstallPopup = () => {
    // Settiamo le interazioni a 3 per forzare il componente PWAInstallPrompt nel layout a svegliarsi
    localStorage.setItem('deep_interactions', '3');
    // Lanciamo l'evento storage per comunicare con il componente globale
    window.dispatchEvent(new Event('storage'));
  };

  // --- CARICAMENTO INIZIALE DATI ---
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        console.log('🔄 Avvio caricamento dati profilo e video...');
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError || !session?.user) {
          console.warn('⚠️ Sessione non valida o scaduta');
          router.push('/auth');
          return;
        }
        
        const userId = session.user.id;
        setCurrentUserId(userId);
        console.log('✅ Utente autenticato:', userId);

        const profilePromise = supabase
          .from('profiles')
          .select('id, full_name, avatar_url, ia_face_url, username, bio, gender, total_oscar_received')
          .eq('id', userId)
          .single();

        // Recupero video pubblici (con Oscar e Caption)
        const publicVideoPromise = supabase
          .from('public_videos')
          .select('id, video_url, caption, oscar_count, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        // Recupero video privati (da tabella films)
        const privateVideoPromise = supabase
          .from('films')
          .select('id, video_url, prompt, status, created_at')
          .eq('user_id', userId)
          .eq('status', 'privato')
          .order('created_at', { ascending: false });

        const [profileRes, publicRes, privateRes] = await Promise.all([
          profilePromise, 
          publicVideoPromise, 
          privateVideoPromise
        ]);

        if (!isMounted) return;

        if (profileRes.data) {
          setProfile(profileRes.data);
        }

        // Mappatura video pubblici con controllo Like/Oscar
        const mappedPublic = await Promise.all((publicRes.data || []).map(async v => {
          let hasUserLiked = false;
          if (userId) {
            const { data: likeData } = await supabase
              .from('likes')
              .select('id')
              .eq('film_id', v.id)
              .eq('user_id', userId)
              .maybeSingle();
            hasUserLiked = !!likeData;
          }
          return {
            ...v,
            status: 'pubblico' as const,
            has_user_liked: hasUserLiked
          };
        }));

        // Mappatura video privati
        const mappedPrivate = (privateRes.data || []).map(v => ({
          ...v,
          caption: v.prompt, // Mappiamo prompt a caption per coerenza overlay
          oscar_count: 0,
          has_user_liked: false,
          status: 'privato' as const
        }));

        setVideos([...mappedPublic, ...mappedPrivate]);

        // Carica conteggio follower reale
        const { count: totalFollowers } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId);

        if (totalFollowers !== null) {
          setFollowerCount(totalFollowers);
          console.log(`✅ Follower: ${totalFollowers}`);
        }

      } catch (err) {
        console.error('❌ Errore durante init:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsLoadingVideos(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [router]);

  // --- LOGICA FOTO AI (REPLICATA DA CREA) ---
  const calculateBrightness = (imageFile: File): Promise<{ brightness: number, img: HTMLImageElement, canvas: HTMLCanvasElement }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Canvas context non disponibile')); return; }
          const scale = Math.min(400 / img.width, 400 / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
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

  const handleIaFaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) { setFaceError('Seleziona un file immagine'); return; }
      if (file.size > 5 * 1024 * 1024) { setFaceError('L\'immagine deve essere inferiore a 5MB'); return; }
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
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 5000));
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
          if (err.message === 'TIMEOUT') { setIsFallbackActive(true); setIsFaceDetected(true); } else { throw err; }
        }
        setSelectedIaFaceFile(file);
        setFaceError('');
        const reader = new FileReader();
        reader.onloadend = () => { setIaFacePreview(reader.result as string); };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Errore validazione:', err);
        setFaceError('Errore durante l\'analisi. Riprova.');
      } finally {
        setIsFaceLoading(false);
      }
    }
  };

  // --- GESTIONE MODIFICA PROFILO ---
  const openEditModal = () => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditBio(profile.bio || '');
      setEditUsername(profile.username || '');
      setEditAvatarPreview(profile.avatar_url);
      setIaFacePreview(profile.ia_face_url);
      setFaceError('');
      setIsFaceDetected(false);
      setIsEditModalOpen(true);
    }
  };

  const closeEditModal = () => {
    if (isSavingProfile) return;
    setIsEditModalOpen(false);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
    setSelectedIaFaceFile(null);
    setIaFacePreview(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("L'immagine è troppo grande. Massimo 5MB.");
        return;
      }
      setEditAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sessione mancante");

      const userId = session.user.id;
      let avatarUrl = profile.avatar_url;
      let iaFaceUrl = profile.ia_face_url;

      // 1. Upload Avatar Normale
      if (editAvatarFile) {
        const fileExt = editAvatarFile.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, editAvatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = urlData.publicUrl;
      }

      // 2. Upload Foto AI (Se cambiata)
      if (selectedIaFaceFile) {
        const iaExt = selectedIaFaceFile.name.split('.').pop();
        const iaFileName = `${userId}/ia-face-${Date.now()}.${iaExt}`;
        const { error: iaUploadError } = await supabase.storage
          .from('ia-faces')
          .upload(iaFileName, selectedIaFaceFile, { cacheControl: '3600', upsert: true });
        if (iaUploadError) throw iaUploadError;
        const { data: iaUrlData } = supabase.storage.from('ia-faces').getPublicUrl(iaFileName);
        iaFaceUrl = iaUrlData.publicUrl;
      }

      const updatedData = {
        id: userId,
        full_name: editName,
        bio: editBio,
        username: editUsername,
        avatar_url: avatarUrl,
        ia_face_url: iaFaceUrl,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updatedData);

      if (updateError) throw updateError;

      setProfile({
        ...profile,
        full_name: editName,
        bio: editBio,
        username: editUsername,
        avatar_url: avatarUrl,
        ia_face_url: iaFaceUrl,
      });

      setFeedbackMessage({ type: 'success', text: 'Profilo aggiornato!' });
      setTimeout(() => setFeedbackMessage(null), 3000);
      closeEditModal();

    } catch (error: any) {
      console.error('Errore salvataggio:', error);
      alert(`Errore: ${error.message || 'Impossibile salvare'}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // --- GESTIONE VIDEO (FIXED DELETE WITH MODAL) ---
  const handleDeleteVideo = async (videoId: string) => {
    try {
      // 1. Tentativo di eliminazione reale sul database (entrambe le tabelle)
      const { error: errorPublic } = await supabase.from('public_videos').delete().eq('id', videoId);
      const { error: errorFilms } = await supabase.from('films').delete().eq('id', videoId);

      // Se entrambi restituiscono errore (es. RLS bloccata), segnaliamo il fallimento
      if (errorPublic && errorFilms) {
        throw new Error("Il database ha rifiutato l'eliminazione. Controlla i permessi.");
      }

      // 2. Aggiorniamo lo stato locale solo dopo la conferma del DB
      setVideos(prev => prev.filter(v => v.id !== videoId));
      
      if (selectedVideoIndex !== null) {
        if (videos.length <= 1) {
          closeFeedView();
        } else {
          setSelectedVideoIndex(prev => (prev! > 0 ? prev! - 1 : 0));
        }
      }

      setShowDeleteConfirm(null);
      setFeedbackMessage({ type: 'success', text: 'Video eliminato' });
      
      // 3. IMPORTANTISSIMO: Forza Next.js a rinfrescare i dati server-side
      router.refresh();

      setTimeout(() => setFeedbackMessage(null), 2000);
    } catch (err: any) {
      console.error('❌ Errore eliminazione:', err);
      alert(err.message || "Errore durante l'eliminazione");
    }
  };

  // --- LOGICA RENDI PUBBLICO ---
  const handleMakePublic = async (video: Video) => {
    if (video.status !== 'privato') return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sessione scaduta");

      // Attiviamo l'animazione del volo
      setIsFlyingId(video.id);

      // 1. Inseriamo in public_videos
      const { error: insertError } = await supabase
        .from('public_videos')
        .insert({
          video_url: video.video_url,
          caption: video.caption,
          user_id: session.user.id
        });

      if (insertError) throw insertError;

      // 2. Eliminiamo da films
      const { error: deleteError } = await supabase
        .from('films')
        .delete()
        .eq('id', video.id);

      if (deleteError) throw deleteError;

      // 3. Aggiorniamo stato locale dopo un breve delay per l'animazione
      setTimeout(() => {
        setVideos(prev => prev.map(v => 
          v.id === video.id ? { ...v, status: 'pubblico', oscar_count: 0, has_user_liked: false } : v
        ));
        setIsFlyingId(null);
        setFeedbackMessage({ type: 'success', text: 'Video pubblicato nel Feed!' });
        router.refresh(); // Sincronizza cache server
      }, 800);

      setTimeout(() => setFeedbackMessage(null), 3000);
      
    } catch (err) {
      console.error(err);
      setIsFlyingId(null);
      alert("Errore durante la pubblicazione");
    }
  };

  // --- GESTIONE OSCAR (LIKE) ---
  const handleOscarToggle = async (postId: string) => {
    if (!currentUserId) {
      alert('Devi effettuare il login per mettere l\'Oscar!');
      router.push('/auth');
      return;
    }

    const post = videos.find((v) => v.id === postId);
    if (!post || post.status !== 'pubblico') return;

    const wasLiked = post.has_user_liked;
    
    // Aggiornamento ottimistico dello stato locale
    setVideos((prev) =>
      prev.map((v) =>
        v.id === postId
          ? {
              ...v,
              has_user_liked: !wasLiked,
              oscar_count: wasLiked ? (v.oscar_count || 1) - 1 : (v.oscar_count || 0) + 1
            }
          : v
      )
    );

    try {
      // Chiamata alla funzione RPC su Supabase
      const { data, error } = await supabase.rpc('toggle_oscar', { 
        target_video_id: postId 
      });

      if (error) throw error;

      // Sincronizziamo il conteggio reale ritornato dal server
      if (data && typeof data.new_count === 'number') {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === postId ? { ...v, oscar_count: data.new_count } : v
          )
        );
      }
    } catch (error) {
      console.error('❌ Errore Oscar:', error);
      // Rollback in caso di fallimento
      setVideos((prev) =>
        prev.map((v) =>
          v.id === postId
            ? { 
                ...v, 
                has_user_liked: wasLiked, 
                oscar_count: wasLiked ? (v.oscar_count || 0) + 1 : (v.oscar_count || 1) - 1 
              }
            : v
        )
      );
    }
  };

  const toggleVideoPlayback = (id: string) => {
    const video = videoRefs.current[id];
    if (video) {
      if (video.paused) {
        video.play();
      } else {
        video.pause();
      }
    }
  };

  // --- GESTIONE FEED OVERLAY (TikTok Style) ---
  const openFeedView = (index: number) => {
    setSelectedVideoIndex(index);
    document.body.style.overflow = 'hidden';
  };

  const closeFeedView = () => {
    setSelectedVideoIndex(null);
    document.body.style.overflow = 'auto';
  };

  const handleFeedVideoClick = (videoId: string) => {
    const video = feedVideoRefs.current[videoId];
    if (!video) return;

    if (video.paused) {
      video.play();
      setPausedVideos((prev) => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    } else {
      video.pause();
      setPausedVideos((prev) => {
        const newSet = new Set(prev);
        newSet.add(videoId);
        return newSet;
      });
    }
  };

  const handleShare = async (video: Video) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Film di ${profile?.full_name}`,
          text: video.caption,
          url: video.video_url
        });
      } catch (err) {}
    } else {
      await navigator.clipboard.writeText(video.video_url);
      alert('Link copiato negli appunti!');
    }
  };

  // --- LOGICA UI ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const filteredVideos = videos.filter(v => 
    activeTab === 'film' ? v.status === 'pubblico' : v.status === 'privato'
  );

  // --- RENDER LOADING ---
  if (isLoading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-yellow-400 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="mt-6 text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">
          Loading Cinematic Profile
        </p>
      </div>
    );
  }

  // --- RENDER NO PROFILE ---
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black px-6 text-center">
        <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800">
          <AlertCircle className="w-10 h-10 text-zinc-600" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Accesso Negato</h2>
        <p className="text-zinc-400 mb-8 max-w-xs">Non abbiamo trovato i dati del tuo profilo.</p>
        <button
          onClick={() => router.push('/completamento-profilo')}
          className="w-full max-w-xs bg-yellow-400 text-black py-4 rounded-xl font-bold hover:bg-yellow-300 transition-all active:scale-95"
        >
          CREA PROFILO ORA
        </button>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 bg-black text-white font-sans selection:bg-yellow-400/30">
      {/* FEEDBACK OVERLAY */}
      {feedbackMessage && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[5000] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce ${
          feedbackMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
          <span className="font-bold text-sm uppercase">{feedbackMessage.text}</span>
        </div>
      )}

      <div className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
        {/* TOP BAR E NAVBAR */}
        <header className="sticky top-0 z-[100] bg-black/95 backdrop-blur-xl border-b border-zinc-900">
          <div className="max-w-2xl mx-auto flex items-center justify-between px-5 py-4">
            <button 
              onClick={() => router.push('/crea')}
              className="p-2 text-zinc-400 hover:text-yellow-400 transition-all duration-300 active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            {/* BOTTONE INSTALLA - DESIGN PREMIUM PILLOLA */}
            {showInstallBtn && (
              <button
                onClick={triggerInstallPopup}
                className="px-4 py-1.5 rounded-full border-2 border-[#D4AF37] bg-black text-white text-[11px] font-black uppercase tracking-tighter shadow-[0_0_20px_rgba(212,175,55,0.2)] active:scale-95 transition-all animate-fadeIn"
              >
                Installa l&apos;app
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-zinc-400 hover:text-yellow-400 transition-all duration-300 active:scale-95"
              >
                <Menu className="w-6 h-6" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden animate-fadeIn">
                  <button 
                    onClick={() => {
                      setIsMenuOpen(false);
                      openEditModal();
                    }} 
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-yellow-400/10 transition-colors border-b border-zinc-800"
                  >
                    <Settings className="w-5 h-5 text-yellow-400" />
                    <span className="text-sm font-bold text-white">Modifica Profilo</span>
                  </button>
                  <button 
                    onClick={async () => {
                      await supabase.auth.signOut();
                      router.push('/auth');
                    }}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-sm font-bold">Esci</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* HERO SECTION PROFILO */}
        <section className="relative pt-8 pb-6 px-5">
          <div className="max-w-2xl mx-auto flex flex-col items-center">
            
            <div className="group relative mb-6">
              <div className="absolute inset-0 bg-yellow-400 rounded-full blur-[60px] opacity-30 group-hover:opacity-50 transition-opacity duration-500"></div>
              <div className="relative w-32 h-32 rounded-full p-[3px] bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-[0_0_40px_rgba(250,204,21,0.4)]">
                <div className="w-full h-full rounded-full bg-black overflow-hidden relative">
                  {profile.avatar_url ? (
                    <Image 
                      src={profile.avatar_url} 
                      alt="Profile" 
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      priority
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                      <UserIcon className="w-14 h-14 text-zinc-700" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white mb-2 text-center">{profile.full_name}</h1>
            <div className="flex items-center gap-3 mb-6">
              <span className="text-zinc-400 text-sm">@{profile.username}</span>
              <div className="w-px h-4 bg-zinc-700"></div>
              <span className="text-zinc-500 text-sm capitalize">{profile.gender || 'Attrice'}</span>
            </div>

            <button
              onClick={openEditModal}
              className="w-full max-w-md px-6 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm font-semibold hover:bg-zinc-800 transition-all active:scale-[0.98]"
            >
              Modifica Profilo
            </button>

            <div className="w-full max-w-md grid grid-cols-3 gap-0 bg-black border border-zinc-900 rounded-2xl overflow-hidden my-6">
              <div className="py-5 flex flex-col items-center border-r border-zinc-900">
                <p className="text-2xl font-bold text-yellow-400 mb-1">{videos.filter(v => v.status === 'pubblico').length}</p>
                <p className="text-xs text-zinc-500 font-semibold">Film</p>
              </div>
              <div className="py-5 flex flex-col items-center border-r border-zinc-900">
                <p className="text-2xl font-bold text-white mb-1">{followerCount}</p>
                <p className="text-xs text-zinc-500 font-semibold">Follower</p>
              </div>
              <div className="py-5 flex flex-col items-center">
                <p className="text-2xl font-bold text-white mb-1">{profile.total_oscar_received || 0} 🏆</p>
                <p className="text-xs text-zinc-500 font-semibold">Oscar</p>
              </div>
            </div>

            {profile.bio && (
              <p className="text-zinc-400 text-sm text-center leading-relaxed max-w-md mb-6">{profile.bio}</p>
            )}
          </div>
        </section>

        {/* SEZIONE VIDEO - TABS INTERFACE */}
        <section className="bg-zinc-950/50 min-h-screen">
          <div className="max-w-2xl mx-auto">
            <div className="flex sticky top-[73px] z-[90] bg-black/95 backdrop-blur-xl border-b border-zinc-900">
              <button 
                onClick={() => handleTabChange('film')}
                className={`flex-1 py-5 flex items-center justify-center gap-2.5 transition-all relative ${
                  activeTab === 'film' ? 'text-yellow-400' : 'text-zinc-600'
                }`}
              >
                <span className="text-xs font-black uppercase tracking-[0.3em]">FILM 🎬</span>
                {activeTab === 'film' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400"></div>}
              </button>
              <button 
                onClick={() => handleTabChange('provini')}
                className={`flex-1 py-5 flex items-center justify-center gap-2.5 transition-all relative ${
                  activeTab === 'provini' ? 'text-white' : 'text-zinc-600'
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-wider">Provini</span>
                <Lock className="w-4 h-4 ml-2" />
                {activeTab === 'provini' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white"></div>}
              </button>
            </div>

            <div className="p-4 md:p-6">
              {isLoadingVideos ? (
                <div className="grid grid-cols-2 gap-4 animate-pulse">
                  {[1, 2, 3, 4].map(i => <div key={i} className="aspect-[9/16] bg-zinc-900 rounded-2xl"></div>)}
                </div>
              ) : filteredVideos.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {filteredVideos.map((video) => (
                    <div 
                      key={video.id} 
                      onClick={() => openFeedView(videos.indexOf(video))}
                      className="group relative aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 transition-all hover:scale-[1.02] cursor-pointer"
                    >
                      <video ref={el => { videoRefs.current[video.id] = el }} src={video.video_url} className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                            <Play className="w-5 h-5 text-white/60 fill-white/20" />
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center text-zinc-700 uppercase font-black tracking-widest text-xs">Nessun Contenuto</div>
              )}
            </div>
          </div>
        </section>

        {/* FEED OVERLAY TIKTOK STYLE - DESIGN FEED COPIATO E MIGLIORATO PER POV VISIBILITY */}
        {selectedVideoIndex !== null && videos[selectedVideoIndex] && (
          <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
            <button onClick={closeFeedView} className="absolute top-4 left-4 z-[2010] w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="relative w-full h-full max-w-[390px] mx-auto flex flex-col bg-black pb-[80px]">
              
              {/* HEADER UTENTE (70px) */}
              <div className="h-[70px] bg-black flex items-center px-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border border-white/80">
                    {profile.avatar_url && <Image src={profile.avatar_url} alt="av" width={44} height={44} className="object-cover" />}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-base">@{profile.username}</p>
                    <p className="text-[#D4AF37] font-bold text-xs tracking-wide">REGISTA</p>
                  </div>
                </div>
              </div>

              {/* AREA VIDEO - RIDOTTA PER LASCIARE SPAZIO AL POV (flex-1) */}
              <div 
                className="relative flex-1 w-full flex items-center justify-center bg-black cursor-pointer overflow-hidden border-y-[0.5px] border-white/5" 
                onClick={() => handleFeedVideoClick(videos[selectedVideoIndex].id)}
              >
                <video
                  ref={(el) => { feedVideoRefs.current[videos[selectedVideoIndex].id] = el; }}
                  src={videos[selectedVideoIndex].video_url}
                  className="max-h-full w-auto object-contain"
                  loop playsInline autoPlay
                />

                {pausedVideos.has(videos[selectedVideoIndex].id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/20">
                    <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                      <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                )}

                {/* ANIMAZIONE ICONA CHE VOLA VERSO L'ALTO */}
                {isFlyingId === videos[selectedVideoIndex].id && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[100]">
                    <div className="animate-flyUp">
                      <Globe2 className="w-16 h-16 text-[#D4AF37] drop-shadow-[0_0_20px_rgba(212,175,55,0.8)]" />
                    </div>
                  </div>
                )}

                {/* SIDEBAR INTERAZIONI (DESTRA) */}
                <div className="absolute bottom-4 right-4 flex flex-col items-center gap-4 z-40">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(videos[selectedVideoIndex].id); }} 
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="w-12 h-12 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform">
                      <Trash2 className="w-5 h-5 text-white" />
                    </div>
                  </button>

                  {/* OSCAR INTERATTIVO (SOLO SE PUBBLICO) */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOscarToggle(videos[selectedVideoIndex].id); }}
                    disabled={videos[selectedVideoIndex].status !== 'pubblico'}
                    className="flex flex-col items-center gap-1 group active:scale-110 transition-transform"
                  >
                    <div className={`text-3xl transition-all ${videos[selectedVideoIndex].has_user_liked ? 'drop-shadow-[0_0_12px_rgba(212,175,55,1)] scale-125' : 'grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                      🏆
                    </div>
                    <span className={`text-xs font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${videos[selectedVideoIndex].has_user_liked ? 'text-[#D4AF37]' : 'text-white'}`}>
                      {videos[selectedVideoIndex].oscar_count || 0}
                    </span>
                  </button>

                  <button onClick={(e) => { e.stopPropagation(); handleShare(videos[selectedVideoIndex]); }}>
                    <Share2 className="w-6 h-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
                  </button>
                </div>
              </div>

              {/* BARRA INFERIORE POV/CAPTION (100px) - SPAZIO NERO DEDICATO AL TESTO */}
              <div className="h-[100px] bg-black flex items-start justify-between px-5 pt-3 flex-shrink-0 border-t border-white/5">
                <div className="flex-1">
                  <p className="text-[#D4AF37] text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                    {videos[selectedVideoIndex].status === 'pubblico' ? 'POV:' : 'IL TUO POV:'}
                  </p>
                  <p className="text-white font-medium text-sm leading-snug line-clamp-3 italic">
                    &quot;{videos[selectedVideoIndex].caption}&quot;
                  </p>
                </div>

                {/* TASTO RENDI PUBBLICO - SOLO PER I PROVINI PRIVATI */}
                {videos[selectedVideoIndex].status === 'privato' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMakePublic(videos[selectedVideoIndex]);
                    }}
                    className="ml-4 px-4 py-2.5 bg-[#D4AF37] text-black font-black rounded-full text-[10px] uppercase tracking-tighter shadow-[0_0_15px_rgba(212,175,55,0.4)] active:scale-95 transition-all self-center"
                  >
                    Rendi Pubblico
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MODIFICA PROFILO (HIGH Z-INDEX) */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-[4000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl animate-fadeIn">
              {/* MODAL HEADER */}
              <div className="px-6 py-5 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/50">
                <button 
                  onClick={closeEditModal} 
                  className="text-zinc-500 hover:text-white font-semibold text-sm transition-colors"
                  disabled={isSavingProfile}
                >
                  Annulla
                </button>
                <h3 className="text-white font-bold text-sm">Modifica Profilo</h3>
                <button 
                  onClick={saveProfile} 
                  disabled={isSavingProfile}
                  className="text-yellow-400 font-bold text-sm hover:text-yellow-300 transition-colors disabled:opacity-40"
                >
                  {isSavingProfile ? 'Salvo...' : 'Salva'}
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* 1. AVATAR PICKER (Profilo Pubblico) */}
                <div className="flex flex-col items-center mb-8">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-zinc-800 bg-black shadow-xl relative">
                      {editAvatarPreview ? (
                        <img src={editAvatarPreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          <UserIcon className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/70 opacity-0 group-hover:opacity-100 transition-all cursor-pointer rounded-full backdrop-blur-sm">
                      <Upload className="w-5 h-5 text-yellow-400" />
                      <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </label>
                  </div>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">Avatar Pubblico</p>
                </div>

                {/* FORM FIELDS */}
                <div className="space-y-6">
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-500">Username</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold">@</span>
                      <input 
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        className="w-full bg-zinc-900 border border-zinc-800 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50 transition-all"
                        placeholder="username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-zinc-500">Bio</label>
                    <textarea 
                      rows={3}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Racconta qualcosa di te..."
                      className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50 transition-all resize-none text-sm leading-relaxed"
                    />
                    <div className="flex justify-end">
                      <span className={`text-[10px] font-semibold ${editBio.length > 180 ? 'text-red-500' : 'text-zinc-600'}`}>
                        {editBio.length}/200
                      </span>
                    </div>
                  </div>

                  {/* 2. IA FACE PICKER (Foto Lineamenti) */}
                  <div className="pt-4 border-t border-zinc-900">
                    <div className="flex items-center gap-2 mb-4">
                       <Sparkles className="w-4 h-4 text-purple-400" />
                       <label className="text-xs font-bold text-zinc-300 uppercase tracking-tight">Foto Identità IA (Face-Swap)</label>
                    </div>
                    
                    <div className="flex flex-col items-center bg-zinc-900/30 p-5 rounded-2xl border border-white/5">
                        <div className="relative mb-4">
                            <div className={`absolute -inset-2 border-2 rounded-xl pointer-events-none transition-all duration-500 ${
                              isFaceDetected 
                                ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                                : 'border-purple-400/30'
                            }`} />
                            
                            <button
                              type="button"
                              onClick={() => iaFaceInputRef.current?.click()}
                              className="relative w-20 h-28 rounded-lg bg-black border border-white/10 flex items-center justify-center group overflow-hidden"
                            >
                              {iaFacePreview ? (
                                <img src={iaFacePreview} alt="IA Face preview" className="w-full h-full object-cover" />
                              ) : (
                                <div className="flex flex-col items-center justify-center">
                                  <Camera className="w-6 h-6 text-purple-400/50 group-hover:text-purple-400 transition-colors" />
                                </div>
                              )}
                            </button>
                        </div>
                        
                        <input
                          ref={iaFaceInputRef}
                          type="file"
                          accept="image/*"
                          capture="user"
                          onChange={handleIaFaceChange}
                          className="hidden"
                        />

                        <div className="text-center">
                            <span className={`text-[10px] font-bold tracking-wider uppercase ${isFaceDetected ? 'text-green-400 animate-pulse' : 'text-zinc-500'}`}>
                              {isFaceDetected ? 'Viso Rilevato ✓' : 'Tocca per Scattare'}
                            </span>
                            {isFallbackActive && (
                              <span className="text-[8px] text-orange-400 flex items-center justify-center gap-1 mt-1">
                                <ShieldAlert size={10} /> Qualità bassa
                              </span>
                            )}
                        </div>

                        {faceError && (
                          <div className="mt-4 p-2 bg-red-500/10 border border-red-500/30 rounded-lg w-full">
                            <p className="text-[9px] text-red-400 text-center font-bold">{faceError}</p>
                          </div>
                        )}
                        
                        <p className="mt-4 text-[9px] text-white text-center leading-tight">
                            Carica un primo piano chiaro e ben illuminato.<br/>Fallo bene una volta per tutti i tuoi film.
                        </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CONFERMA ELIMINAZIONE (HIGHEST Z-INDEX) */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[5000] bg-black/95 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-zinc-950 rounded-3xl p-8 border border-zinc-900 text-center shadow-2xl animate-fadeIn">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Sei sicuro di voler cancellare il video?</h4>
              <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                Questa azione è irreversibile e il contenuto verrà rimosso definitivamente dal database.
              </p>
              <div className="space-y-3">
                <button 
                  onClick={() => handleDeleteVideo(showDeleteConfirm)}
                  className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-red-500 transition-all active:scale-95"
                >
                  Conferma
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="w-full bg-zinc-900 text-zinc-400 py-3.5 rounded-xl font-semibold text-sm hover:text-white hover:bg-zinc-800 transition-all"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="py-16 flex flex-col items-center justify-center gap-4 opacity-30">
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-zinc-800 to-transparent"></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-700">Cinema Scuola</p>
        </footer>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        /* ANIMAZIONE ICONA CHE VOLA VERSO L'ALTO */
        @keyframes flyUp {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          20% { opacity: 1; transform: translateY(0) scale(1.2); }
          100% { transform: translateY(-500px) scale(0.5); opacity: 0; }
        }
        .animate-flyUp {
          animation: flyUp 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
      `}</style>
    </main>
  );
}

export default function ProfiloPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-black text-white">Caricamento...</div>}>
      <ProfiloContent />
    </Suspense>
  );
}
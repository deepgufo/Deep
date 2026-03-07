'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase, supabaseAdmin } from '@/lib/supabase';
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
  MoreVertical
} from 'lucide-react';
import Image from 'next/image';

// --- INTERFACCE E TIPI ---
interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
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
  
  // --- STATI UI AGGIUNTIVI ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // --- STATO INSTALLAZIONE PWA ---
  const [showInstallBtn, setShowInstallBtn] = useState(false);

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
    localStorage.setItem('deep_interactions', '3');
    window.dispatchEvent(new Event('storage'));
  };

  // --- CARICAMENTO INIZIALE DATI ---
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (sessionError || !session?.user) {
          router.push('/auth');
          return;
        }
        
        const userId = session.user.id;

        // 1. Caricamento Profilo
        const profilePromise = supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username, bio, gender, total_oscar_received')
          .eq('id', userId)
          .single();

        // 2. Caricamento Video Pubblici (da public_videos come in users/[id])
        const publicVideoPromise = supabase
          .from('public_videos')
          .select('id, video_url, caption, oscar_count, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        // 3. Caricamento Video Privati (Provini)
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

        // Mappiamo i dati per avere un formato unico nello stato videos
        const mappedPublic = (publicRes.data || []).map(v => ({
          ...v,
          status: 'pubblico' as const
        }));

        const mappedPrivate = (privateRes.data || []).map(v => ({
          ...v,
          caption: v.prompt, // Mappiamo prompt a caption per l'overlay
          oscar_count: 0,
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

  // --- GESTIONE MODIFICA PROFILO ---
  const openEditModal = () => {
    if (profile) {
      setEditName(profile.full_name || '');
      setEditBio(profile.bio || '');
      setEditUsername(profile.username || '');
      setEditAvatarPreview(profile.avatar_url);
      setIsEditModalOpen(true);
    }
  };

  const closeEditModal = () => {
    if (isSavingProfile) return;
    setIsEditModalOpen(false);
    setEditAvatarFile(null);
    setEditAvatarPreview(null);
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

      let avatarUrl = profile.avatar_url;

      if (editAvatarFile && supabaseAdmin) {
        const fileExt = editAvatarFile.name.split('.').pop();
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('avatars')
          .upload(fileName, editAvatarFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseAdmin.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = urlData.publicUrl;
      }

      const updatedData = {
        id: session.user.id,
        full_name: editName,
        bio: editBio,
        username: editUsername,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      };

      if (!supabaseAdmin) throw new Error("Service Role non configurato");

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .upsert(updatedData);

      if (updateError) throw updateError;

      setProfile({
        ...profile,
        full_name: editName,
        bio: editBio,
        username: editUsername,
        avatar_url: avatarUrl,
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

  // --- GESTIONE VIDEO ---
  const handleDeleteVideo = async (videoId: string) => {
    const confirmDelete = confirm('Sei sicuro di voler eliminare questo video? L\'azione è irreversibile.');
    if (!confirmDelete) return;

    try {
      // Tenta l'eliminazione da entrambe le tabelle potenziali
      const { error: error1 } = await supabase.from('public_videos').delete().eq('id', videoId);
      const { error: error2 } = await supabase.from('films').delete().eq('id', videoId);

      if (error1 && error2) throw new Error("Errore durante l'eliminazione");

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
      setTimeout(() => setFeedbackMessage(null), 2000);
    } catch (err) {
      alert("Errore durante l'eliminazione");
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
          title: `Film di ${profile?.full_name || 'Deep'}`,
          text: video.caption,
          url: video.video_url
        });
      } catch (err) {}
    } else {
      await navigator.clipboard.writeText(video.video_url);
      alert('Link copiato negli appunti!');
    }
  };

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
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce ${
          feedbackMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
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

            {/* BOTTONE INSTALLA - DINAMICO */}
            {showInstallBtn && (
              <button
                onClick={triggerInstallPopup}
                className="px-4 py-1.5 rounded-full border-2 border-[#D4AF37] bg-black text-white text-[10px] font-extrabold uppercase tracking-widest shadow-[0_0_15px_rgba(212,175,55,0.3)] active:scale-95 transition-all animate-fadeIn"
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
            
            {/* AVATAR CONTAINER */}
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

            {/* IDENTITA */}
            <h1 className="text-3xl font-bold text-white mb-2 text-center">
              {profile.full_name}
            </h1>
            
            <div className="flex items-center gap-3 mb-6">
              <span className="text-zinc-400 text-sm">@{profile.username}</span>
              <div className="w-px h-4 bg-zinc-700"></div>
              <span className="text-zinc-500 text-sm capitalize">{profile.gender || 'Attrice'}</span>
            </div>

            {/* SEPARATORE */}
            <div className="w-full max-w-md h-px bg-zinc-900 mb-6"></div>

            {/* ACTION AREA */}
            <button
              onClick={openEditModal}
              className="w-full max-w-md px-6 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm font-semibold hover:bg-zinc-800 hover:border-yellow-400/30 hover:shadow-[0_0_20px_rgba(250,204,21,0.1)] transition-all duration-300 active:scale-[0.98]"
            >
              Modifica Profilo
            </button>

            {/* SEPARATORE */}
            <div className="w-full max-w-md h-px bg-zinc-900 my-6"></div>

            {/* STATS BAR */}
            <div className="w-full max-w-md grid grid-cols-3 gap-0 bg-black border border-zinc-900 rounded-2xl overflow-hidden">
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

            {/* SEPARATORE */}
            <div className="w-full max-w-md h-px bg-zinc-900 my-6"></div>

            {/* BIO SECTION */}
            {profile.bio && (
              <>
                <p className="text-zinc-400 text-sm text-center leading-relaxed max-w-md mb-6">
                  {profile.bio}
                </p>
                <div className="w-full max-w-md h-px bg-zinc-900 mb-6"></div>
              </>
            )}
          </div>
        </section>

        {/* SEZIONE VIDEO - TABS INTERFACE */}
        <section className="bg-zinc-950/50 min-h-screen">
          <div className="max-w-2xl mx-auto">
            {/* TABS NAVBAR */}
            <div className="flex sticky top-[73px] z-[90] bg-black/95 backdrop-blur-xl border-b border-zinc-900">
              <button 
                onClick={() => handleTabChange('film')}
                className={`flex-1 py-5 flex items-center justify-center gap-2.5 transition-all duration-500 relative ${
                  activeTab === 'film' ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <span className="text-xs font-black uppercase tracking-[0.3em]" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
                  FILM 🎬
                </span>
                {activeTab === 'film' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-yellow-400 shadow-[0_-2px_10px_rgba(250,204,21,0.5)]"></div>
                )}
              </button>
              
              <button 
                onClick={() => handleTabChange('provini')}
                className={`flex-1 py-5 flex items-center justify-center gap-2.5 transition-all duration-500 relative ${
                  activeTab === 'provini' ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                <Lock className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Provini</span>
                {activeTab === 'provini' && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white shadow-[0_-2px_10px_rgba(255,255,255,0.3)]"></div>
                )}
              </button>
            </div>

            {/* VIDEO GRID */}
            <div className="p-4 md:p-6">
              {isLoadingVideos ? (
                <div className="grid grid-cols-2 gap-4 animate-pulse">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="aspect-[9/16] bg-zinc-900 rounded-2xl"></div>
                  ))}
                </div>
              ) : filteredVideos.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {filteredVideos.map((video) => (
                    <div 
                      key={video.id}
                      onClick={() => openFeedView(videos.indexOf(video))}
                      className="group relative aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 transition-all hover:scale-[1.02] hover:border-zinc-600 hover:shadow-[0_15px_30px_rgba(0,0,0,0.6)] cursor-pointer"
                    >
                      <video
                        ref={el => { videoRefs.current[video.id] = el }}
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        loop
                        muted
                        playsInline
                      />
                      
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                            <Play className="w-5 h-5 text-white/60 fill-white/20" />
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-800">
                    <Film className="w-9 h-9 text-zinc-700" />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-500 uppercase tracking-wider mb-2">Nessun Contenuto</h3>
                  <p className="text-zinc-700 text-xs max-w-xs mx-auto">
                    I tuoi video appariranno qui
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FEED OVERLAY TIKTOK STYLE */}
        {selectedVideoIndex !== null && videos[selectedVideoIndex] && (
          <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
            <button
              onClick={closeFeedView}
              className="absolute top-4 left-4 z-[2010] w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            <div className="relative w-full h-full max-w-[390px] mx-auto flex flex-col bg-black">
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

              <div 
                className="relative flex-1 w-full overflow-hidden border-y-[0.5px] border-white/5 bg-black cursor-pointer"
                onClick={() => handleFeedVideoClick(videos[selectedVideoIndex].id)}
              >
                <video
                  ref={(el) => { feedVideoRefs.current[videos[selectedVideoIndex].id] = el; }}
                  src={videos[selectedVideoIndex].video_url}
                  className="w-full h-full object-cover"
                  loop playsInline autoPlay
                />

                {pausedVideos.has(videos[selectedVideoIndex].id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/20">
                    <Play className="w-12 h-12 text-white/50" />
                  </div>
                )}

                <div className="absolute bottom-10 right-4 flex flex-col items-center gap-6 z-40">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteVideo(videos[selectedVideoIndex].id); }}
                    className="w-12 h-12 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>

                  <div className="flex flex-col items-center gap-1">
                    <div className="text-3xl">🏆</div>
                    <span className="text-xs font-bold text-[#D4AF37] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      {videos[selectedVideoIndex].oscar_count || 0}
                    </span>
                  </div>

                  <button onClick={(e) => { e.stopPropagation(); handleShare(videos[selectedVideoIndex]); }}>
                    <Share2 className="w-6 h-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
                  </button>
                </div>
              </div>

              <div className="h-[70px] bg-black flex items-center px-4 flex-shrink-0">
                <p className="text-white font-semibold text-sm leading-snug line-clamp-2 italic">
                  &quot;{videos[selectedVideoIndex].caption}&quot;
                </p>
              </div>
            </div>
          </div>
        )}

        {/* FOOTER */}
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
      `}</style>
    </main>
  );
}

/**
 * WRAPPER DI ESPORTAZIONE
 */
export default function ProfiloPage() {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-black text-white">Caricamento...</div>}>
      <ProfiloContent />
    </Suspense>
  );
}
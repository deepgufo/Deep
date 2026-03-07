'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  User as UserIcon, 
  ChevronLeft, 
  Play, 
  Film,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  UserMinus,
  Briefcase,
  X,
  Trash2,
  Share2,
  MoreVertical
} from 'lucide-react';
import Image from 'next/image';

// --- INTERFACCE ---
interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username: string;
  bio: string | null;
  gender: string;
  total_oscar_received: number;
}

interface Video {
  id: string;
  video_url: string;
  caption: string; // MODIFICATO: Allineato a colonna database
  oscar_count: number; 
  created_at: string;
}

/**
 * PAGINA PROFILO PUBBLICO
 * Visualizza il profilo di un altro utente con possibilità di seguirlo
 */
export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams();
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  
  // --- STATI PRINCIPALI ---
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // --- STATI FOLLOWER ---
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  
  // --- STATI UI ---
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [pausedVideos, setPausedVideos] = useState<Set<string>>(new Set());
  const feedVideoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // --- CARICAMENTO INIZIALE DATI ---
  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const targetUserId = params.id as string;
        if (!targetUserId) return;

        // Verifica utente loggato
        const { data: { session } } = await supabase.auth.getSession();
        const loggedUserId = session?.user?.id || null;
        setCurrentUserId(loggedUserId);

        // Carica profilo target incluso total_oscar_received
        const { data: profileRes, error: pError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, username, bio, gender, total_oscar_received')
          .eq('id', targetUserId)
          .single();

        if (pError) {
          console.error('❌ Errore caricamento profilo:', pError);
          setIsLoading(false);
          return;
        }
        
        setProfile(profileRes);

        // MODIFICA: Carica video usando 'caption' invece di 'prompt'
        const { data: videoRes, error: vError } = await supabase
          .from('public_videos')
          .select('id, video_url, caption, oscar_count, created_at')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false });

        if (vError) {
          console.error('❌ Errore caricamento video:', vError);
        } else {
          setVideos(videoRes || []);
        }

        // Conta follower totali
        const { count: totalFollowers, error: countError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetUserId);

        if (!countError) {
          setFollowerCount(totalFollowers || 0);
        }

        // Controlla se l'utente loggato segue già questo profilo
        if (loggedUserId) {
          const { data: followData, error: followError } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', loggedUserId)
            .eq('following_id', targetUserId)
            .maybeSingle();

          if (!followError && followData) {
            setIsFollowing(true);
          }
        }

      } catch (err) {
        console.error('❌ Errore fatale:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicData();
  }, [params.id]);

  // --- CLEANUP SCROLL QUANDO COMPONENTE SI SMONTA ---
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // --- GESTIONE FOLLOW/UNFOLLOW ---
  const handleFollowToggle = async () => {
    if (!currentUserId || !profile) {
      alert('Devi effettuare il login per seguire un profilo');
      router.push('/auth');
      return;
    }

    if (currentUserId === profile.id) {
      alert('Non puoi seguire il tuo stesso profilo!');
      return;
    }

    setIsFollowLoading(true);

    // OPTIMISTIC UPDATE
    const previousFollowState = isFollowing;
    const previousFollowerCount = followerCount;

    setIsFollowing(!isFollowing);
    setFollowerCount(prev => isFollowing ? prev - 1 : prev + 1);

    try {
      if (isFollowing) {
        // UNFOLLOW
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profile.id);

        if (error) throw error;

        setFeedbackMessage({ type: 'success', text: 'Non segui più questo profilo' });
      } else {
        // FOLLOW
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: profile.id
          });

        if (error) throw error;

        setFeedbackMessage({ type: 'success', text: 'Ora segui questo profilo!' });
      }

      setTimeout(() => setFeedbackMessage(null), 2500);

    } catch (error: any) {
      console.error('❌ Errore follow/unfollow:', error);
      
      // ROLLBACK in caso di errore
      setIsFollowing(previousFollowState);
      setFollowerCount(previousFollowerCount);
      
      setFeedbackMessage({ type: 'error', text: 'Errore durante l\'operazione' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // --- GESTIONE VIDEO ---
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

  // --- GESTIONE FEED OVERLAY ---
  const openFeedView = (index: number) => {
    setSelectedVideoIndex(index);
    document.body.style.overflow = 'hidden'; // Blocca scroll
  };

  const closeFeedView = () => {
    setSelectedVideoIndex(null);
    document.body.style.overflow = 'auto'; // Ripristina scroll
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

  // --- ELIMINAZIONE VIDEO (Solo proprietario) ---
  const handleDeleteVideo = async (videoId: string) => {
    if (!currentUserId || currentUserId !== profile?.id) {
      alert('Non hai i permessi per eliminare questo video');
      return;
    }

    const confirmDelete = confirm('Sei sicuro di voler eliminare questo video? L\'azione è irreversibile.');
    if (!confirmDelete) return;

    try {
      // Elimina da Supabase
      const { error } = await supabase
        .from('public_videos')
        .delete()
        .eq('id', videoId)
        .eq('user_id', currentUserId); // Sicurezza extra

      if (error) throw error;

      // Aggiorna stato locale
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      
      // Se era l'ultimo video, chiudi overlay
      if (videos.length === 1) {
        closeFeedView();
      } else if (selectedVideoIndex !== null && selectedVideoIndex >= videos.length - 1) {
        // Se era l'ultimo della lista, vai al precedente
        setSelectedVideoIndex(videos.length - 2);
      }

      setFeedbackMessage({ type: 'success', text: 'Video eliminato con successo' });
      setTimeout(() => setFeedbackMessage(null), 2500);

    } catch (error) {
      console.error('❌ Errore eliminazione video:', error);
      setFeedbackMessage({ type: 'error', text: 'Errore durante l\'eliminazione' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleShare = async (video: Video) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Film di ${profile?.full_name || 'Cinema Scuola'}`,
          text: video.caption,
          url: video.video_url
        });
      } catch (err) {}
    } else {
      await navigator.clipboard.writeText(video.video_url);
      alert('Link copiato negli appunti!');
    }
  };

  // --- RENDER LOADING ---
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-yellow-400/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-yellow-400 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="mt-6 text-zinc-500 font-medium animate-pulse uppercase tracking-widest text-xs">
          Caricamento Profilo
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
        <h2 className="text-2xl font-bold text-white mb-2">Profilo Non Trovato</h2>
        <p className="text-zinc-400 mb-8 max-w-xs">L'utente che stai cercando non esiste o è stato rimosso.</p>
        <button
          onClick={() => router.push('/cerca')}
          className="w-full max-w-xs bg-yellow-400 text-black py-4 rounded-xl font-bold hover:bg-yellow-300 transition-all active:scale-95"
        >
          TORNA ALLA RICERCA
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
        {/* TOP BAR */}
        <header className="sticky top-0 z-[100] bg-black/95 backdrop-blur-xl border-b border-zinc-900">
          <div className="max-w-2xl mx-auto flex items-center justify-between px-5 py-4">
            <button 
              onClick={() => router.back()}
              className="p-2 text-zinc-400 hover:text-yellow-400 transition-all duration-300 active:scale-95"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Profilo Pubblico
            </span>

            <div className="w-10"></div>
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
                      className="object-cover"
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
              {/* MODIFICATA LOGICA VISUALIZZAZIONE GENERE */}
              <span className="text-zinc-500 text-sm capitalize">{profile.gender || 'Attrice'}</span>
            </div>

            {/* SEPARATORE */}
            <div className="w-full max-w-md h-px bg-zinc-900 mb-6"></div>

            {/* ACTION BUTTONS */}
            <div className="w-full max-w-md grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={handleFollowToggle}
                disabled={isFollowLoading}
                className={`px-6 py-3.5 rounded-xl text-sm font-bold transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2 ${
                  isFollowing 
                    ? 'bg-zinc-900 border border-zinc-800 text-white hover:bg-zinc-800 hover:border-red-500/30' 
                    : 'bg-yellow-400 text-black hover:bg-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.3)]'
                }`}
              >
                {isFollowLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isFollowing ? 'Non Seguire' : 'Segui'}
                  </>
                )}
              </button>

              <button
                className="px-6 py-3.5 bg-zinc-900 border border-zinc-800 rounded-xl text-white text-sm font-bold hover:bg-zinc-800 hover:border-yellow-400/30 hover:shadow-[0_0_20px_rgba(250,204,21,0.1)] transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Briefcase className="w-4 h-4" />
                ASSUMI
              </button>
            </div>

            {/* SEPARATORE */}
            <div className="w-full max-w-md h-px bg-zinc-900 mb-6"></div>

            {/* STATS BAR */}
            <div className="w-full max-w-md grid grid-cols-3 gap-0 bg-black border border-zinc-900 rounded-2xl overflow-hidden">
              <div className="py-5 flex flex-col items-center border-r border-zinc-900">
                <p className="text-2xl font-bold text-yellow-400 mb-1">{videos.length}</p>
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

        {/* SEZIONE VIDEO - SOLO FILM (NO TAB) */}
        <section className="bg-zinc-950/50 min-h-screen">
          <div className="max-w-2xl mx-auto">
            {/* HEADER FILM */}
            <div className="sticky top-[73px] z-[90] bg-black/95 backdrop-blur-xl border-b border-zinc-900 py-5 flex items-center justify-center">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
                FILM 🎬
              </span>
            </div>

            {/* VIDEO GRID */}
            <div className="p-4 md:p-6">
              {videos.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {videos.map((video, index) => (
                    <div 
                      key={video.id}
                      onClick={() => openFeedView(index)}
                      className="group relative aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden border-[0.5px] border-yellow-500/40 transition-all hover:scale-[1.02] hover:border-yellow-500/80 hover:shadow-[0_0_20px_rgba(250,204,21,0.2)] cursor-pointer"
                    >
                      <video
                        src={video.video_url}
                        className="w-full h-full object-cover"
                        loop
                        muted
                        playsInline
                        preload="metadata"
                      />
                      
                      {/* PLAY ICON CLEAN */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Play className="w-6 h-6 text-white fill-white/80" />
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
                    Questo profilo non ha ancora pubblicato video
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FEED OVERLAY FULLSCREEN */}
        {selectedVideoIndex !== null && videos[selectedVideoIndex] && (
          <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
            {/* CLOSE BUTTON */}
            <button
              onClick={closeFeedView}
              className="absolute top-4 left-4 z-[2010] w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 transition-all"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* VIDEO FEED STYLE */}
            <div className="relative w-full h-full max-w-[390px] mx-auto flex flex-col bg-black">
              
              {/* BARRA SUPERIORE - INFO UTENTE (70px) */}
              <div className="h-[70px] bg-black flex items-center px-4 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFeedView();
                    router.push(`/users/${profile?.id}`);
                  }}
                  className="flex items-center gap-3"
                >
                  <div className="w-11 h-11 rounded-full overflow-hidden border-[1.5px] border-white/80">
                    {profile?.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        width={44}
                        height={44}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                        <UserIcon className="w-6 h-6 text-zinc-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-white font-semibold text-base">
                      @{profile?.username}
                    </p>
                    <p className="text-[#D4AF37] font-bold text-xs tracking-wide">
                      REGISTA
                    </p>
                  </div>
                </button>
              </div>

              {/* CORPO CENTRALE - VIDEO (flex-1) */}
              <div 
                className="relative flex-1 w-full overflow-hidden border-y-[0.5px] border-white/5 bg-black cursor-pointer"
                onClick={() => handleFeedVideoClick(videos[selectedVideoIndex].id)}
              >
                {/* VIDEO PLAYER */}
                <video
                  ref={(el) => {
                    feedVideoRefs.current[videos[selectedVideoIndex].id] = el;
                  }}
                  src={videos[selectedVideoIndex].video_url}
                  className="w-full h-full object-cover"
                  loop
                  playsInline
                  autoPlay
                />

                {/* ICONA PLAY QUANDO PAUSATO */}
                {pausedVideos.has(videos[selectedVideoIndex].id) && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/20">
                    <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                      <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                )}

                {/* MENU 3 PUNTINI - ALTO DESTRA */}
                <div className="absolute top-3 right-3 z-40">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      alert('Menu in sviluppo');
                    }}
                    className="w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform"
                  >
                    <MoreVertical className="w-5 h-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
                  </button>
                </div>

                {/* ICONE INTERAZIONE - DESTRA BASSO */}
                <div className="absolute bottom-10 right-4 flex flex-col items-center gap-4 z-40">
                  {/* TRASH - SOLO PROPRIETARIO */}
                  {currentUserId === profile?.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVideo(videos[selectedVideoIndex].id);
                      }}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className="w-12 h-12 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Trash2 className="w-5 h-5 text-white" />
                      </div>
                    </button>
                  )}

                  {/* OSCAR/LIKE COUNT */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-3xl">🏆</div>
                    <span className="text-xs font-bold text-[#D4AF37] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                      {videos[selectedVideoIndex].oscar_count || 0}
                    </span>
                  </div>

                  {/* CONDIVIDI */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(videos[selectedVideoIndex]);
                    }}
                    className="group"
                  >
                    <Share2 className="w-6 h-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </div>

              {/* BARRA INFERIORE - TITOLO VIDEO (60px) */}
              <div className="h-[60px] bg-black flex items-center px-4 flex-shrink-0">
                <p className="text-white font-semibold text-base leading-snug line-clamp-2 flex-1">
                  {videos[selectedVideoIndex].caption}
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}</style>
    </main>
  );
}
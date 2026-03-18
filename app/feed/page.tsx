'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  MoreVertical, 
  MessageCircle, 
  Send, 
  Download,
  AlertCircle,
  Loader2,
  Flag,
  Play,
  X,
  CheckCircle2,
  Trophy,
  Star,
  Film as FilmIcon
} from 'lucide-react';
import Image from 'next/image';
import PWAInstallPrompt from '../components/PWAInstallPrompt';

// --- INTERFACCE ---
interface Post {
  id: string;
  video_url: string;
  prompt: string;
  created_at: string;
  user_id: string;
  profile: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    school_name?: string;
  };
  likes_count: number;
  has_user_liked: boolean;
}

/**
 * FEED CINEMATOGRAFICO - LAYOUT MATTONE MOBILE OPTIMIZED
 * Design compatto a blocchi perfetti per mobile
 */
export default function FeedPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'film' | 'school'>('film');
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [userSchoolName, setUserSchoolName] = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  
  // Stati UI
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pausedVideos, setPausedVideos] = useState<Set<string>>(new Set());
  const [confettiActive, setConfettiActive] = useState<string | null>(null);
  const [bigTrophyActive, setBigTrophyActive] = useState<string | null>(null); // Nuovo stato per l'animazione centrale
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [showAuthModal, setShowAuthModal] = useState(false); // Nuovo stato per finestra registrazione

  // Stati Segnalazione
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Refs per video, intersection observer e paginazione
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Ref per il doppio click
  const lastClickTime = useRef<{ [key: string]: number }>({});

  // --- LOGICA TRIGGER PWA DOPO 30 SECONDI ---
  useEffect(() => {
    const pwaTimer = setTimeout(() => {
      // Impostiamo le interazioni a 3 per forzare l'attivazione del tutorial
      localStorage.setItem('deep_interactions', '3');
      // Lanciamo un evento custom per assicurarci che il componente PWA rilevi il cambio
      window.dispatchEvent(new Event('storage'));
    }, 30000); // 30 secondi

    return () => clearTimeout(pwaTimer);
  }, []);

  // --- FUNZIONE CARICAMENTO DATI ---
  const fetchVideos = async (isInitial = false) => {
    if (isFetchingMore || (!hasMore && !isInitial)) return;
    
    setIsFetchingMore(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || null;
      setCurrentUserId(userId);

      // Caricamento Badge Notifiche
      if (userId && isInitial) {
        const { count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_read', false);
        
        setUnreadNotifCount(count || 0);
      }

      // Recupero il school_name dell'utente se non lo abbiamo ancora
      let currentSchool = userSchoolName;
      if (userId && !currentSchool) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('school_name')
          .eq('id', userId)
          .single();
          
        if (profileData?.school_name) {
          currentSchool = profileData.school_name;
          setUserSchoolName(profileData.school_name);
        }
      }

      const start = isInitial ? 0 : posts.length;
      const end = start + 2; 

      let query;

      // --- LOGICA FEED SCUOLA E PUBBLICO CON CONTEGGIO LIKES INTEGRATO ---
      if (activeTab === 'school') {
        if (!currentSchool) {
          setPosts([]);
          setHasMore(false);
          setIsFetchingMore(false);
          setIsLoading(false);
          return;
        }

        query = supabase
          .from('public_videos')
          .select(`
            id,
            video_url,
            caption,
            created_at,
            user_id,
            school_name,
            profiles:user_id (
              id,
              full_name,
              username,
              avatar_url
            ),
            likes (count)
          `)
          .eq('school_name', currentSchool)
          .order('created_at', { ascending: false })
          .range(start, end);
          
      } else {
        query = supabase
          .from('public_videos')
          .select(`
            id,
            video_url,
            caption,
            created_at,
            user_id,
            profiles:user_id (
              id,
              full_name,
              username,
              avatar_url
            ),
            likes (count)
          `)
          .order('created_at', { ascending: false })
          .range(start, end);
      }

      const { data: videosData, error } = await query;

      if (error) {
        console.error('❌ Errore caricamento feed:', error.message);
        setIsLoading(false);
        setIsFetchingMore(false);
        return;
      }

      if (!videosData || videosData.length === 0) {
        setHasMore(false);
        if (isInitial) setPosts([]);
        return;
      }

      if (videosData.length < 3) {
        setHasMore(false);
      }

      // Estrai tutti gli ID dei video correnti per fare una singola query dei "miei like"
      const videoIds = videosData.map(v => v.id);
      
      let userLikesSet = new Set<string>();
      if (userId && videoIds.length > 0) {
        // Un'unica query per sapere a quali di questi 3 video l'utente ha messo like
        const { data: userLikesData } = await supabase
          .from('likes')
          .select('film_id')
          .eq('user_id', userId)
          .in('film_id', videoIds);

        if (userLikesData) {
          userLikesData.forEach(like => userLikesSet.add(like.film_id));
        }
      }

      const transformedPosts: Post[] = videosData.map((video: any) => {
        // Gestione corretta della risposta likes(count) di Supabase
        let likesCount = 0;
        if (Array.isArray(video.likes) && video.likes.length > 0) {
            likesCount = video.likes[0].count;
        }

        return {
          id: video.id,
          video_url: video.video_url,
          prompt: video.caption || '',
          created_at: video.created_at,
          user_id: video.user_id,
          profile: video.profiles,
          likes_count: likesCount,
          has_user_liked: userLikesSet.has(video.id)
        };
      });

      setPosts(prev => isInitial ? transformedPosts : [...prev, ...transformedPosts]);

    } catch (err) {
      console.error('❌ Errore fatale caricamento feed:', err);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  // Caricamento iniziale
  useEffect(() => {
    setPosts([]);
    setHasMore(true);
    fetchVideos(true);
  }, [activeTab]);

  // --- INTERSECTION OBSERVER ---
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          const postId = video.getAttribute('data-id');
          
          if (entry.isIntersecting) {
            if (postId && !pausedVideos.has(postId)) {
              video.play().catch(() => {});
            }
            
            const currentIndex = posts.findIndex(p => p.id === postId);
            if (currentIndex >= posts.length - 2 && hasMore && !isFetchingMore) {
              fetchVideos();
            }
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.6 }
    );

    Object.values(videoRefs.current).forEach((video) => {
      if (video) observerRef.current?.observe(video);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [posts, hasMore, isFetchingMore, pausedVideos]);

  // --- GESTIONE LIKE/OSCAR ---
  const handleLikeToggle = async (postId: string) => {
    if (!currentUserId) {
      setShowAuthModal(true);
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    const wasLiked = post.has_user_liked;
    
    if (!wasLiked) {
      setConfettiActive(postId);
      setBigTrophyActive(postId);
      setTimeout(() => {
        setConfettiActive(null);
        setBigTrophyActive(null);
      }, 1500); // L'animazione centrale sparisce dopo 1.5 secondi
    }
    
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              has_user_liked: !wasLiked,
              likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1
            }
          : p
      )
    );

    try {
      const { data, error } = await supabase.rpc('toggle_oscar', { 
        target_video_id: postId 
      });

      if (error) throw error;

      if (data && typeof data.new_count === 'number') {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, likes_count: data.new_count } : p
          )
        );
      }
    } catch (error) {
      console.error('❌ Errore sincronizzazione Oscar:', error);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, has_user_liked: wasLiked, likes_count: wasLiked ? p.likes_count + 1 : p.likes_count - 1 }
            : p
        )
      );
    }
  };

  // --- GESTIONE SEGNALAZIONE ---
  const handleReportSubmit = async () => {
    if (!currentUserId) {
      setShowAuthModal(true);
      return;
    }

    if (!reportReason.trim()) {
      alert('Inserisci una motivazione per la segnalazione');
      return;
    }

    setIsReporting(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: currentUserId,
          video_id: reportingPostId,
          reason: reportReason,
          status: 'pending'
        });

      if (error) throw error;

      setFeedbackMessage({ type: 'success', text: 'Segnalazione inviata. Grazie.' });
      setReportingPostId(null);
      setReportReason('');
      
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err: any) {
      console.error('❌ Errore segnalazione:', err.message);
      setFeedbackMessage({ type: 'error', text: 'Impossibile inviare la segnalazione.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } finally {
      setIsReporting(false);
    }
  };

  // --- TOGGLE PLAY/PAUSE E DOPPIO CLICK ---
  const handleVideoClick = (postId: string) => {
    const now = Date.now();
    const lastClick = lastClickTime.current[postId] || 0;
    const timeDiff = now - lastClick;

    if (timeDiff < 300) {
      // È un DOPPIO CLICK
      lastClickTime.current[postId] = 0; // Resetta per evitare falsi positivi successivi
      
      // Mettiamo like solo se l'utente non l'ha già messo
      const post = posts.find((p) => p.id === postId);
      if (post && !post.has_user_liked) {
        handleLikeToggle(postId);
      } else {
        // Mostriamo comunque l'animazione gratificante se lo aveva già messo
        if (currentUserId) {
          setBigTrophyActive(postId);
          setTimeout(() => setBigTrophyActive(null), 1500);
        } else {
          setShowAuthModal(true);
        }
      }
    } else {
      // È un CLICK SINGOLO (Play/Pause)
      lastClickTime.current[postId] = now;
      
      // Ritardo leggermente il play/pause per aspettare e vedere se diventa un doppio click
      setTimeout(() => {
        // Se nel frattempo l'ora dell'ultimo click è stata resettata a 0, era un doppio click, quindi ignoriamo il play/pause
        if (lastClickTime.current[postId] !== now) return;

        const video = videoRefs.current[postId];
        if (!video) return;

        if (video.paused) {
          video.play();
          setPausedVideos((prev) => {
            const newSet = new Set(prev);
            newSet.delete(postId);
            return newSet;
          });
        } else {
          video.pause();
          setPausedVideos((prev) => {
            const newSet = new Set(prev);
            newSet.add(postId);
            return newSet;
          });
        }
      }, 250); // Attendiamo 250ms per capire le intenzioni
    }
  };

  // --- CONDIVIDI VIDEO (SISTEMATO PER MOBILE NATIVO) ---
  const handleShare = async (post: Post) => {
    const shareUrl = 'https://deepfly.app/feed'; // Il link porta all'app
    const authorName = post.profile?.username || 'un tuo compagno';
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Guarda questo film su Deep`,
          text: `🎬 Guarda il film generato dall'IA da @${authorName}: "${post.prompt}".\nEntra anche tu in Deep!`,
          url: shareUrl
        });
      } catch (err: any) {
        // Se l'utente annulla la condivisione, il browser lancia un AbortError. Non facciamo nulla.
        if (err.name !== 'AbortError') {
          console.error("Errore condivisione nativa:", err);
          fallbackShare(shareUrl);
        }
      }
    } else {
      // Fallback per PC o browser non compatibili
      fallbackShare(shareUrl);
    }
  };

  const fallbackShare = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setFeedbackMessage({ type: 'success', text: 'Link copiato negli appunti!' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (err) {
      console.error("Errore clipboard:", err);
    }
  };

  // --- DOWNLOAD VIDEO ---
  const handleDownload = async (post: Post) => {
    try {
      const response = await fetch(post.video_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `film_${post.profile?.username || 'video'}_${Date.now()}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      window.open(post.video_url, '_blank');
    }
  };

  // --- TOGGLE ESPANSIONE TESTO ---
  const toggleExpand = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) newSet.delete(postId);
      else newSet.add(postId);
      return newSet;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-black">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
        <p className="text-zinc-500 text-sm font-semibold">Caricamento Feed...</p>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 bg-[#000000]">
      {/* FEEDBACK OVERLAY */}
      {feedbackMessage && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[3000] px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-bounce ${
          feedbackMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white" /> : <AlertCircle className="w-5 h-5 text-white" />}
          <span className="font-bold text-sm text-white uppercase">{feedbackMessage.text}</span>
        </div>
      )}

      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/5 h-[56px] flex items-center">
        <div className="w-full max-w-md mx-auto flex items-center justify-between px-4 relative h-full">
          
          <div className="flex-1" />
          
          <div className="flex gap-8 absolute left-1/2 -translate-x-1/2">
            <button
              onClick={() => setActiveTab('film')}
              className={`relative pb-1 transition-all duration-300 ${
                activeTab === 'film'
                  ? 'text-white text-base font-bold'
                  : 'text-zinc-600 text-sm font-semibold'
              }`}
            >
              Film
              {activeTab === 'film' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#D4AF37] rounded-full"></div>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('school')}
              className={`relative pb-1 transition-all duration-300 uppercase ${
                activeTab === 'school'
                  ? 'text-white text-base font-bold'
                  : 'text-zinc-600 text-sm font-semibold'
              }`}
            >
              {userSchoolName ? userSchoolName : 'Scuola'}
              {activeTab === 'school' && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#D4AF37] rounded-full"></div>
              )}
            </button>
          </div>

          <div className="flex-1 flex justify-end h-full items-center">
            <button 
              onClick={() => router.push('/notifiche')}
              className="relative flex flex-col items-center justify-center gap-0.5 px-2"
            >
              <div className="relative">
                <Star 
                  className={`w-[22px] h-[22px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] transition-colors ${
                    unreadNotifCount > 0 ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-white'
                  }`} 
                />
                {unreadNotifCount > 0 && (
                  <div className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-red-600 border border-black rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 shadow-[0_0_8px_rgba(220,38,38,0.5)]">
                    {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                  </div>
                )}
              </div>
              <span className={`text-[8px] font-semibold drop-shadow-md ${unreadNotifCount > 0 ? 'text-[#D4AF37]' : 'text-white/80'}`}>
                Notifiche
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="h-full overflow-y-auto snap-y snap-mandatory pt-[56px] pb-20" style={{ scrollSnapType: 'y mandatory' }}>
        {posts.length > 0 ? (
          posts.map((post) => (
            <div
              key={post.id}
              className="h-[calc(100vh-56px)] snap-start flex items-center justify-center"
            >
              <div className="relative w-full h-[calc(100vh-148px)] max-w-[390px] mx-auto flex flex-col bg-black">
                
                <div className="h-[70px] bg-black flex items-center justify-between px-4 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/users/${post.user_id}`);
                    }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden border-[1.5px] border-white/80">
                      {post.profile?.avatar_url ? (
                        <Image
                          src={post.profile.avatar_url}
                          alt={post.profile.full_name || 'avatar'}
                          width={44}
                          height={44}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <span className="text-zinc-400 text-sm font-bold">
                            {post.profile?.full_name?.[0] || '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold text-base">
                        @{post.profile?.username || post.profile?.full_name?.toLowerCase().replace(/\s/g, '') || 'anonimo'}
                      </p>
                      <p className="text-[#D4AF37] font-bold text-xs tracking-wide">
                        REGISTA
                      </p>
                    </div>
                  </button>

                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === post.id ? null : post.id);
                      }}
                      className="w-8 h-8 flex items-center justify-center hover:scale-110 transition-transform"
                    >
                      <MoreVertical className="w-5 h-5 text-white" />
                    </button>

                    {openMenuId === post.id && (
                      <div className="absolute top-10 right-0 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-fadeIn z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReportingPostId(post.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Flag className="w-4 h-4" />
                          <span className="text-sm font-semibold">Segnala video</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(post);
                            setOpenMenuId(null);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-white/5 transition-colors border-t border-zinc-800"
                        >
                          <Download className="w-4 h-4" />
                          <span className="text-sm font-semibold">Scarica</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div 
                  className="relative flex-1 w-full overflow-hidden border-y-[0.5px] border-white/5 bg-black cursor-pointer"
                  onClick={() => handleVideoClick(post.id)}
                >
                  <video
                    ref={(el) => {
                      videoRefs.current[post.id] = el;
                    }}
                    data-id={post.id}
                    src={post.video_url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    loop
                    playsInline
                  />

                  {/* ANIMAZIONE CENTRALE: BIG TROPHY */}
                  {bigTrophyActive === post.id && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                      <div className="animate-popTrophy drop-shadow-[0_0_30px_rgba(212,175,55,0.8)]">
                        <Trophy className="w-32 h-32 text-[#D4AF37] fill-[#D4AF37]" />
                      </div>
                    </div>
                  )}

                  {pausedVideos.has(post.id) && !bigTrophyActive && (
                    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/20">
                      <div className="w-16 h-16 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-md animate-fadeIn">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                  )}

                  {confettiActive === post.id && (
                    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                      {Array.from({ length: 80 }).map((_, i) => (
                        <div
                          key={i}
                          className="confetti"
                          style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 0.4}s`,
                            animationDuration: `${1.8 + Math.random() * 0.4}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="absolute bottom-10 right-4 flex flex-col items-center gap-6 z-40">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLikeToggle(post.id);
                      }}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className={`relative transition-all duration-300 ${
                        post.has_user_liked ? 'scale-110' : 'scale-100'
                      }`}>
                        {post.has_user_liked ? (
                          <Trophy className="w-7 h-7 text-[#D4AF37] fill-[#D4AF37] drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]" />
                        ) : (
                          <Trophy className="w-7 h-7 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] group-hover:scale-110 transition-transform" />
                        )}
                      </div>
                      <span className={`text-[10px] font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
                        post.has_user_liked ? 'text-[#D4AF37]' : 'text-white'
                      }`}>
                        {post.likes_count}
                      </span>
                      <span className="text-[9px] text-white/80 font-semibold drop-shadow-md -mt-1">Oscar</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare(post);
                      }}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <Send className="w-7 h-7 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] group-hover:scale-110 transition-transform -rotate-45 mb-1" />
                      <span className="text-[9px] text-white/80 font-semibold drop-shadow-md">Condividi</span>
                    </button>
                  </div>
                </div>

                <div 
                  className="bg-black flex items-center px-4 flex-shrink-0 h-[75px]"
                >
                  <p className="text-white font-semibold text-base leading-snug flex-1 line-clamp-3 overflow-hidden">
                    {post.prompt}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-6 text-center">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800">
              <AlertCircle className="w-10 h-10 text-zinc-700" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nessun Contenuto</h3>
            <p className="text-zinc-500 text-sm max-w-xs">
              {activeTab === 'school' 
                ? "Non ci sono ancora video dalla tua scuola." 
                : "Non ci sono ancora video nel feed. Torna più tardi o inizia a seguire altri creatori!"}
            </p>
          </div>
        )}
        
        {isFetchingMore && (
          <div className="flex justify-center p-4">
            <Loader2 className="w-6 h-6 text-[#D4AF37] animate-spin" />
          </div>
        )}
      </div>

      {/* MODALE SEGNALAZIONE */}
      {reportingPostId && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setReportingPostId(null)} />
          <div className="relative w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Segnala Contenuto</h3>
                <button onClick={() => setReportingPostId(null)} className="p-1 text-zinc-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-zinc-400 mb-4">
                Aiutaci a capire cosa non va. La tua segnalazione sarà esaminata dal team di Deep.
              </p>

              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Perché stai segnalando questo video?"
                className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-red-500 transition-colors resize-none mb-6"
              />

              <button
                onClick={handleReportSubmit}
                disabled={isReporting || !reportReason.trim()}
                className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isReporting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'CONFERMA SEGNALAZIONE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALE: REGISTRAZIONE (FLASH AUTH) */}
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
              <FilmIcon className="w-8 h-8 text-[#FFCC00]" />
            </div>

            <h3 className="text-xl font-black text-white mb-3 uppercase tracking-tighter italic">
              Non restare a guardare! 🎬
            </h3>
            
            <p className="text-zinc-400 text-sm font-medium leading-relaxed mb-8">
              Per mettere like, commentare e creare i tuoi film AI devi far parte della scuola. Ci metti 10 secondi, promesso.
            </p>

            <button
              onClick={() => router.push('/auth')}
              className="w-full py-5 bg-[#FFCC00] text-black font-black rounded-2xl active:scale-95 transition-all shadow-[0_0_30px_rgba(255,204,0,0.2)] uppercase tracking-widest text-sm"
            >
              REGISTRATI ORA
            </button>

            <button 
              onClick={() => setShowAuthModal(false)}
              className="mt-6 text-[10px] font-bold text-zinc-600 uppercase tracking-widest hover:text-zinc-400 transition-colors"
            >
              Continua a guardare
            </button>
          </div>
        </div>
      )}

      {/* POP-UP PWA TRIGGERATO DOPO 30 SECONDI */}
      <PWAInstallPrompt />

      <style jsx global>{`
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Animazione per il doppio click (Coppa gigante) */
        @keyframes popTrophy {
          0% { opacity: 0; transform: scale(0.5) rotate(-15deg); }
          30% { opacity: 1; transform: scale(1.2) rotate(5deg); }
          70% { opacity: 1; transform: scale(1) rotate(0deg); }
          100% { opacity: 0; transform: scale(1.5) translateY(-50px); }
        }
        .animate-popTrophy {
          animation: popTrophy 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        
        .confetti {
          position: absolute;
          top: -20px;
          width: 10px;
          height: 16px;
          background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 50%, #D4AF37 100%);
          animation: confettiFall linear forwards;
          opacity: 0;
          border-radius: 2px;
          box-shadow: 0 0 8px rgba(212, 175, 55, 0.6);
        }
        
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) translateX(0) rotateZ(0deg) rotateY(0deg); }
          25% { transform: translateY(25vh) translateX(30px) rotateZ(180deg) rotateY(90deg); }
          50% { transform: translateY(50vh) translateX(-20px) rotateZ(360deg) rotateY(180deg); }
          75% { transform: translateY(75vh) translateX(25px) rotateZ(540deg) rotateY(270deg); }
          100% { opacity: 0; transform: translateY(100vh) translateX(-10px) rotateZ(720deg) rotateY(360deg); }
        }
        
        .overflow-y-auto::-webkit-scrollbar { display: none; }
        .overflow-y-auto { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </main>
  );
}
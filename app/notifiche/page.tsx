'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Bell, Trophy, Users, CheckCircle2, Loader2, PlayCircle } from 'lucide-react';
import Image from 'next/image';

// --- TIPI ---
type NotificationType = 'oscar' | 'follow' | 'system';

interface RawNotification {
  id: string;
  type: NotificationType;
  actor_id: string | null;
  reference_id: string | null; 
  is_read: boolean;
  created_at: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  } | null;
  public_videos: {
    video_url: string;
  } | null;
}

interface GroupedNotification {
  id: string;
  type: NotificationType;
  actors: { actor_id: string | null, username: string; avatar_url: string | null }[];
  reference_id: string | null;
  video_thumb: string | null;
  text_content: string | null;
  is_read: boolean;
  created_at: string;
  count: number;
}

export default function NotifichePage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<GroupedNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAndGroupNotifications();
  }, []);

  const fetchAndGroupNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }

      const userId = session.user.id;

      // 1. Recuperiamo SOLO le notifiche base (evita il crash del Join di Supabase)
      const { data: rawData, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (notifError) throw notifError;

      if (rawData && rawData.length > 0) {
        // 2. Estraiamo gli ID univoci per Profili e Video
        const actorIds = [...new Set(rawData.map(n => n.actor_id).filter(Boolean))];
        const videoIds = [...new Set(rawData.filter(n => n.type === 'oscar' && n.reference_id).map(n => n.reference_id))];

        // 3. Fetch dei Profili (Chi ha messo like / follow)
        let profilesData: any[] = [];
        if (actorIds.length > 0) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .in('id', actorIds);
          if (pData) profilesData = pData;
        }

        // 4. Fetch delle miniature Video
        let videosData: any[] = [];
        if (videoIds.length > 0) {
          const { data: vData } = await supabase
            .from('public_videos')
            .select('id, video_url')
            .in('id', videoIds);
          if (vData) videosData = vData;
        }

        // 5. Uniamo tutti i pezzi manualmente (Bulletproof!)
        const enrichedData: RawNotification[] = rawData.map(notif => {
          const profile = profilesData.find(p => p.id === notif.actor_id);
          const video = videosData.find(v => v.id === notif.reference_id);
          
          return {
            id: notif.id,
            type: notif.type as NotificationType,
            actor_id: notif.actor_id,
            reference_id: notif.reference_id,
            is_read: notif.is_read,
            created_at: notif.created_at,
            profiles: profile ? { username: profile.username, avatar_url: profile.avatar_url } : null,
            public_videos: video ? { video_url: video.video_url } : null
          };
        });

        // 6. Applichiamo la magia del raggruppamento (es: "Marco e altri 9...")
        const grouped = groupNotifications(enrichedData);
        setNotifications(grouped);
        
        // 7. Segna in background tutte le notifiche come lette
        const unreadIds = rawData.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length > 0) {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .in('id', unreadIds);
        }
      }
    } catch (err) {
      console.error("Errore caricamento notifiche:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // --- LA MAGIA DEL RAGGRUPPAMENTO ---
  const groupNotifications = (raw: RawNotification[]): GroupedNotification[] => {
    const groups: GroupedNotification[] = [];

    raw.forEach(notif => {
      const actor = notif.profiles ? { actor_id: notif.actor_id, username: notif.profiles.username, avatar_url: notif.profiles.avatar_url } : { actor_id: null, username: 'Sistema', avatar_url: null };
      
      if (notif.type === 'oscar' && notif.reference_id) {
        // Cerca se esiste già un gruppo per questo video
        const existingGroup = groups.find(g => g.type === 'oscar' && g.reference_id === notif.reference_id);
        
        if (existingGroup) {
          existingGroup.count += 1;
          // Aggiungi l'attore se non è già nel gruppo (per evitare doppioni visuali)
          if (!existingGroup.actors.find(a => a.username === actor.username)) {
            existingGroup.actors.push(actor);
          }
          if (!notif.is_read) existingGroup.is_read = false;
        } else {
          groups.push({
            id: notif.id,
            type: 'oscar',
            actors: [actor],
            reference_id: notif.reference_id,
            video_thumb: notif.public_videos?.video_url || null,
            text_content: null,
            is_read: notif.is_read,
            created_at: notif.created_at,
            count: 1
          });
        }
      } else {
        // Follow e System non vengono raggruppati tra loro
        groups.push({
          id: notif.id,
          type: notif.type,
          actors: [actor],
          reference_id: notif.reference_id,
          video_thumb: null,
          text_content: notif.type === 'system' ? notif.reference_id : null, 
          is_read: notif.is_read,
          created_at: notif.created_at,
          count: 1
        });
      }
    });

    return groups;
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Ora';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m fa`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h fa`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return 'Ieri';
    return `${diffInDays}g fa`;
  };

  const handleNotificationClick = (notif: GroupedNotification) => {
    if (notif.type === 'oscar') {
      router.push('/profilo'); 
    } else if (notif.type === 'follow' && notif.reference_id) {
      router.push(`/users/${notif.reference_id}`);
    } else if (notif.type === 'system') {
      router.push('/crea');
    }
  };

  const handleUserClick = (e: React.MouseEvent, actorId: string | null) => {
    e.stopPropagation(); // Evita di cliccare l'intera notifica
    if (actorId) {
      router.push(`/users/${actorId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[100dvh] bg-[#0A0A0A] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <main className="h-[100dvh] bg-[#0A0A0A] flex flex-col relative overflow-hidden">
      
      {/* HEADER */}
      <header className="flex-shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/5 px-6 py-5 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/feed')}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <Bell className="w-5 h-5 text-yellow-400" />
              Notifiche
            </h1>
          </div>
        </div>
      </header>

      {/* LISTA NOTIFICHE */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 pb-20">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50 px-6">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
              <Bell className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Tutto tranquillo sul set</h3>
            <p className="text-xs text-gray-400">Quando qualcuno interagirà con i tuoi film, lo vedrai qui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer hover:bg-white-[0.03] active:scale-[0.98] ${
                  notif.is_read 
                    ? 'bg-zinc-900/40 border-white/5' 
                    : 'bg-yellow-400/5 border-yellow-400/20 shadow-[0_0_15px_rgba(251,191,36,0.05)]'
                }`}
              >
                {/* PALLINO NON LETTO */}
                {!notif.is_read && (
                  <div className="absolute top-4 right-4 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]"></div>
                )}

                {/* ICONA / AVATAR */}
                <div className="relative flex-shrink-0">
                  {notif.type === 'system' ? (
                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                      <Image src="/logo_01.png" alt="DEEP" width={28} height={28} className="object-contain" />
                    </div>
                  ) : notif.type === 'oscar' ? (
                    <div className="w-12 h-12 rounded-full bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-400" />
                    </div>
                  )}
                  
                  {/* Mini avatar sovrapposto se c'è un attore umano */}
                  {notif.type !== 'system' && notif.actors[0]?.avatar_url && (
                    <div 
                      onClick={(e) => handleUserClick(e, notif.actors[0].actor_id)}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-[#0A0A0A] overflow-hidden bg-zinc-800 cursor-pointer"
                    >
                      <img src={notif.actors[0].avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* TESTO NOTIFICA */}
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[13px] text-gray-300 leading-snug">
                    {notif.type === 'oscar' && (
                      <>
                        <span 
                          onClick={(e) => handleUserClick(e, notif.actors[0].actor_id)}
                          className="font-bold text-white hover:underline cursor-pointer"
                        >
                          @{notif.actors[0].username}
                        </span>
                        {notif.count > 1 && <span className="font-medium text-gray-400"> e altri {notif.count - 1}</span>}
                        {' '}hanno premiato il tuo film con un Oscar.
                      </>
                    )}
                    {notif.type === 'follow' && (
                      <>
                        <span 
                          onClick={(e) => handleUserClick(e, notif.actors[0].actor_id)}
                          className="font-bold text-white hover:underline cursor-pointer"
                        >
                          @{notif.actors[0].username}
                        </span>
                        {' '}è entrato a far parte dei tui Fan.
                      </>
                    )}
                    {notif.type === 'system' && (
                      <>
                        <span className="font-bold text-yellow-400 tracking-wide uppercase">DEEP: </span>
                        <span className="font-medium text-white">{notif.text_content}</span>
                      </>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wider">
                    {formatTimeAgo(notif.created_at)}
                  </p>
                </div>

                {/* THUMBNAIL VIDEO (SOLO PER LIKES) */}
                {notif.type === 'oscar' && notif.video_thumb && (
                  <div className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-white/10 relative opacity-80">
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                      <PlayCircle className="w-5 h-5 text-white/70" />
                    </div>
                    <video src={notif.video_thumb} className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 0px; }
      `}</style>
    </main>
  );
}
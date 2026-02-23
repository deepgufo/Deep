'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Users, Activity, TrendingUp, Globe, Calendar, Play, Film, Zap, Clock, ChevronRight } from 'lucide-react';

// Interfaccia per gestire il mix di azioni nel log
interface ActionLog {
  id: string;
  type: 'signup' | 'video';
  message: string;
  timestamp: string;
}

export default function ProgressiPage() {
  const router = useRouter();
  const [onlineCount, setOnlineCount] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [todayRegistrations, setTodayRegistrations] = useState(0);
  const [todayVideos, setTodayVideos] = useState(0); 
  const [totalVideos, setTotalVideos] = useState(0);
  const [recentActions, setRecentActions] = useState<ActionLog[]>([]); // Stato per il Log
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- CONFIGURAZIONE ANONIMATO ---
  const ADMIN_UUID = "d9364dcd-ceba-4120-9ace-57ce5c1612d8"; 

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id === ADMIN_UUID) {
        setIsAuthorized(true);
        await fetchStats();
      } else {
        setIsAuthorized(false);
        router.push('/'); 
      }
      setIsLoading(false);
    };

    checkAdmin();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchStats = async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayISO = startOfToday.toISOString();

    // 1. UTENTI ONLINE (Ultimi 5 minuti)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: online, error: onlineError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('last_seen', fiveMinutesAgo);

    if (!onlineError && online !== null) setOnlineCount(online);

    // 2. UTENTI REGISTRATI TOTALI
    const { count: total, error: totalError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!totalError && total !== null) setTotalUsers(total);

    // 3. REGISTRAZIONI DI OGGI
    const { count: todayCount, error: todayError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    if (!todayError && todayCount !== null) setTodayRegistrations(todayCount);

    // 4. VIDEO TOTALI
    const { count: vTotal, error: vTotalError } = await supabase
      .from('public_videos')
      .select('*', { count: 'exact', head: true });

    if (!vTotalError && vTotal !== null) setTotalVideos(vTotal);

    // 5. VIDEO GENERATI OGGI
    const { count: videoCount, error: videoError } = await supabase
      .from('public_videos')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    if (!videoError && videoCount !== null) setTodayVideos(videoCount);

    // 6. RECUPERO LOG ATTIVITÀ (Iscrizioni + Video)
    const { data: lastProfiles } = await supabase
      .from('profiles')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: lastVideos } = await supabase
      .from('public_videos')
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Uniamo e ordiniamo per tempo
    const combined: ActionLog[] = [
      ...(lastProfiles?.map(p => ({
        id: p.id,
        type: 'signup' as const,
        message: "Nuovo attore nel cast",
        timestamp: p.created_at
      })) || []),
      ...(lastVideos?.map(v => ({
        id: v.id,
        type: 'video' as const,
        message: "Nuova scena prodotta",
        timestamp: v.created_at
      })) || [])
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
     .slice(0, 15);

    setRecentActions(combined);
  };

  if (isLoading || isAuthorized === null) return <div className="h-screen bg-[#0A0A0A]" />;
  if (isAuthorized === false) return null;

  return (
    <div className="h-[100dvh] w-full bg-[#0A0A0A] text-white font-sans overflow-hidden flex flex-col">
      
      {/* HEADER NAVIGAZIONE PANNELLO */}
      <nav className="flex-shrink-0 bg-zinc-900/50 border-b border-white/5 px-6 py-4 flex justify-between items-center z-50">
        <h1 className="text-yellow-400 font-black tracking-tighter uppercase italic flex items-center gap-2">
          <Zap size={16} fill="currentColor" />
          Admin_Room
        </h1>
        <div className="flex gap-4">
          <button className="text-[10px] font-bold text-white border-b-2 border-yellow-400 pb-1">PROGRESSI</button>
          <button 
            className="text-[10px] font-bold text-zinc-600 hover:text-white transition-colors"
            onClick={() => router.push('/gufo1117/utenti')}
          >
            UTENTI
          </button>
          {/* --- MODIFICA AGGIUNTA QUI --- */}
          <button 
            className="text-[10px] font-bold text-zinc-600 hover:text-white transition-colors"
            onClick={() => router.push('/gufo1117/sicurezza')}
          >
            ERRORI
          </button>
        </div>
      </nav>

      {/* CONTENUTO CENTRALE - SCROLLABILE */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/20 via-black to-black">
        <div className="w-full max-w-sm mx-auto space-y-6 pb-10">
          
          <div className="mb-2 text-center">
            <h2 className="text-2xl font-black mb-1 text-white tracking-tight">Stato Live</h2>
            <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium">Cinema Scuola Intelligence</p>
          </div>

          {/* CARD PRINCIPALE: LIVE NOW */}
          <div className="relative group rounded-[40px] p-[1px] bg-gradient-to-b from-green-500/30 to-transparent shadow-2xl">
            <div className="bg-zinc-900/40 backdrop-blur-3xl rounded-[39px] p-8 flex flex-col items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_2px,3px_100%] pointer-events-none opacity-30"></div>
              <div className="flex items-center gap-2 mb-3 bg-green-500/10 px-3 py-1 rounded-full border border-green-500/20 relative z-10">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]"></span>
                <span className="text-[9px] font-black text-green-500 uppercase tracking-tighter">Live Monitor</span>
              </div>
              <h3 className="text-8xl font-black tracking-tighter italic relative z-10 text-white tabular-nums drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
                {onlineCount}
              </h3>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-3 relative z-10">Utenti Attivi</p>
              <Activity className="w-32 h-32 text-green-500/5 absolute -bottom-6 -right-6 transform rotate-12" />
            </div>
          </div>

          {/* GRIGLIA STORICA */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative group rounded-[32px] p-[1px] bg-gradient-to-b from-yellow-500/30 to-transparent">
              <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[31px] p-5 flex flex-col items-start relative overflow-hidden h-full">
                <Globe className="text-yellow-500 mb-3 opacity-80" size={18} />
                <h3 className="text-3xl font-black tracking-tighter italic text-white leading-none">{totalUsers}</h3>
                <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-2 leading-tight">Membri Network</p>
              </div>
            </div>
            <div className="relative group rounded-[32px] p-[1px] bg-gradient-to-b from-purple-500/30 to-transparent">
              <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[31px] p-5 flex flex-col items-start relative overflow-hidden h-full">
                <Film className="text-purple-500 mb-3 opacity-80" size={18} />
                <h3 className="text-3xl font-black tracking-tighter italic text-white leading-none">{totalVideos}</h3>
                <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-2 leading-tight">Film Prodotti</p>
              </div>
            </div>
          </div>

          {/* GRIGLIA CRESCITA OGGI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative group rounded-[24px] p-[1px] bg-gradient-to-br from-blue-500/40 to-transparent h-full">
              <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[23px] p-5 flex flex-col h-full relative overflow-hidden">
                <Calendar className="w-4 h-4 text-blue-400 mb-3" />
                <h3 className="text-4xl font-black tracking-tighter italic text-white">{todayRegistrations}</h3>
                <p className="text-blue-400/80 text-[9px] font-black uppercase tracking-widest mt-2">New Entries</p>
              </div>
            </div>
            <div className="relative group rounded-[24px] p-[1px] bg-gradient-to-br from-fuchsia-500/50 to-transparent h-full">
              <div className="bg-zinc-900/60 backdrop-blur-2xl rounded-[23px] p-5 flex flex-col h-full relative overflow-hidden border-fuchsia-500/20">
                <Play className="w-4 h-4 text-fuchsia-400 fill-fuchsia-400/20 mb-3" />
                <h3 className="text-4xl font-black tracking-tighter italic text-white">{todayVideos}</h3>
                <p className="text-fuchsia-400 text-[9px] font-black uppercase tracking-widest mt-2">Video Prodotti</p>
              </div>
            </div>
          </div>

          {/* LOG ULTIME AZIONI - "IL FLUSSO" */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-zinc-500 flex items-center gap-2">
                <Clock size={12} />
                Cinema Flow Log
              </h4>
              <span className="text-[9px] font-bold text-green-500/50 uppercase">Live Feed</span>
            </div>
            
            <div className="space-y-2">
              {recentActions.map((action, idx) => (
                <div 
                  key={action.id + idx} 
                  className="bg-zinc-900/30 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:bg-zinc-800/40 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${action.type === 'signup' ? 'bg-blue-500/10 text-blue-500' : 'bg-fuchsia-500/10 text-fuchsia-500'}`}>
                      {action.type === 'signup' ? <Users size={14} /> : <Film size={14} />}
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-zinc-200 tracking-tight">{action.message}</p>
                      <p className="text-[9px] text-zinc-600 font-medium">
                        {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-zinc-800 group-hover:text-zinc-400 transition-colors" />
                </div>
              ))}
              
              {recentActions.length === 0 && (
                <div className="text-center py-10 border border-dashed border-white/5 rounded-3xl">
                  <p className="text-[10px] font-bold uppercase text-zinc-700 tracking-widest">In attesa di dati dal set...</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* FOOTER DI SICUREZZA */}
      <footer className="p-4 bg-black/80 backdrop-blur-md border-t border-white/5 opacity-50 text-center mt-auto flex-shrink-0 z-50 relative">
        <p className="text-[8px] font-bold tracking-[0.5em] uppercase text-zinc-500">
          Private access only - secure encrypted session
        </p>
      </footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 0px; }
        body { background-color: #0A0A0A; }
      `}</style>
    </div>
  );
}
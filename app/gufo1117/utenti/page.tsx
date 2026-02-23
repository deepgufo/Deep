'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Users, Film, Zap, Mail, MousePointer2, Camera, School, CheckCircle, ArrowRight, PlayCircle, Share2, Download, Globe, Lock, Trophy, UserMinus, Timer, Gauge, AlertTriangle, GraduationCap, DollarSign, AlertOctagon, RefreshCw, ActivitySquare } from 'lucide-react';

export default function UtentiPage() {
  const router = useRouter();
  
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  
  // Metriche di Distribuzione (La metrica della droga)
  const [distribution, setDistribution] = useState({
    zero: 0,
    one: 0,
    twoPlus: 0
  });

  // Funnel di Registrazione
  const [funnelStats, setFunnelStats] = useState({
    auth: 0,
    start: 0,
    photo: 0,
    school: 0
  });

  // Funnel di Soddisfazione (Video)
  const [satisfactionStats, setSatisfactionStats] = useState({
    videoReady: 0,
    shared: 0,
    downloaded: 0,
    publishedPublic: 0,
    publishedPrivate: 0
  });

  // --- NUOVO STATO: PERFORMANCE ---
  const [performance, setPerformance] = useState({
    avgSeconds: 0,
    maxSeconds: 0,
    isStruggling: false
  });

  // --- NUOVO STATO: DIVISIONE SCUOLE ---
  const [schoolStats, setSchoolStats] = useState({
    polo: 0,
    montale: 0,
    fermi: 0,
    sconosciuti: 0
  });

  // --- NUOVI STATI PER IL BUDGET ---
  const [lastHourVideos, setLastHourVideos] = useState(0);
  const COST_PER_VIDEO = 0.08;
  const ESTIMATED_BUDGET = 100; // Valore indicativo

  // --- NUOVI STATI PER RETENTION ---
  const [retentionStats, setRetentionStats] = useState({
    dau: 0,
    returningUsers: 0,
    stickinessRatio: 0,
    avgSessions: 0
  });

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // --- CONFIGURAZIONE ANONIMATO ---
  const ADMIN_UUID = "d9364dcd-ceba-4120-9ace-57ce5c1612d8"; 

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id === ADMIN_UUID) {
        setIsAuthorized(true);
        await fetchUtentiData();
      } else {
        setIsAuthorized(false);
        router.push('/'); 
      }
      setIsLoading(false);
    };

    checkAdmin();
    const interval = setInterval(fetchUtentiData, 30000);
    return () => clearInterval(interval);
  }, [router]);

  const fetchUtentiData = async () => {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

      // 1. TOTALI E DISTRIBUZIONE
      const { data: profiles, count: usersCount } = await supabase
        .from('profiles')
        .select('id, school_name, created_at, last_seen', { count: 'exact' });
      
      setTotalUsers(usersCount || 0);

      // --- Calcolo Divisione Scuole ---
      if (profiles) {
        let polo = 0, montale = 0, fermi = 0, sconosciuti = 0;
        profiles.forEach(p => {
          const school = p.school_name?.toLowerCase();
          if (school === 'polo') polo++;
          else if (school === 'montale') montale++;
          else if (school === 'fermi') fermi++;
          else sconosciuti++;
        });
        setSchoolStats({ polo, montale, fermi, sconosciuti });
      }

      const { data: videos, count: videosCount } = await supabase
        .from('public_videos')
        .select('user_id', { count: 'exact' });
      
      setTotalVideos(videosCount || 0);

      // Calcolo Distribuzione
      if (profiles && videos) {
        const videoMap: Record<string, number> = {};
        videos.forEach(v => {
          if (v.user_id) videoMap[v.user_id] = (videoMap[v.user_id] || 0) + 1;
        });

        let zero = 0;
        let one = 0;
        let twoPlus = 0;

        profiles.forEach(p => {
          const count = videoMap[p.id] || 0;
          if (count === 0) zero++;
          else if (count === 1) one++;
          else twoPlus++;
        });

        setDistribution({ zero, one, twoPlus });
      }

      // 2. FUNZIONE CONTEGGIO SESSIONI UNICHE
      const getUniqueCount = async (stepName: string) => {
        const { data, error } = await supabase
          .from('funnel_events')
          .select('session_id')
          .eq('step_name', stepName);
        
        if (error) return 0;
        const uniqueSessions = new Set(data?.map(item => item.session_id));
        return uniqueSessions.size;
      };

      // 3. RECUPERO DATI REGISTRAZIONE
      const [auth, start, photo, school] = await Promise.all([
        getUniqueCount('view_auth'),
        getUniqueCount('start_profile'),
        getUniqueCount('photo_added'),
        getUniqueCount('school_selected')
      ]);

      setFunnelStats({ auth, start, photo, school });

      // 4. RECUPERO DATI SODDISFAZIONE (Video)
      const [ready, shared, downloaded, pubPublic, pubPrivate] = await Promise.all([
        getUniqueCount('video_ready'),
        getUniqueCount('video_shared'),
        getUniqueCount('video_downloaded'),
        getUniqueCount('video_published'),
        getUniqueCount('video_saved_private')
      ]);

      setSatisfactionStats({
        videoReady: ready,
        shared: shared,
        downloaded: downloaded,
        publishedPublic: pubPublic,
        publishedPrivate: pubPrivate
      });

      // --- 5. CALCOLO PERFORMANCE (Killer Silenzioso) ---
      const { data: perfData } = await supabase
        .from('funnel_events')
        .select('session_id, step_name, created_at')
        .in('step_name', ['video_start', 'video_ready'])
        .order('created_at', { ascending: true });

      if (perfData && perfData.length > 0) {
        const sessions: Record<string, { start?: string, end?: string }> = {};
        
        perfData.forEach(event => {
          if (!sessions[event.session_id]) sessions[event.session_id] = {};
          if (event.step_name === 'video_start') sessions[event.session_id].start = event.created_at;
          if (event.step_name === 'video_ready') sessions[event.session_id].end = event.created_at;
        });

        const durations = Object.values(sessions)
          .filter(s => s.start && s.end)
          .map(s => (new Date(s.end!).getTime() - new Date(s.start!).getTime()) / 1000)
          .filter(d => d > 0 && d < 600); // Escludiamo sessioni morte o riprese dopo ore

        if (durations.length > 0) {
          const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
          const max = Math.max(...durations);
          setPerformance({
            avgSeconds: Math.round(avg),
            maxSeconds: Math.round(max),
            isStruggling: max > 120 || avg > 70
          });
        }
      }

      // --- 6. RECUPERO DATI BUDGET (Video Ultima Ora) ---
      const { count: hourCount } = await supabase
        .from('public_videos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);
      
      setLastHourVideos(hourCount || 0);

      // --- 7. CALCOLO RETENTION (La Vera Validazione) ---
      if (profiles) {
        // DAU: Utenti visti nelle ultime 24h
        const dauCount = profiles.filter(p => p.last_seen && p.last_seen > twentyFourHoursAgo).length;
        
        // Returning: Creati prima di oggi, ma attivi oggi
        const returningCount = profiles.filter(p => 
          p.created_at < startOfToday && 
          p.last_seen && p.last_seen > startOfToday
        ).length;

        // Stickiness: Utenti online ora (ultimi 15 min) che hanno già fatto video
        const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
        const onlineNowIds = profiles.filter(p => p.last_seen && p.last_seen > fifteenMinsAgo).map(p => p.id);
        
        let stickyCount = 0;
        if (onlineNowIds.length > 0 && videos) {
          // Usiamo il set di creatori di video che abbiamo già
          const videoCreators = new Set(videos.map(v => v.user_id));
          stickyCount = onlineNowIds.filter(id => videoCreators.has(id)).length;
        }
        
        const stickinessRatio = onlineNowIds.length > 0 ? Math.round((stickyCount / onlineNowIds.length) * 100) : 0;

        // Avg Sessions: Stima basata sui login (semplificata per ora basata sugli eventi)
        const { data: recentEvents } = await supabase
          .from('funnel_events')
          .select('session_id')
          .gte('created_at', startOfToday);
        
        let avgSessions = 0;
        if (recentEvents && dauCount > 0) {
          const uniqueSessionsToday = new Set(recentEvents.map(e => e.session_id)).size;
          avgSessions = Number((uniqueSessionsToday / dauCount).toFixed(1));
        }

        setRetentionStats({
          dau: dauCount,
          returningUsers: returningCount,
          stickinessRatio: stickinessRatio,
          avgSessions: avgSessions || 1.0 // Fallback a 1
        });
      }

    } catch (err) {
      console.error("Errore fetch dati:", err);
    }
  };

  const calcDrop = (start: number, end: number) => {
    if (start === 0) return 0;
    const drop = Math.round(((start - end) / start) * 100);
    return drop > 0 ? drop : 0;
  };

  // Funzione per calcolare la percentuale della scuola
  const calcSchoolPerc = (count: number) => {
    if (totalUsers === 0) return 0;
    return Math.round((count / totalUsers) * 100);
  };

  if (isLoading || isAuthorized === null) return <div className="h-screen bg-[#0A0A0A]" />;
  if (isAuthorized === false) return null;

  // Calcoli Soddisfazione
  const totalEngagement = satisfactionStats.shared + satisfactionStats.downloaded;
  const totalSaves = satisfactionStats.publishedPublic + satisfactionStats.publishedPrivate;

  // --- LOGICA CALCOLI BUDGET ---
  const totalSpend = totalVideos * COST_PER_VIDEO;
  const burnRateHourly = lastHourVideos * COST_PER_VIDEO;
  const remainingBudget = Math.max(0, ESTIMATED_BUDGET - totalSpend);
  const hoursRemaining = burnRateHourly > 0 ? (remainingBudget / burnRateHourly).toFixed(1) : "∞";

  return (
    <div className="h-[100dvh] w-full bg-[#0A0A0A] text-white font-sans overflow-hidden flex flex-col">
      
      {/* HEADER NAVIGAZIONE PANNELLO */}
      <nav className="flex-shrink-0 bg-zinc-900/50 border-b border-white/5 px-6 py-4 flex justify-between items-center z-50">
        <h1 className="text-yellow-400 font-black tracking-tighter uppercase italic flex items-center gap-2">
          <Zap size={16} fill="currentColor" />
          Admin_Room
        </h1>
        <div className="flex gap-4">
          <button 
            className="text-[10px] font-bold text-zinc-600 hover:text-white transition-colors"
            onClick={() => router.push('/gufo1117')}
          >
            PROGRESSI
          </button>
          <button className="text-[10px] font-bold text-white border-b-2 border-yellow-400 pb-1">
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
        
        {/* --- PERFORMANCE STRIP (Engine Control) --- */}
        <div className={`w-full max-w-7xl mx-auto mt-4 mb-4 bg-zinc-900/40 border ${performance.isStruggling ? 'border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'border-white/5'} p-6 rounded-[32px] backdrop-blur-md flex items-center justify-between transition-all duration-500`}>
          <div className="flex items-center gap-6">
            <div className={`p-4 rounded-2xl ${performance.isStruggling ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-cyan-500/10 text-cyan-400'}`}>
              <Timer size={24} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-400">Engine Performance</h2>
              <p className="text-[10px] text-zinc-600 font-bold uppercase">Monitoraggio latenza IA in tempo reale</p>
            </div>
          </div>

          <div className="flex gap-16 mr-10">
            <div className="text-center">
              <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-tighter">Tempo Medio</p>
              <p className={`text-5xl font-black italic tabular-nums ${performance.avgSeconds > 50 ? 'text-orange-400' : 'text-white'}`}>{performance.avgSeconds}s</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-tighter">Worst Case (Max)</p>
              <p className={`text-5xl font-black italic tabular-nums ${performance.maxSeconds > 90 ? 'text-red-500' : 'text-white'}`}>{performance.maxSeconds}s</p>
            </div>
            {performance.isStruggling && (
              <div className="flex flex-col items-center justify-center text-red-500 gap-1 border-l border-white/10 pl-16">
                <AlertTriangle size={24} />
                <span className="text-[8px] font-black uppercase tracking-tighter">Server Strain</span>
              </div>
            )}
          </div>
        </div>

        {/* --- FINANCIAL CONTROL (Budget e Burn Rate) --- */}
        <div className="w-full max-w-7xl mx-auto mb-10 bg-zinc-900/60 border border-white/10 rounded-[32px] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-400/10 rounded-xl">
                <DollarSign className="text-yellow-400" size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white italic">Financial Control</h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Burn rate e proiezione API</p>
              </div>
            </div>
            <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${burnRateHourly > 5 ? 'bg-red-500/10 border-red-500/20 text-red-500 animate-pulse' : 'bg-green-500/10 border-green-500/20 text-green-500'}`}>
              {burnRateHourly > 5 ? 'High Burn' : 'Safe Burn'}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-6 items-center">
            <div className="border-r border-white/5 pr-6">
              <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Spesa Totale</p>
              <p className="text-3xl font-black text-white italic tabular-nums">€{totalSpend.toFixed(2)}</p>
            </div>
            
            <div className="border-r border-white/5 pr-6">
              <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Burn Rate (Ultima Ora)</p>
              <p className="text-3xl font-black text-yellow-400 italic tabular-nums">€{burnRateHourly.toFixed(2)}<span className="text-sm ml-1 text-yellow-400/50">/h</span></p>
            </div>

            <div className="border-r border-white/5 pr-6">
              <p className="text-[9px] font-black uppercase text-zinc-500 mb-1">Costo Medio / Video</p>
              <p className="text-3xl font-black text-zinc-300 italic tabular-nums">€{COST_PER_VIDEO.toFixed(2)}</p>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1">
                <Timer size={12} /> Proiezione Fine Budget
              </p>
              <div className="flex items-center gap-3">
                <p className={`text-4xl font-black italic tabular-nums ${parseFloat(hoursRemaining as string) < 2 ? 'text-red-500' : 'text-green-400'}`}>
                  {hoursRemaining} <span className="text-lg">h</span>
                </p>
                {parseFloat(hoursRemaining as string) < 1 && burnRateHourly > 0 && (
                  <div className="flex items-center gap-1 bg-red-500/20 px-2 py-1 rounded-md">
                    <AlertOctagon size={12} className="text-red-500" />
                    <span className="text-[8px] font-black text-red-500 uppercase">Critical</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* --- RETENTION & STICKINESS (La Vera Validazione) --- */}
        <div className="w-full max-w-7xl mx-auto mb-10">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">User Retention</h2>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium">L'app è una droga o un giocattolo rotto?</p>
            </div>
            <div className="flex items-center gap-2 text-zinc-500 bg-zinc-900/40 px-4 py-2 rounded-xl border border-white/5">
              <ActivitySquare size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Live Metrics</span>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            {/* DAU */}
            <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[32px] backdrop-blur-md relative overflow-hidden group hover:bg-zinc-900/60 transition-colors">
              <Users className="absolute -bottom-4 -right-4 w-20 h-20 text-blue-500/10 group-hover:text-blue-500/20 transition-colors" />
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">DAU (Oggi)</p>
              <p className="text-5xl font-black italic text-white tabular-nums">{retentionStats.dau}</p>
              <p className="text-[8px] text-zinc-500 font-bold uppercase mt-2">Utenti attivi nelle 24h</p>
            </div>

            {/* Returning Users */}
            <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[32px] backdrop-blur-md relative overflow-hidden group hover:bg-zinc-900/60 transition-colors border-l-4 border-l-yellow-400">
              <RefreshCw className="absolute -bottom-4 -right-4 w-20 h-20 text-yellow-500/10 group-hover:text-yellow-500/20 transition-colors" />
              <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500/80 mb-2">Returning Users</p>
              <p className="text-5xl font-black italic text-yellow-400 tabular-nums">{retentionStats.returningUsers}</p>
              <p className="text-[8px] text-yellow-500/60 font-bold uppercase mt-2">Iscritti ieri, tornati oggi</p>
            </div>

            {/* Stickiness Ratio */}
            <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[32px] backdrop-blur-md relative overflow-hidden group hover:bg-zinc-900/60 transition-colors">
              <Zap className="absolute -bottom-4 -right-4 w-20 h-20 text-purple-500/10 group-hover:text-purple-500/20 transition-colors" />
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Stickiness Ratio</p>
              <p className="text-5xl font-black italic text-purple-400 tabular-nums">{retentionStats.stickinessRatio}%</p>
              <p className="text-[8px] text-zinc-500 font-bold uppercase mt-2">Power user tra gli online</p>
            </div>

            {/* Sessioni per Utente */}
            <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[32px] backdrop-blur-md relative overflow-hidden group hover:bg-zinc-900/60 transition-colors">
              <PlayCircle className="absolute -bottom-4 -right-4 w-20 h-20 text-green-500/10 group-hover:text-green-500/20 transition-colors" />
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Avg Sessions</p>
              <p className="text-5xl font-black italic text-green-400 tabular-nums">{retentionStats.avgSessions}</p>
              <p className="text-[8px] text-zinc-500 font-bold uppercase mt-2">Aperture app per utente</p>
            </div>
          </div>
        </div>

        {/* --- STRISCIA 1: REGISTRATION FUNNEL --- */}
        <div className="w-full max-w-7xl mx-auto mt-4 mb-10">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">Registration Funnel</h2>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium">Analisi abbandono registrazione</p>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl text-right shadow-[0_0_30px_rgba(239,68,68,0.1)]">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">Signup Drop Rate</p>
              <p className="text-3xl font-black text-red-500 italic">
                {funnelStats.auth > 0 ? Math.round(((funnelStats.auth - totalUsers) / funnelStats.auth) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar pb-4">
            <div className="min-w-[900px] flex items-center justify-between bg-zinc-900/40 border border-white/5 p-8 rounded-[40px] backdrop-blur-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-green-500/5 pointer-events-none" />

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="bg-blue-500/10 p-4 rounded-2xl mb-4 border border-blue-500/20"><Mail className="w-6 h-6 text-blue-400" /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Pagina Auth</h4>
                <p className="text-5xl font-black text-white italic tabular-nums">{funnelStats.auth}</p>
              </div>

              <div className="flex flex-col items-center px-4 relative z-10">
                <span className="text-[10px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full mb-3 shadow-sm">-{calcDrop(funnelStats.auth, funnelStats.start)}%</span>
                <ArrowRight className="w-6 h-6 text-zinc-700" />
              </div>

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="bg-yellow-400/10 p-4 rounded-2xl mb-4 border border-yellow-400/20"><MousePointer2 className="w-6 h-6 text-yellow-400" /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Inizio Profilo</h4>
                <p className="text-5xl font-black text-white italic tabular-nums">{funnelStats.start}</p>
              </div>

              <div className="flex flex-col items-center px-4 relative z-10">
                <span className="text-[10px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full mb-3 shadow-sm">-{calcDrop(funnelStats.start, funnelStats.photo)}%</span>
                <ArrowRight className="w-6 h-6 text-zinc-700" />
              </div>

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="bg-purple-400/10 p-4 rounded-2xl mb-4 border border-purple-400/20"><Camera className="w-6 h-6 text-purple-400" /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Foto IA</h4>
                <p className="text-5xl font-black text-white italic tabular-nums">{funnelStats.photo}</p>
              </div>

              <div className="flex flex-col items-center px-4 relative z-10">
                <span className="text-[10px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full mb-3 shadow-sm">-{calcDrop(funnelStats.photo, funnelStats.school)}%</span>
                <ArrowRight className="w-6 h-6 text-zinc-700" />
              </div>

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="bg-orange-400/10 p-4 rounded-2xl mb-4 border border-orange-400/20"><School className="w-6 h-6 text-orange-400" /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Scuola</h4>
                <p className="text-5xl font-black text-white italic tabular-nums">{funnelStats.school}</p>
              </div>

              <div className="flex flex-col items-center px-4 relative z-10">
                <span className="text-[10px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full mb-3 shadow-sm">-{calcDrop(funnelStats.school, totalUsers)}%</span>
                <ArrowRight className="w-6 h-6 text-zinc-700" />
              </div>

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="bg-green-500/10 p-4 rounded-2xl mb-4 border border-green-500/20"><CheckCircle className="w-6 h-6 text-green-500" /></div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Salvato</h4>
                <p className="text-5xl font-black text-white italic tabular-nums drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">{totalUsers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- STRISCIA 2: SATISFACTION FUNNEL --- */}
        <div className="w-full max-w-7xl mx-auto mt-4 mb-10">
          <div className="flex items-center justify-between mb-4 px-2">
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">Satisfaction Funnel</h2>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium">L' "Aha! Moment": Qualità vs Vergogna</p>
            </div>
            <div className="bg-yellow-400/10 border border-yellow-400/20 px-6 py-3 rounded-2xl text-right shadow-[0_0_30px_rgba(251,191,36,0.1)]">
              <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest mb-1">Publish Rate</p>
              <p className="text-3xl font-black text-yellow-400 italic">
                {satisfactionStats.videoReady > 0 ? Math.round((totalSaves / satisfactionStats.videoReady) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar pb-4">
            <div className="min-w-[900px] flex items-center justify-between bg-zinc-900/40 border border-white/5 p-8 rounded-[40px] backdrop-blur-2xl shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/5 via-transparent to-pink-500/5 pointer-events-none" />

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="bg-zinc-500/10 p-4 rounded-2xl mb-4 border border-zinc-500/20">
                  <PlayCircle className="w-6 h-6 text-zinc-400" />
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Video Visti</h4>
                <p className="text-5xl font-black text-white italic tabular-nums">{satisfactionStats.videoReady}</p>
                <p className="text-[8px] text-zinc-600 font-bold uppercase mt-2 text-center max-w-[120px]">Utenti che hanno visto il risultato IA</p>
              </div>

              <div className="flex flex-col items-center px-6 relative z-10">
                <ArrowRight className="w-6 h-6 text-zinc-700" />
              </div>

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="flex gap-2 mb-4">
                  <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20"><Share2 className="w-5 h-5 text-blue-400" /></div>
                  <div className="bg-purple-500/10 p-3 rounded-2xl border border-purple-500/20"><Download className="w-5 h-5 text-purple-400" /></div>
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Engagement</h4>
                <p className="text-4xl font-black text-white italic tabular-nums">{totalEngagement}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-[9px] text-blue-400 font-bold">Share: {satisfactionStats.shared}</span>
                  <span className="text-[9px] text-purple-400 font-bold">Down: {satisfactionStats.downloaded}</span>
                </div>
              </div>

              <div className="flex flex-col items-center px-6 relative z-10">
                <ArrowRight className="w-6 h-6 text-zinc-700" />
              </div>

              <div className="flex flex-col items-center flex-1 relative z-10">
                <div className="flex gap-2 mb-4">
                  <div className="bg-yellow-400/10 p-3 rounded-2xl border border-yellow-400/20"><Globe className="w-5 h-5 text-yellow-400" /></div>
                  <div className="bg-zinc-500/10 p-3 rounded-2xl border border-zinc-500/20"><Lock className="w-5 h-5 text-zinc-400" /></div>
                </div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Salvati (Total)</h4>
                <p className="text-5xl font-black text-white italic tabular-nums drop-shadow-[0_0_15px_rgba(251,191,36,0.3)]">{totalSaves}</p>
                <div className="flex gap-4 mt-2">
                  <span className="text-[9px] text-yellow-400 font-bold">Pubblici: {satisfactionStats.publishedPublic}</span>
                  <span className="text-[9px] text-zinc-400 font-bold">Privati: {satisfactionStats.publishedPrivate}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- STRISCIA 3: LA METRICA DELLA DROGA (Distribuzione) --- */}
        <div className="w-full max-w-7xl mx-auto mt-4 mb-12">
          <div className="flex items-center justify-between mb-6 px-2">
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">Distribuzione Produzione</h2>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium">Volumi di generazione per utente</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/20 px-6 py-3 rounded-2xl text-right">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Media Reale</p>
              <p className="text-3xl font-black text-blue-400 italic">
                {totalUsers > 0 ? (totalVideos / totalUsers).toFixed(1) : 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* GRUPPO 1: ZERO VIDEO */}
            <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[40px] backdrop-blur-md relative overflow-hidden group hover:bg-zinc-900/60 transition-colors">
              <UserMinus className="absolute -bottom-4 -right-4 w-24 h-24 text-zinc-800/50 group-hover:text-zinc-800 transition-colors" />
              <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-3">Spettatori (0 video)</h4>
              <p className="text-6xl font-black italic text-zinc-400 tabular-nums mb-6">{distribution.zero}</p>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-600 transition-all duration-1000" style={{ width: `${totalUsers > 0 ? (distribution.zero / totalUsers) * 100 : 0}%` }}></div>
              </div>
              <p className="text-[10px] text-zinc-500 font-bold mt-3">Hanno creato il profilo ma non hanno ancora girato nulla.</p>
            </div>

            {/* GRUPPO 2: 1 VIDEO */}
            <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[40px] backdrop-blur-md relative overflow-hidden group hover:bg-zinc-900/60 transition-colors">
              <Film className="absolute -bottom-4 -right-4 w-24 h-24 text-blue-900/20 group-hover:text-blue-900/30 transition-colors" />
              <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-500 mb-3">Debuttanti (1 video)</h4>
              <p className="text-6xl font-black italic text-blue-400 tabular-nums mb-6">{distribution.one}</p>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${totalUsers > 0 ? (distribution.one / totalUsers) * 100 : 0}%` }}></div>
              </div>
              <p className="text-[10px] text-blue-400/60 font-bold mt-3">Hanno provato l&apos;esperienza una volta. Curiosi.</p>
            </div>

            {/* GRUPPO 3: 2+ VIDEO (LA DROGA) */}
            <div className="bg-yellow-400/5 border border-yellow-400/20 p-8 rounded-[40px] backdrop-blur-md relative overflow-hidden ring-1 ring-yellow-400/20 shadow-[0_0_50px_rgba(251,191,36,0.05)] group hover:bg-yellow-400/10 transition-colors">
              <Trophy className="absolute -bottom-4 -right-4 w-24 h-24 text-yellow-400/10 group-hover:text-yellow-400/20 transition-colors" />
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-yellow-400">Star (2+ video)</h4>
                <div className="px-3 py-1 bg-yellow-400 text-black text-[9px] font-black uppercase tracking-widest rounded-full animate-pulse shadow-[0_0_15px_rgba(251,191,36,0.5)]">Replay</div>
              </div>
              <p className="text-6xl font-black italic text-yellow-400 tabular-nums mb-6 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]">{distribution.twoPlus}</p>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 transition-all duration-1000" style={{ width: `${totalUsers > 0 ? (distribution.twoPlus / totalUsers) * 100 : 0}%` }}></div>
              </div>
              <p className="text-[10px] text-yellow-400/80 font-bold mt-3">L&apos;app ha creato dipendenza. Il vero target per Martedì.</p>
            </div>
          </div>
        </div>

        {/* --- STRISCIA 4: CLASSIFICA SCUOLE --- */}
        <div className="w-full max-w-7xl mx-auto mt-4 mb-20">
          <div className="flex items-center justify-between mb-6 px-2">
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">School Leaderboard</h2>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium">Validazione sul territorio (Tasso di adozione)</p>
            </div>
            <div className="flex items-center gap-2 text-zinc-500 bg-zinc-900/40 px-4 py-2 rounded-xl border border-white/5">
              <GraduationCap size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Target Demografico</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* POLO */}
            <div className="bg-gradient-to-br from-indigo-500/10 to-transparent border border-indigo-500/20 p-8 rounded-[40px] relative overflow-hidden backdrop-blur-md hover:border-indigo-500/40 transition-colors">
              <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-6 flex items-center justify-between">
                <span>Il Polo</span>
                <span className="text-[10px] text-indigo-400/80 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">{calcSchoolPerc(schoolStats.polo)}%</span>
              </h4>
              <div className="flex items-end gap-4">
                <p className="text-7xl font-black italic text-white tabular-nums drop-shadow-lg">{schoolStats.polo}</p>
                <p className="text-[10px] text-indigo-400/60 font-bold uppercase mb-2 leading-tight">Utenti <br/>Registrati</p>
              </div>
            </div>

            {/* MONTALE */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 p-8 rounded-[40px] relative overflow-hidden backdrop-blur-md hover:border-emerald-500/40 transition-colors">
              <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-6 flex items-center justify-between">
                <span>Montale</span>
                <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">{calcSchoolPerc(schoolStats.montale)}%</span>
              </h4>
              <div className="flex items-end gap-4">
                <p className="text-7xl font-black italic text-white tabular-nums drop-shadow-lg">{schoolStats.montale}</p>
                <p className="text-[10px] text-emerald-400/60 font-bold uppercase mb-2 leading-tight">Utenti <br/>Registrati</p>
              </div>
            </div>

            {/* FERMI */}
            <div className="bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/20 p-8 rounded-[40px] relative overflow-hidden backdrop-blur-md hover:border-rose-500/40 transition-colors">
              <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-rose-400 mb-6 flex items-center justify-between">
                <span>Fermi</span>
                <span className="text-[10px] text-rose-400/80 bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">{calcSchoolPerc(schoolStats.fermi)}%</span>
              </h4>
              <div className="flex items-end gap-4">
                <p className="text-7xl font-black italic text-white tabular-nums drop-shadow-lg">{schoolStats.fermi}</p>
                <p className="text-[10px] text-rose-400/60 font-bold uppercase mb-2 leading-tight">Utenti <br/>Registrati</p>
              </div>
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
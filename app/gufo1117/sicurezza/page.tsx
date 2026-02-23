'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Zap, AlertTriangle, TerminalSquare, Server, BrainCircuit, Database, Clock, Activity, ShieldAlert, CheckCircle2, Power, AlertOctagon } from 'lucide-react';

interface DebugLog {
  id: string;
  created_at: string;
  error_message: string;
  context: string;
  device_info: string;
}

export default function SicurezzaPage() {
  const router = useRouter();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [timeoutCount, setTimeoutCount] = useState(0);
  
  // --- NUOVI STATI PER IL KILL-SWITCH ---
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);

  // Semafori di stato
  const [systemStatus, setSystemStatus] = useState({
    database: 'online', // 'online' | 'error'
    ai_replicate: 'online',
    storage: 'online'
  });

  const ADMIN_UUID = "d9364dcd-ceba-4120-9ace-57ce5c1612d8"; 

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user?.id === ADMIN_UUID) {
        setIsAuthorized(true);
        await fetchSicurezzaData();
      } else {
        setIsAuthorized(false);
        router.push('/'); 
      }
      setIsLoading(false);
    };

    checkAdmin();
    const interval = setInterval(fetchSicurezzaData, 15000); // Aggiornamento più rapido per gli errori
    return () => clearInterval(interval);
  }, [router]);

  const fetchSicurezzaData = async () => {
    try {
      const now = new Date();
      const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

      // --- RECUPERO STATO MANUTENZIONE (KILL-SWITCH) ---
      const { data: config } = await supabase
        .from('system_config')
        .select('maintenance_mode')
        .eq('id', 1)
        .single();
      
      if (config) setIsMaintenance(config.maintenance_mode);

      // 1. RECUPERO LOG ERRORI (SCATOLA NERA)
      const { data: errorLogs, error: logErr } = await supabase
        .from('debug_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (errorLogs) setLogs(errorLogs);

      // 2. CALCOLO STATO SISTEMI (SEMAFORI)
      let dbStatus = logErr ? 'error' : 'online';
      let aiStatus = 'online';
      let storageStatus = 'online';

      if (errorLogs) {
        const recentErrors = errorLogs.filter(l => l.created_at > fifteenMinsAgo);
        
        const hasAIErrors = recentErrors.some(l => l.context?.includes('API') || l.error_message?.toLowerCase().includes('replicate'));
        if (hasAIErrors) aiStatus = 'error';

        const hasStorageErrors = recentErrors.some(l => l.context?.toLowerCase().includes('storage'));
        if (hasStorageErrors) storageStatus = 'error';
      }

      setSystemStatus({
        database: dbStatus,
        ai_replicate: aiStatus,
        storage: storageStatus
      });

      // 3. CALCOLO TIMEOUT GENERAZIONI (Ghosting IA)
      const { data: funnelData } = await supabase
        .from('funnel_events')
        .select('session_id, step_name, created_at')
        .in('step_name', ['video_start', 'video_ready', 'video_failed'])
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()); // Ultime 24h

      if (funnelData) {
        const sessions: Record<string, { start?: Date, end?: Date }> = {};
        
        funnelData.forEach(e => {
          if (!sessions[e.session_id]) sessions[e.session_id] = {};
          if (e.step_name === 'video_start') sessions[e.session_id].start = new Date(e.created_at);
          if (e.step_name === 'video_ready' || e.step_name === 'video_failed') sessions[e.session_id].end = new Date(e.created_at);
        });

        let timeouts = 0;
        Object.values(sessions).forEach(s => {
          // Se c'è un inizio, NON c'è una fine, e sono passati più di 3 minuti (180 sec)
          if (s.start && !s.end) {
            const diffSeconds = (now.getTime() - s.start.getTime()) / 1000;
            if (diffSeconds > 180) {
              timeouts++;
            }
          }
        });
        setTimeoutCount(timeouts);
      }

    } catch (err) {
      console.error("Errore fetch sicurezza:", err);
    }
  };

  // --- FUNZIONE PER ATTIVARE IL KILL-SWITCH ---
  const handleToggleKillSwitch = async () => {
    if (!confirmKill) {
      setConfirmKill(true);
      setTimeout(() => setConfirmKill(false), 3000); // Scade dopo 3 secondi
      return;
    }

    try {
      const { error } = await supabase
        .from('system_config')
        .update({ maintenance_mode: !isMaintenance, updated_at: new Date().toISOString() })
        .eq('id', 1);

      if (error) throw error;
      
      setIsMaintenance(!isMaintenance);
      setConfirmKill(false);

      // Log di sicurezza manuale
      await supabase.from('debug_logs').insert([{
        device_info: "Admin_Panel",
        error_message: `EMERGENCY ACTION: Kill-Switch ${!isMaintenance ? 'ATTIVATO' : 'DISATTIVATO'} dall'amministratore.`,
        context: "KILL_SWITCH_STATUS"
      }]);

    } catch (err) {
      alert("Errore nell'esecuzione del Kill-Switch: " + (err as Error).message);
    }
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
          <button 
            className="text-[10px] font-bold text-zinc-600 hover:text-white transition-colors"
            onClick={() => router.push('/gufo1117')}
          >
            PROGRESSI
          </button>
          <button 
            className="text-[10px] font-bold text-zinc-600 hover:text-white transition-colors"
            onClick={() => router.push('/gufo1117/utenti')}
          >
            UTENTI
          </button>
          <button className="text-[10px] font-bold text-white border-b-2 border-red-500 pb-1">
            ERRORI
          </button>
        </div>
      </nav>

      {/* CONTENUTO CENTRALE - SCROLLABILE */}
      <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/20 via-black to-black">
        
        {/* --- TITOLO PAGINA --- */}
        <div className="w-full max-w-7xl mx-auto mt-4 mb-8">
          <div className="flex items-center justify-between px-2 border-b border-white/5 pb-4">
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tight uppercase flex items-center gap-3">
                <ShieldAlert className="text-red-500" /> System Diagnostics
              </h2>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.2em] font-medium mt-1">Monitoraggio Stabilità e Scatola Nera</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-lg">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Live Sync</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-7xl mx-auto grid grid-cols-12 gap-8 mb-12">
          
          {/* COLONNA SINISTRA: SEMAFORI, KILL-SWITCH E TIMEOUT */}
          <div className="col-span-4 space-y-8">
            
            {/* 0. PANIC BUTTON (IL SOFT KILL) */}
            <div className={`p-8 rounded-[40px] border ${isMaintenance ? 'bg-red-500/10 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.2)]' : 'bg-zinc-900/40 border-white/5'} transition-all duration-500 relative overflow-hidden`}>
              <div className="relative z-10">
                <h3 className={`text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2 ${isMaintenance ? 'text-red-500' : 'text-zinc-500'}`}>
                  <AlertOctagon size={14} /> Panic Button System
                </h3>
                
                <button 
                  onClick={handleToggleKillSwitch}
                  className={`w-full aspect-square rounded-full flex flex-col items-center justify-center gap-3 border-8 transition-all duration-300 active:scale-95 shadow-2xl ${
                    isMaintenance 
                      ? 'bg-green-500 border-green-500/20 text-black hover:bg-green-400' 
                      : 'bg-red-600 border-red-900/50 text-white hover:bg-red-500'
                  }`}
                >
                  <Power size={56} strokeWidth={3} />
                  <span className="font-black text-[11px] uppercase tracking-tighter">
                    {confirmKill ? 'CONFERMA?' : isMaintenance ? 'DISATTIVA BLOCCO' : 'ATTIVA KILL-SWITCH'}
                  </span>
                </button>

                <div className="mt-6 text-center">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isMaintenance ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`}>
                    {isMaintenance ? 'STATO: APP BLOCCATA' : 'STATO: SISTEMA NOMINALE'}
                  </p>
                </div>
              </div>
              {isMaintenance && <div className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />}
            </div>

            {/* 1. SEMAFORI DI STATO */}
            <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-[32px] backdrop-blur-md">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-6 flex items-center gap-2">
                <Activity size={14} /> Stato Servizi (Ultimi 15 min)
              </h3>
              
              <div className="space-y-4">
                {/* AI / Replicate */}
                <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <BrainCircuit className={systemStatus.ai_replicate === 'online' ? 'text-green-500' : 'text-red-500'} size={20} />
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-wider">Motore IA</p>
                      <p className="text-[9px] text-zinc-500 uppercase">Replicate API</p>
                    </div>
                  </div>
                  {systemStatus.ai_replicate === 'online' ? (
                    <CheckCircle2 className="text-green-500" size={20} />
                  ) : (
                    <AlertTriangle className="text-red-500 animate-pulse" size={20} />
                  )}
                </div>

                {/* Database */}
                <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <Database className={systemStatus.database === 'online' ? 'text-green-500' : 'text-red-500'} size={20} />
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-wider">Database</p>
                      <p className="text-[9px] text-zinc-500 uppercase">Supabase SQL</p>
                    </div>
                  </div>
                  {systemStatus.database === 'online' ? (
                    <CheckCircle2 className="text-green-500" size={20} />
                  ) : (
                    <AlertTriangle className="text-red-500 animate-pulse" size={20} />
                  )}
                </div>

                {/* Storage */}
                <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <Server className={systemStatus.storage === 'online' ? 'text-green-500' : 'text-red-500'} size={20} />
                    <div>
                      <p className="text-[11px] font-bold text-white uppercase tracking-wider">Storage</p>
                      <p className="text-[9px] text-zinc-500 uppercase">Bucket Media</p>
                    </div>
                  </div>
                  {systemStatus.storage === 'online' ? (
                    <CheckCircle2 className="text-green-500" size={20} />
                  ) : (
                    <AlertTriangle className="text-red-500 animate-pulse" size={20} />
                  )}
                </div>
              </div>
            </div>

            {/* 2. ALERT TIMEOUT */}
            <div className={`bg-zinc-900/40 border ${timeoutCount > 0 ? 'border-orange-500/30' : 'border-white/5'} p-8 rounded-[32px] backdrop-blur-md relative overflow-hidden group`}>
              <Clock className={`absolute -bottom-4 -right-4 w-24 h-24 ${timeoutCount > 0 ? 'text-orange-500/10' : 'text-zinc-800/50'}`} />
              <div className="flex justify-between items-start mb-2 relative z-10">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-zinc-500">Timeout IA (24h)</h4>
                {timeoutCount > 0 && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-500 text-[8px] font-black uppercase rounded animate-pulse">Warning</span>}
              </div>
              <p className={`text-6xl font-black italic tabular-nums relative z-10 ${timeoutCount > 0 ? 'text-orange-400' : 'text-zinc-400'}`}>
                {timeoutCount}
              </p>
              <p className="text-[10px] text-zinc-500 font-bold mt-2 relative z-10 leading-relaxed">
                Generazioni abbandonate dal server (Nessuna risposta dopo 3 minuti).
              </p>
            </div>

          </div>

          {/* COLONNA DESTRA: LA SCATOLA NERA */}
          <div className="col-span-8 flex flex-col h-[85vh]">
            <div className="bg-zinc-900/40 border border-white/5 rounded-[32px] backdrop-blur-md flex-1 flex flex-col overflow-hidden">
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/20">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
                  <TerminalSquare size={16} className="text-red-500" /> La Scatola Nera
                </h3>
                <span className="text-[9px] font-bold text-zinc-600 uppercase">Ultimi 50 Eventi Critici</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
                {logs.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 opacity-50">
                    <CheckCircle2 size={48} className="mb-4" />
                    <p className="text-xs font-bold uppercase tracking-widest">Nessun Errore Registrato</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="bg-black/60 border border-red-500/10 p-4 rounded-2xl hover:border-red-500/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-wider bg-red-500/10 px-2 py-1 rounded">
                          {log.context}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          {new Date(log.created_at).toLocaleString('it-IT', { 
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-zinc-300 leading-relaxed break-words">
                        {log.error_message}
                      </p>
                      {log.device_info && (
                        <p className="text-[8px] text-zinc-600 font-mono mt-3 uppercase border-t border-white/5 pt-2">
                          Client: {log.device_info}
                        </p>
                      )}
                    </div>
                  ))
                )}
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
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        body { background-color: #0A0A0A; }
      `}</style>
    </div>
  );
}
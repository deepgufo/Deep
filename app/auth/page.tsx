'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mail, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';

type ViewMode = 'initial' | 'login' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<ViewMode>('initial');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [emailWarning, setEmailWarning] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // --- STATI WAITLIST ---
  const [showWaitlistInput, setShowWaitlistInput] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistResult, setWaitlistResult] = useState<{ position: number } | null>(null);
  const [jitter, setJitter] = useState(0);

  const BASE_OFFSET = 453;

  // --- LOGICA OSCILLAZIONE CONTATORE ---
  useEffect(() => {
    if (!waitlistResult) return;

    const interval = setInterval(() => {
      // Oscillazione tra -1, 0, +1 per dare l'idea di movimento in tempo reale
      setJitter(Math.floor(Math.random() * 3) - 1);
    }, 2000);

    return () => clearInterval(interval);
  }, [waitlistResult]);

  // --- INIZIO AGGIUNTA FUNNEL TRACKING ---
  const trackFunnel = async (stepName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let funnelSid = localStorage.getItem('funnel_sid');
      if (!funnelSid) {
        funnelSid = Math.random().toString(36).substring(7);
        localStorage.setItem('funnel_sid', funnelSid);
      }

      await supabase.from('funnel_events').insert({
        step_name: stepName,
        user_id: session?.user?.id || null,
        session_id: funnelSid
      });
    } catch (err) {
      console.error('Errore tracciamento funnel:', err);
    }
  };

  useEffect(() => {
    // Traccia l'arrivo dell'utente sulla pagina Auth
    trackFunnel('view_auth');
  }, []);
  // --- FINE AGGIUNTA FUNNEL TRACKING ---

  const checkEmailType = (email: string): void => {
    if (!email) {
      setEmailWarning('');
      return;
    }
    
    const emailLower = email.toLowerCase();
    // MODIFICA: Controllo specifico per il dominio richiesto o whitelist admin
    const isSchoolEmail = emailLower.endsWith('@fermipolomontale.edu.it');
    const isAdminWhitelist = emailLower === 'gufo17@gmail.com';
    
    if (!isSchoolEmail && !isAdminWhitelist) {
      setEmailWarning('Devi usare la tua email @fermipolomontale.edu.it per accedere');
    } else {
      setEmailWarning('');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const emailLower = signupEmail.toLowerCase();
    const isSchoolEmail = emailLower.endsWith('@fermipolomontale.edu.it');
    const isAdminWhitelist = emailLower === 'gufo17@gmail.com';

    // MODIFICA: Blocco registrazione se il dominio non è corretto e non è in whitelist
    if (!isSchoolEmail && !isAdminWhitelist) {
      setError('Registrazione consentita solo con email @fermipolomontale.edu.it');
      return;
    }

    if (signupPassword.length < 6) {
      setError('La password deve contenere almeno 6 caratteri');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
      });
      
      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      // Login automatico dopo registrazione
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: signupEmail,
        password: signupPassword,
      });
      
      if (signInError || !signInData.user) {
        setError('Registrazione completata ma login fallito. Riprova ad accedere.');
        setIsLoading(false);
        return;
      }

      // Utente appena registrato → sempre vai a completamento profilo
      router.refresh();
      console.log('Nuovo utente registrato, redirect a /completamento-profilo');
      router.push('/completamento-profilo');
      
    } catch (error: any) {
      setError('Si è verificato un errore durante la registrazione');
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailLower = loginEmail.toLowerCase();
    const isSchoolEmail = emailLower.endsWith('@fermipolomontale.edu.it');
    const isAdminWhitelist = emailLower === 'gufo17@gmail.com';

    // MODIFICA: Blocco login se il dominio non è corretto e non è in whitelist
    if (!isSchoolEmail && !isAdminWhitelist) {
      setError('Accesso consentito solo con email @fermipolomontale.edu.it');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      
      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError('Errore durante il login');
        setIsLoading(false);
        return;
      }

      // Controlla se il profilo esiste già
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      router.refresh();

      // Se il profilo non esiste (PGRST116) o altri errori, vai al completamento
      if (profileError && profileError.code === 'PGRST116') {
        console.log('Profilo non trovato (PGRST116), redirect a /completamento-profilo');
        router.push('/completamento-profilo');
      } else if (existingProfile && !profileError) {
        console.log('Profilo esistente trovato, redirect a /profilo');
        router.push('/profilo');
      } else {
        // Altri errori → completamento profilo per sicurezza
        console.log('Errore verifica profilo o profilo non trovato, redirect a /completamento-profilo');
        router.push('/completamento-profilo');
      }
      
    } catch (error: any) {
      setError('Si è verificato un errore durante il login');
      setIsLoading(false);
    }
  };

  const handleJoinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.includes('@')) {
      alert("Inserisci un'email valida! 📧");
      return;
    }

    setIsSubmittingWaitlist(true);
    trackFunnel('waitlist_submit_attempt');

    try {
      const { error: insertError } = await supabase
        .from('waitlist')
        .insert([{ email: waitlistEmail }]);

      if (insertError && insertError.code !== '23505') {
        throw insertError;
      }

      const { count, error: countError } = await supabase
        .from('waitlist')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      const currentCount = count || 0;
      setWaitlistResult({ position: BASE_OFFSET + currentCount });
      trackFunnel('waitlist_success');
      
    } catch (err) {
      console.error("Errore waitlist:", err);
      alert("C'è stato un problema. Riprova tra poco!");
    } finally {
      setIsSubmittingWaitlist(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      <div className="absolute inset-0 bg-black">
        <div 
          className="absolute inset-0 opacity-80"
          style={{
            background: 'radial-gradient(circle at center, rgba(17, 24, 39, 0.8) 0%, rgba(0, 0, 0, 0.95) 50%, rgba(0, 0, 0, 1) 100%)'
          }}
        ></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {viewMode === 'initial' && (
          <div className="animate-fadeIn">
            <div className="text-center mb-10">
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  <span className="text-white font-bold text-2xl tracking-wider">Deep</span>
                </div>
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">Benvenuto</h1>
              <p className="text-gray-400">Scegli come accedere</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setViewMode('login')}
                className="w-full py-4 px-6 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold text-lg rounded-lg transition-all duration-300"
              >
                ACCEDI
              </button>
              <button
                onClick={() => setViewMode('signup')}
                className="w-full py-4 px-6 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold text-lg rounded-lg transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
              >
                REGISTRATI
              </button>
            </div>
          </div>
        )}

        {viewMode === 'login' && (
          <div className="animate-fadeIn">
            <button
              onClick={() => setViewMode('initial')}
              className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
            >
              ← Indietro
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Accedi</h2>
              <p className="text-gray-400">Bentornato!</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 transition-all"
                  placeholder="cognome.nome@fermipolomontale.edu.it"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 transition-all"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold text-lg rounded-lg transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Accesso in corso...' : 'ACCEDI'}
              </button>
            </form>
          </div>
        )}

        {viewMode === 'signup' && (
          <div className="animate-fadeIn">
            <button
              onClick={() => setViewMode('initial')}
              className="text-gray-400 hover:text-white mb-6 flex items-center gap-2"
            >
              ← Indietro
            </button>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Registrati</h2>
              <p className="text-gray-400">Crea il tuo account</p>
            </div>

            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => {
                    setSignupEmail(e.target.value);
                    checkEmailType(e.target.value);
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 transition-all"
                  placeholder="cognome.nome@fermipolomontale.edu.it"
                  required
                  disabled={isLoading}
                />
                {emailWarning && (
                  <p className="text-xs text-yellow-400 mt-2">{emailWarning}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 transition-all"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">Minimo 6 caratteri</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
              )}

              {/* CLAUSOLA LEGALE OBBLIGATORIA */}
              <div className="text-[11px] text-gray-500 text-center leading-relaxed px-2">
                Cliccando su Registrati accetti i nostri{' '}
                <Link href="/termini_privacy" className="text-yellow-400/80 underline decoration-yellow-400/30 hover:text-yellow-400 transition-colors">
                  Termini di Servizio
                </Link>{' '}
                e la{' '}
                <Link href="/termini_privacy" className="text-yellow-400/80 underline decoration-yellow-400/30 hover:text-yellow-400 transition-colors">
                  Privacy Policy
                </Link>
                .
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold text-lg rounded-lg transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(251,191,36,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Registrazione in corso...' : 'REGISTRATI'}
              </button>
            </form>

            {/* --- SEZIONE WAITLIST --- */}
            <div className="mt-10 pt-8 border-t border-white/10">
              {!waitlistResult ? (
                <div className="text-center space-y-4">
                  <p className="text-gray-500 text-sm">
                    Non sei del Polo-Fermi-Montale?<br />
                    Mettiti in lista per essere il prossimo
                  </p>

                  {!showWaitlistInput ? (
                    <button
                      onClick={() => setShowWaitlistInput(true)}
                      className="w-full py-3 border border-yellow-400/50 text-white font-semibold rounded-lg hover:bg-yellow-400/5 transition-all"
                    >
                      mettiti in lisata!
                    </button>
                  ) : (
                    <form onSubmit={handleJoinWaitlist} className="relative flex items-center animate-slideIn">
                      <input
                        autoFocus
                        type="email"
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        placeholder="Inserisci la tua email..."
                        className="w-full px-4 py-3 bg-white/5 border border-yellow-400 rounded-lg text-white placeholder-gray-600 focus:outline-none"
                        required
                      />
                      <button
                        type="submit"
                        disabled={isSubmittingWaitlist}
                        className="absolute right-2 p-2 bg-yellow-400 text-black rounded-md disabled:opacity-50"
                      >
                        {isSubmittingWaitlist ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="p-6 bg-yellow-400/5 border border-yellow-400/20 rounded-xl text-center space-y-4 animate-fadeIn">
                  <div className="flex justify-center">
                    <CheckCircle2 className="w-10 h-10 text-yellow-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-white font-bold">Sei in lista d'attesa.</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Attualmente ci sono <span className="text-white font-bold">{(waitlistResult.position - 1) + jitter}</span> Utenti prima di te.
                      Ti invieremo un codice non appena i server saranno pronti.
                    </p>
                    <div className="pt-2">
                      <span className="inline-block px-3 py-1 bg-yellow-400 text-black text-[10px] font-black rounded-full uppercase">
                        Sei il numero #{waitlistResult.position} in lista d'attesa
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
      `}</style>
    </main>
  );
}
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, User, School } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Gender = 'attore' | 'attrice' | '';

export default function CompletamentoProfiloPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const genderRef = useRef<HTMLDivElement>(null);
  
  // --- FUNZIONE DI TRACCIAMENTO FUNNEL ---
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
  // ---------------------------------------

  // --- MODIFICA: RISVEGLIO SUPABASE & TRACCIAMENTO INIZIO ---
  useEffect(() => {
    const wakeUpSupabase = async () => {
      try {
        await supabase.auth.getSession();
      } catch (e) {
        // Ignoriamo errori qui, serve solo a scaldare la connessione
      }
    };
    wakeUpSupabase();
    
    // Traccia l'arrivo sulla pagina di completamento profilo
    trackFunnel('start_profile');
  }, []);
  // ------------------------------------

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [schoolName, setSchoolName] = useState(''); 
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [shakeFields, setShakeFields] = useState(false);

  // Stato per evitare spam di eventi "school_selected"
  const [hasTrackedSchool, setHasTrackedSchool] = useState(false);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Seleziona un file immagine');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('L\'immagine deve essere inferiore a 5MB');
        return;
      }

      setSelectedFile(file);
      setError('');
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        // Tracciamo l'aggiunta della foto profilo per mantenere attivo il funnel
        trackFunnel('photo_added');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerShake = () => {
    setShakeFields(true);
    setTimeout(() => setShakeFields(false), 600);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const missingFields: string[] = [];
    if (!username.trim()) missingFields.push('Username');
    if (!gender) missingFields.push('Ruolo');
    if (!schoolName) missingFields.push('Scuola'); 

    if (missingFields.length > 0) {
      setError(`Campi mancanti: ${missingFields.join(', ')}`);
      triggerShake();
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Verifica sessione...');

    try {
      // 1. RECUPERA SESSIONE UTENTE (Con strategia di recupero per mobile)
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // SE FALLISCE O NON C'È USER: Paracadute temporale
      if (sessionError || !session?.user) {
        console.log("Sessione non pronta al primo tentativo, riprovo...");
        await new Promise(resolve => setTimeout(resolve, 800)); 
        const retry = await supabase.auth.getSession();
        session = retry.data.session; 
        
        if (!session?.user) {
          throw new Error('Devi aver effettuato l\'accesso per salvare il profilo.');
        }
      }

      const userId = session.user.id;
      let avatarUrl: string | null = null;

      // 2. CARICAMENTO AVATAR (Se selezionato)
      if (selectedFile) {
        setLoadingMessage('Caricamento avatar...');
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, selectedFile, { cacheControl: '3600', upsert: true });

        if (uploadError) throw new Error(`Errore caricamento avatar: ${uploadError.message}`);
        
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
        avatarUrl = urlData.publicUrl;
      }

      // 3. SALVATAGGIO PROFILO (UPSERT)
      setLoadingMessage('Salvataggio profilo...');
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          avatar_url: avatarUrl,
          username: username.trim().toLowerCase(),
          gender: gender,
          school_name: schoolName, 
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) {
        console.error("Dettaglio errore database:", profileError);
        throw new Error(`Errore database: ${profileError.message}`);
      }

      // --- TRACCIAMENTO COMPLETAMENTO PROFILO ---
      // Invia l'evento SOLO quando l'utente ha effettivamente completato tutto il funnel
      await trackFunnel('school_selected');
      // ------------------------------------------

      setLoadingMessage('✅ Successo! Preparazione set...');
      setTimeout(() => router.push('/profilo'), 1000);
      
    } catch (err: any) {
      console.error("Errore salvataggio:", err);
      setError(err.message || 'Errore imprevisto durante il salvataggio');
      setIsLoading(false);
    }
  };

  return (
    <main className="h-[100dvh] bg-black relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-black pointer-events-none">
        <div 
          className="absolute inset-0 opacity-80"
          style={{
            background: 'radial-gradient(circle at center, rgba(17, 24, 39, 0.8) 0%, rgba(0, 0, 0, 0.95) 50%, rgba(0, 0, 0, 1) 100%)'
          }}
        ></div>
      </div>

      <div className="relative z-20 w-full h-1 bg-black/50">
        <div 
          className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 transition-all duration-500"
          style={{ width: '80%' }}
        ></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col px-6 py-6 overflow-y-auto">
        <div className="text-center mb-8 mt-4">
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
            Il tuo Profilo
          </h1>
          <p className="text-sm text-gray-400">
            Come ti conoscerà la tua scuola?
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="flex flex-col items-center justify-center max-w-[400px] mx-auto w-full space-y-8 flex-1">
          
          <div className="w-full flex justify-center mb-4">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="relative w-28 h-28 rounded-full bg-white/5 border-2 border-yellow-400/30 hover:border-yellow-400/60 transition-all duration-300 flex items-center justify-center group overflow-hidden shadow-[0_0_20px_rgba(251,191,36,0.15)]"
            >
              {avatarPreview ? (
                <img 
                  src={avatarPreview} 
                  alt="Avatar preview" 
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center">
                  <Camera className="w-8 h-8 text-yellow-400/70 group-hover:text-yellow-400 transition-colors duration-300 mb-1" />
                  <span className="text-[10px] font-medium text-yellow-400/70 group-hover:text-yellow-400 transition-colors duration-300 uppercase tracking-wider">
                    Foto
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="w-full space-y-4">
            <div className="w-full">
              <label htmlFor="username" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 text-center flex items-center justify-center gap-1.5">
                <User className="w-4 h-4 text-yellow-400" />
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className={`w-full px-5 py-4 bg-white/5 border rounded-2xl text-white placeholder-gray-600 text-center text-lg focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 transition-all duration-300 ${
                  shakeFields && !username.trim() 
                    ? 'border-red-500/50 animate-shake' 
                    : 'border-white/10 hover:border-white/20'
                }`}
                placeholder="Scegli il tuo @username"
                disabled={isLoading}
                maxLength={30}
              />
            </div>

            <div className="w-full">
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 text-center">
                Sei un attore o un'attrice?
              </label>
              <div 
                ref={genderRef}
                className={`grid grid-cols-2 gap-3 ${
                  shakeFields && !gender ? 'animate-shake' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setGender('attore')}
                  className={`px-4 py-4 rounded-2xl border-2 transition-all duration-300 font-extrabold text-sm tracking-wide ${
                    gender === 'attore'
                      ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-[1.02]'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-yellow-400/30 hover:text-yellow-400/70 hover:bg-white/10'
                  }`}
                  disabled={isLoading}
                >
                  ATTORE
                </button>
                <button
                  type="button"
                  onClick={() => setGender('attrice')}
                  className={`px-4 py-4 rounded-2xl border-2 transition-all duration-300 font-extrabold text-sm tracking-wide ${
                    gender === 'attrice'
                      ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-[1.02]'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:border-yellow-400/30 hover:text-yellow-400/70 hover:bg-white/10'
                  }`}
                  disabled={isLoading}
                >
                  ATTRICE
                </button>
              </div>
            </div>

            <div className="w-full">
              <label htmlFor="school" className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 text-center flex items-center justify-center gap-1.5">
                <School className="w-4 h-4 text-yellow-400" />
                La tua scuola
              </label>
              <select
                id="school"
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  if (!hasTrackedSchool) {
                    trackFunnel('school_selected');
                    setHasTrackedSchool(true);
                  }
                }}
                disabled={isLoading}
                className={`w-full px-5 py-4 bg-zinc-900 border rounded-2xl text-white text-lg font-medium focus:outline-none focus:border-yellow-400/50 focus:ring-2 focus:ring-yellow-400/20 transition-all duration-300 appearance-none text-center ${
                  shakeFields && !schoolName 
                    ? 'border-red-500/60 animate-shake text-red-400' 
                    : 'border-white/10 hover:border-white/20'
                }`}
                style={{ textAlignLast: 'center' }}
              >
                <option value="" disabled className="bg-black text-gray-500">Tocca per selezionare</option>
                <option value="Polo" className="bg-zinc-900 text-white py-2">Polo</option>
                <option value="Fermi" className="bg-zinc-900 text-white py-2">Fermi</option>
                <option value="Montale" className="bg-zinc-900 text-white py-2">Montale</option>
              </select>
            </div>
          </div>

          <div className="w-full mt-auto pt-6 flex-shrink-0 pb-4">
            {error && (
              <div className="w-full mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-xl animate-fadeIn">
                <p className="text-xs text-red-400 text-center font-bold">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative px-6 py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-black text-base tracking-wide rounded-2xl transition-all duration-300 hover:scale-[1.03] shadow-[0_0_30px_rgba(251,191,36,0.4)] hover:shadow-[0_0_45px_rgba(251,191,36,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{loadingMessage || 'Salvataggio...'}</span>
                </span>
              ) : (
                <span>SALVA E CONTINUA</span>
              )}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 3;
        }
      `}</style>
    </main>
  );
}
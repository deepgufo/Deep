'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, User, Film, ShieldAlert, School } from 'lucide-react';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { validateFaceImage } from '@/utils/faceValidation';

type Gender = 'attore' | 'attrice' | '';

export default function CompletamentoProfiloPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iaFaceInputRef = useRef<HTMLInputElement>(null);
  const nomeArteRef = useRef<HTMLInputElement>(null);
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
  const [iaFacePreview, setIaFacePreview] = useState<string | null>(null);
  const [selectedIaFaceFile, setSelectedIaFaceFile] = useState<File | null>(null);
  const [nomeArte, setNomeArte] = useState('');
  const [username, setUsername] = useState('');
  const [gender, setGender] = useState<Gender>('');
  const [schoolName, setSchoolName] = useState(''); // NUOVO STATO SCUOLA
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [shakeFields, setShakeFields] = useState(false);

  // Stati per il feedback della validazione facciale
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [isFallbackActive, setIsFallbackActive] = useState(false);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleIaFaceClick = () => {
    iaFaceInputRef.current?.click();
  };

  const calculateBrightness = (imageFile: File): Promise<{ brightness: number, img: HTMLImageElement, canvas: HTMLCanvasElement }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context non disponibile'));
            return;
          }
          
          const scale = Math.min(400 / img.width, 400 / img.height);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          let totalBrightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
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
      };
      reader.readAsDataURL(file);
    }
  };

  const handleIaFaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      try {
        setIsLoading(true);
        setLoadingMessage('Analisi biometrica...');
        setIsFaceDetected(false);
        setIsFallbackActive(false);

        const { brightness, img, canvas } = await calculateBrightness(file);
        
        if (brightness < 45) {
          setError('⚠️ Foto troppo scura! Spostati in un punto più illuminato.');
          setIaFacePreview(null);
          setSelectedIaFaceFile(null);
          setIsLoading(false);
          return; 
        }

        const validationPromise = validateFaceImage(img, canvas);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT')), 5000)
        );

        try {
          const validation = await Promise.race([validationPromise, timeoutPromise]) as { valid: boolean; error?: string };
          
          if (!validation.valid) {
            setError(`⚠️ ${validation.error}`);
            setIaFacePreview(null);
            setSelectedIaFaceFile(null);
            setIsLoading(false);
            return;
          }
          setIsFaceDetected(true);
        } catch (err: any) {
          if (err.message === 'TIMEOUT') {
            setIsFallbackActive(true);
            setIsFaceDetected(true);
          } else {
            throw err;
          }
        }
        
        setSelectedIaFaceFile(file);
        setError('');
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setIaFacePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
        setIsLoading(false);

        // --- TRACCIAMENTO FOTO IA INSERITA CON SUCCESSO ---
        trackFunnel('photo_added');
        // ---------------------------------------------------
        
      } catch (err) {
        console.error('Errore validazione:', err);
        setError('Errore durante l\'analisi. Riprova.');
        setIsLoading(false);
      }
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
    if (!nomeArte.trim()) missingFields.push('Nome d\'arte');
    if (!username.trim()) missingFields.push('Username');
    if (!gender) missingFields.push('Ruolo');
    if (!schoolName) missingFields.push('Scuola'); // VALIDAZIONE SCUOLA
    
    if (!selectedIaFaceFile) {
      setError('⚠️ È obbligatorio scattare la foto per l\'Identità Digitale IA per procedere.');
      triggerShake();
      return; 
    }

    if (missingFields.length > 0) {
      setError(`Campi mancanti: ${missingFields.join(', ')}`);
      triggerShake();
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Verifica sessione...');

    try {
      // 1. RECUPERA SESSIONE UTENTE (Con strategia di recupero per mobile)
      // Usiamo 'let' perché potremmo dover aggiornare la sessione
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // SE FALLISCE O NON C'È USER: Paracadute temporale
      if (sessionError || !session?.user) {
        console.log("Sessione non pronta al primo tentativo, riprovo...");
        await new Promise(resolve => setTimeout(resolve, 800)); // Aspetta 0.8 secondi
        const retry = await supabase.auth.getSession();
        session = retry.data.session; // Aggiorna la sessione con il nuovo tentativo
        
        if (!session?.user) {
          throw new Error('Devi aver effettuato l\'accesso per salvare il profilo.');
        }
      }

      const userId = session.user.id;
      let avatarUrl: string | null = null;
      let iaFaceUrl: string | null = null;

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

      // 3. CARICAMENTO FOTO IA (Obbligatoria)
      setLoadingMessage('Sincronizzazione Identità IA...');
      const iaExt = selectedIaFaceFile.name.split('.').pop();
      const iaFileName = `${userId}/ia-face-${Date.now()}.${iaExt}`;
      
      const { error: iaUploadError } = await supabase.storage
        .from('ia-faces')
        .upload(iaFileName, selectedIaFaceFile, { cacheControl: '3600', upsert: true });

      if (iaUploadError) throw new Error(`Errore caricamento foto IA: ${iaUploadError.message}`);
      
      const { data: iaUrlData } = supabase.storage.from('ia-faces').getPublicUrl(iaFileName);
      iaFaceUrl = iaUrlData.publicUrl;

      // 4. SALVATAGGIO PROFILO (UPSERT)
      setLoadingMessage('Salvataggio profilo...');
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId, // L'ID DEVE essere quello dell'utente loggato
          full_name: nomeArte.trim(),
          avatar_url: avatarUrl,
          ia_face_url: iaFaceUrl,
          username: username.trim().toLowerCase(),
          bio: bio.trim() || null,
          gender: gender,
          school_name: schoolName, // SALVATAGGIO SCUOLA
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (profileError) {
        console.error("Dettaglio errore database:", profileError);
        throw new Error(`Errore database: ${profileError.message}`);
      }

      // --- TRACCIAMENTO COMPLETAMENTO PROFILO ---
      // Non serve una funzione dedicata qui, perché questo evento è già tracciato dal fatto 
      // che l'utente ora appare in `profiles` (che confrontiamo nella dashboard funnel).
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
    <main className="h-[100dvh] bg-black relative overflow-hidden">
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

      <div className="relative z-10 h-[calc(100dvh-4px)] flex flex-col px-4 py-2">
        <div className="text-center mb-1.5">
          <h1 className="text-lg font-bold text-white mb-0.5 tracking-tight">
            Crea la tua identità da Star
          </h1>
          <p className="text-[10px] text-gray-300">
            L&apos;IA ha bisogno di un tuo primo piano
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="flex-1 flex flex-col items-center justify-between max-w-[400px] mx-auto w-full overflow-y-auto">
          <div className="w-full space-y-1.5">
            <div className="w-full flex justify-center mb-1.5">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="relative w-16 h-16 rounded-full bg-white/5 border-2 border-yellow-400/30 hover:border-yellow-400/50 transition-all duration-300 flex items-center justify-center group overflow-hidden"
              >
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt="Avatar preview" 
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center">
                    <Camera className="w-5 h-5 text-yellow-400/70 group-hover:text-yellow-400 transition-colors duration-300" />
                    <span className="text-[8px] text-yellow-400/70 mt-0.5 group-hover:text-yellow-400 transition-colors duration-300">
                      Profilo
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
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

            <div className="w-full">
              <label htmlFor="nome-arte" className="block text-[11px] font-medium text-gray-300 mb-0.5 text-center flex items-center justify-center gap-1">
                <User className="w-3 h-3 text-yellow-400" />
                Nome d&apos;arte
              </label>
              <input
                ref={nomeArteRef}
                id="nome-arte"
                type="text"
                value={nomeArte}
                onChange={(e) => setNomeArte(e.target.value)}
                className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white placeholder-gray-500 text-center text-[16px] focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/20 transition-all duration-300 ${
                  shakeFields && !nomeArte.trim() 
                    ? 'border-red-500/50 animate-shake' 
                    : 'border-white/10'
                }`}
                placeholder="Nome da star"
                disabled={isLoading}
                maxLength={50}
              />
            </div>

            <div className="w-full">
              <label htmlFor="username" className="block text-[11px] font-medium text-gray-300 mb-0.5 text-center flex items-center justify-center gap-1">
                <User className="w-3 h-3 text-yellow-400" />
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white placeholder-gray-500 text-center text-[16px] focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/20 transition-all duration-300 ${
                  shakeFields && !username.trim() 
                    ? 'border-red-500/50 animate-shake' 
                    : 'border-white/10'
                }`}
                placeholder="nomeutente123"
                disabled={isLoading}
                maxLength={30}
              />
            </div>

            <div className="w-full">
              <label className="block text-[11px] font-medium text-gray-300 mb-0.5 text-center">
                Ruolo 🎬
              </label>
              <div 
                ref={genderRef}
                className={`grid grid-cols-2 gap-1.5 ${
                  shakeFields && !gender ? 'animate-shake' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setGender('attore')}
                  className={`px-3 py-1.5 rounded-lg border-2 transition-all duration-300 font-semibold text-xs ${
                    gender === 'attore'
                      ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:border-yellow-400/30 hover:text-yellow-400/70'
                  }`}
                  disabled={isLoading}
                >
                  ATTORE
                </button>
                <button
                  type="button"
                  onClick={() => setGender('attrice')}
                  className={`px-3 py-1.5 rounded-lg border-2 transition-all duration-300 font-semibold text-xs ${
                    gender === 'attrice'
                      ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:border-yellow-400/30 hover:text-yellow-400/70'
                  }`}
                  disabled={isLoading}
                >
                  ATTRICE
                </button>
              </div>
            </div>

            <div className="w-full">
              <label htmlFor="bio" className="block text-[11px] font-medium text-gray-300 mb-0.5 text-center">
                Bio (opzionale)
              </label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-center text-[13px] focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/20 transition-all duration-300 resize-none"
                placeholder="Descrizione breve..."
                rows={2}
                disabled={isLoading}
                maxLength={200}
              />
            </div>

            <div className="w-full pt-2 border-t border-white/10">
              <label className="block text-[11px] font-medium text-gray-300 mb-1 text-center font-bold">
                Identità Digitale 🎬
              </label>
              <div className="w-full flex flex-col items-center">
                <div className="relative mb-1">
                  <div className={`absolute -inset-2 border-2 rounded-xl pointer-events-none transition-all duration-500 ${
                    isFaceDetected 
                      ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' 
                      : 'border-purple-400/30'
                  } ${shakeFields && !selectedIaFaceFile ? 'animate-shake border-red-500' : ''}`} />
                  
                  <button
                    type="button"
                    onClick={handleIaFaceClick}
                    className="relative w-16 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center group overflow-hidden"
                  >
                    {iaFacePreview ? (
                      <img 
                        src={iaFacePreview} 
                        alt="IA Face preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <Film className="w-6 h-6 text-purple-400/50 group-hover:text-purple-400 transition-colors" />
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

                <div className="flex flex-col items-center gap-0.5">
                  <span className={`text-[9px] font-bold tracking-wider ${isFaceDetected ? 'text-green-400 animate-pulse' : 'text-gray-500'}`}>
                    {isFaceDetected ? 'VISO RILEVATO' : 'ATTESA FOTO IA'}
                  </span>
                  {isFallbackActive && (
                    <span className="text-[7px] text-orange-400 flex items-center gap-1">
                      <ShieldAlert size={8} /> Validazione semplificata attiva
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* SEZIONE SCUOLA - AGGIUNTA SOTTO IDENTITA DIGITALE */}
            <div className="w-full pt-2 border-t border-white/10">
              <label htmlFor="school" className="block text-[11px] font-medium text-gray-300 mb-1 text-center flex items-center justify-center gap-1">
                <School className="w-3 h-3 text-yellow-400" />
                Di che scuola sei? 🏫
              </label>
              <select
                id="school"
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  // --- TRACCIAMENTO SCUOLA SELEZIONATA ---
                  trackFunnel('school_selected');
                  // ---------------------------------------
                }}
                disabled={isLoading}
                className={`w-full px-3 py-2 bg-black/60 border rounded-lg text-white text-[15px] focus:outline-none focus:border-yellow-400/50 transition-all duration-300 appearance-none text-center ${
                  shakeFields && !schoolName 
                    ? 'border-red-500/60 animate-shake text-red-400' 
                    : 'border-white/10'
                }`}
                style={{ textAlignLast: 'center' }}
              >
                <option value="" disabled className="bg-black text-gray-500">Seleziona la tua scuola</option>
                <option value="Polo" className="bg-zinc-900 text-white">Polo</option>
                <option value="Fermi" className="bg-zinc-900 text-white">Fermi</option>
                <option value="Montale" className="bg-zinc-900 text-white">Montale</option>
              </select>
            </div>
          </div>

          <div className="w-full mt-2 flex-shrink-0">
            {error && (
              <div className="w-full mb-1.5 p-2 bg-red-500/10 border border-red-500/50 rounded-lg animate-fadeIn">
                <p className="text-[10px] text-red-400 text-center font-medium">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold text-sm rounded-lg transition-all duration-300 hover:scale-105 shadow-[0_0_25px_rgba(251,191,36,0.5)] hover:shadow-[0_0_35px_rgba(251,191,36,0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-xs">{loadingMessage || 'Salvataggio...'}</span>
                </span>
              ) : (
                <span>SALVA PROFILO</span>
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
import { createBrowserClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// ============================================
// 🔥 CONFIGURAZIONE SUPABASE da .env.local
// ============================================

console.log('');
console.log('================================================');
console.log('🔥 INIZIALIZZAZIONE SUPABASE');
console.log('================================================');

// Leggi variabili da process.env (caricate ora da .env.local)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// DEBUG: Mostra cosa viene caricato
console.log('📋 VERIFICA CARICAMENTO:');
console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ PRESENTE' : '❌ MANCANTE');
console.log('');

// DEBUG: Mostra dettagli
if (supabaseUrl) {
  console.log('🔗 URL:', supabaseUrl);
  console.log('🔗 URL lunghezza:', supabaseUrl.length, 'caratteri');
}

if (supabaseAnonKey) {
  console.log('🔑 ANON KEY lunghezza:', supabaseAnonKey.length, 'caratteri');
  console.log('🔑 ANON KEY inizio:', supabaseAnonKey.substring(0, 30) + '...');
} else {
  console.error('❌ ANON KEY è undefined o vuota!');
  console.error('❌ Verifica il file .env.local > NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

if (supabaseServiceKey && supabaseServiceKey !== "LA_TUA_CHIAVE_SERVICE_ROLE_QUI") {
  console.log('🔐 SERVICE ROLE KEY lunghezza:', supabaseServiceKey.length, 'caratteri');
  console.log('🔐 SERVICE ROLE KEY configurata correttamente');
} else {
  console.warn('⚠️ SERVICE ROLE KEY non configurata (placeholder o lato client)');
}

console.log('');
console.log('================================================');

// ============================================
// ✅ DICHIARAZIONE VARIABILI DA ESPORTARE
// ============================================

let supabase: any;
let supabaseAdmin: any;

// ============================================
// ✅ VALIDAZIONE E CREAZIONE CLIENT
// ============================================

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('');
  console.error('❌❌❌ ERRORE CRITICO ❌❌❌');
  console.error('');
  console.error('Le chiavi Supabase NON sono state caricate da process.env!');
  console.error('');
  console.error('Possibili cause:');
  console.error('1. Il file .env.local non esiste o non è stato salvato');
  console.error('2. Il terminale NON è stato chiuso e riaperto dopo aver creato .env.local');
  console.error('3. La cache .next potrebbe essere corrotta');
  console.error('');
  console.error('Soluzione:');
  console.error('1. Chiudi COMPLETAMENTE il terminale (non solo Ctrl+C)');
  console.error('2. Elimina cartella .next: Remove-Item -Recurse -Force .next');
  console.error('3. Riavvia: npm run dev');
  console.error('');
  console.error('❌❌❌❌❌❌❌❌❌❌❌');
  console.error('');
  
  // IMPORTANTE: Esporta client mock per evitare crash
  const mockClient = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: { message: 'Supabase non configurato - chiavi mancanti' } }),
      signUp: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }),
      signOut: async () => ({ error: { message: 'Supabase non configurato - chiavi mancanti' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({
      select: () => ({ 
        eq: () => ({ 
          single: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }),
          limit: async () => ({ data: [], error: { message: 'Supabase non configurato - chiavi mancanti' } })
        }),
      }),
      insert: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }),
      upsert: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }),
      update: () => ({ eq: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }) }),
      delete: () => ({ eq: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }) })
    }),
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: { message: 'Supabase non configurato - chiavi mancanti' } }),
        getPublicUrl: () => ({ data: { publicUrl: '' } })
      })
    }
  } as any;
  
  console.error('⚠️ Esportando client MOCK (non funzionante) per evitare crash');
  console.error('⚠️ Risolvi il problema delle chiavi per far funzionare l\'app!');
  
  supabase = mockClient;
  supabaseAdmin = mockClient;
  
} else {
  // ============================================
  // ✅ CREAZIONE CLIENT REALI
  // ============================================
  
  console.log('✅ Chiavi presenti! Inizializzo client Supabase...');
  console.log('');
  
  try {
    // CLIENT BROWSER (per il frontend)
    supabase = createBrowserClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            if (typeof document === 'undefined') return undefined;
            const value = document.cookie
              .split('; ')
              .find((row) => row.startsWith(`${name}=`))
              ?.split('=')[1];
            return value;
          },
          set(name: string, value: string, options: any) {
            if (typeof document === 'undefined') return;
            let cookie = `${name}=${value}`;
            if (options?.maxAge) cookie += `; max-age=${options.maxAge}`;
            if (options?.path) cookie += `; path=${options.path}`;
            if (options?.sameSite) cookie += `; samesite=${options.sameSite}`;
            document.cookie = cookie;
          },
          remove(name: string, options: any) {
            if (typeof document === 'undefined') return;
            document.cookie = `${name}=; path=${options?.path || '/'}; max-age=0`;
          }
        }
      }
    );
    
    console.log('✅ Client BROWSER creato con successo');
    
    // CLIENT ADMIN (per operazioni lato server che bypassano RLS)
    supabaseAdmin = supabaseServiceKey && supabaseServiceKey !== "LA_TUA_CHIAVE_SERVICE_ROLE_QUI"
      ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        })
      : null;
    
    if (supabaseAdmin) {
      console.log('✅ Client ADMIN creato (bypassa RLS)');
    } else {
      console.warn('⚠️ Client ADMIN non disponibile (Service Role Key mancante o siamo lato client)');
      console.warn('⚠️ Salvataggio profilo potrebbe fallire per RLS se richiede privilegi elevati');
    }
    
    console.log('');
    console.log('================================================');
    console.log('✅✅✅ SUPABASE INIZIALIZZATO CON SUCCESSO ✅✅✅');
    console.log('================================================');
    console.log('');
    
    // 🧪 TEST IMMEDIATO: Verifica che il client funzioni
    if (typeof window !== 'undefined') {
      supabase.auth.getSession()
        .then(({ data, error }: any) => {
          if (error) {
            console.error('');
            console.error('❌ TEST SESSIONE FALLITO!');
            console.error('❌ Errore:', error.message);
            console.error('❌ Questo significa che la ANON KEY è SBAGLIATA');
            console.error('❌ Verifica il file .env.local');
            console.error('');
          } else {
            console.log('✅ TEST CONNESSIONE: OK');
            if (data.session) {
              console.log('✅ Sessione attiva:');
              console.log('   User ID:', data.session.user.id);
              console.log('   Email:', data.session.user.email);
            } else {
              console.log('ℹ️ Nessuna sessione attiva (normale se non loggato)');
            }
            console.log('');
          }
        })
        .catch((err: any) => {
          console.error('❌ ERRORE DURANTE TEST:', err);
        });
    }
    
  } catch (error: any) {
    console.error('');
    console.error('❌ ERRORE durante creazione client Supabase!');
    console.error('❌ Errore:', error?.message || error);
    console.error('');
    throw error;
  }
}

// ============================================
// ✅ ESPORTAZIONE CLIENT
// ============================================

export { supabase, supabaseAdmin };
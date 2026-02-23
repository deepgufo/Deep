'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, User as UserIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface UserSearchResult {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
}

export default function CercaPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // --- CARICA ID UTENTE LOGGATO ---
  useEffect(() => {
    const loadCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUserId(session.user.id);
        console.log('✅ Utente loggato:', session.user.id);
      }
    };
    
    loadCurrentUser();
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      // --- LOGICA FILTRO CARATTERI ---
      // Se la query è meno di 3 caratteri, svuotiamo i risultati e non interpelliamo il DB
      if (searchQuery.trim().length < 3) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);

      try {
        // Query base
        let query = supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .or(`username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`);

        // --- FILTRO SELF-PROFILE: Escludi l'utente loggato ---
        if (currentUserId) {
          query = query.neq('id', currentUserId);
        }

        const { data, error } = await query.limit(20);

        if (error) {
          console.error('❌ Errore ricerca:', error);
          return;
        }

        setSearchResults(data || []);
        console.log(`✅ Trovati ${data?.length || 0} profili (escludendo self)`);
      } catch (err) {
        console.error('❌ Errore:', err);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentUserId]);

  // --- NAVIGAZIONE VERSO IL PROFILO ALTRUI ---
  const handleUserClick = (userId: string) => {
    // Ora puntiamo alla nuova cartella dinamica /users/[id]
    router.push(`/users/${userId}`);
  };

  return (
    <main className="fixed inset-0 bg-black overflow-hidden" style={{ height: '100dvh' }}>
      <div className="scrollable-content h-full overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto bg-black min-h-full">
          
          <div className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-4">
            <h1 className="text-white font-bold text-xl mb-4 uppercase tracking-tighter italic">Cerca Talenti</h1>
            
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digita almeno 3 lettere..."
                className="w-full bg-zinc-900 text-white pl-12 pr-4 py-3 rounded-xl border border-zinc-800 focus:border-yellow-400 focus:outline-none transition-all placeholder:text-zinc-600 text-sm"
                autoFocus
              />
            </div>
          </div>

          <div className="px-4 py-2">
            {isSearching && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
              </div>
            )}

            {/* Messaggio se la query è troppo corta */}
            {!isSearching && searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600">
                <p className="text-xs font-bold uppercase tracking-widest">Continua a scrivere...</p>
              </div>
            )}

            {!isSearching && searchQuery.trim().length >= 3 && searchResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <Search className="w-16 h-16 text-zinc-800 mb-4" />
                <p className="text-zinc-500 text-center text-sm italic">
                  Nessun profilo trovato per &quot;{searchQuery}&quot;
                </p>
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-2 py-2">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserClick(user.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-zinc-900/30 border border-zinc-900 hover:border-yellow-400/50 hover:bg-zinc-900 transition-all text-left group"
                  >
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-zinc-800 flex-shrink-0 group-hover:border-yellow-400 transition-colors">
                      {user.avatar_url ? (
                        <Image src={user.avatar_url} alt={user.full_name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                          <UserIcon className="w-7 h-7 text-zinc-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-base truncate uppercase tracking-tighter">
                        {user.full_name}
                      </p>
                      <p className="text-yellow-400/60 text-xs font-mono truncate">
                        @{user.username}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.trim() === '' && (
              <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <Search className="w-20 h-20 text-white mb-4" />
                <p className="text-white text-xs font-black uppercase tracking-[0.3em]">
                  Inizia la ricerca
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
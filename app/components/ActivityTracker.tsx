'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * COMPONENTE ACTIVITY TRACKER
 * Si occupa di aggiornare l'ultimo avvistamento dell'utente nel database.
 * Non renderizza nulla (ritorna null).
 */
export function ActivityTracker() {
  useEffect(() => {
    const updateActivity = async () => {
      // Recuperiamo la sessione corrente
      const { data: { session } } = await supabase.auth.getSession();
      
      // Se l'utente è loggato, aggiorniamo il suo timestamp
      if (session?.user) {
        await supabase
          .from('profiles')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', session.user.id);
      }
    };

    // Eseguiamo il primo aggiornamento al caricamento della pagina
    updateActivity();

    // Impostiamo un intervallo per aggiornare ogni 120 secondi (2 minuti)
    // finché l'utente tiene l'app aperta.
    const interval = setInterval(updateActivity, 120000); 

    // Pulizia dell'intervallo quando il componente viene smontato
    return () => clearInterval(interval);
  }, []);

  return null;
}
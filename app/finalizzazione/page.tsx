// app/finalizzazione/page.tsx
import FinalizzazioneClient from './FinalizzazioneClient';

export default async function FinalizzazionePage(props: { 
  searchParams: Promise<{ 
    videoUrl?: string; 
    prompt?: string; 
    trauma?: string; 
    iaFaceUrl?: string; 
    category?: string 
  }> 
}) {
  // 1. Attesa corretta dei parametri (Next.js 15)
  const searchParams = await props.searchParams;

  // 2. Estrazione URL (Lo teniamo così com'è, lo puliremo nel client o lo usiamo diretto)
  const videoUrl = searchParams.videoUrl || "";
  const category = searchParams.category || "dramma";
  
  // 3. Gestione Testo: Pulizia profonda dei caratteri "+" tipici degli URL
  const rawPrompt = searchParams.prompt || searchParams.trauma || "Il mio Film";
  const displayPrompt = decodeURIComponent(rawPrompt).replace(/\+/g, ' ');

  // 4. LOGICA AGGIORNATA: Rimozione del blocco Server-Side
  // Non blocchiamo più l'esecuzione qui con il return del div "Parametri mancanti".
  // Permettiamo a FinalizzazioneClient di montarsi; se videoUrl è vuoto nell'URL,
  // il componente Client cercherà di recuperare la sessione o l'ID dal localStorage.
  // Questo evita la schermata nera fissa quando l'URL viene "pulito" dal browser o dai redirect.

  return (
    <FinalizzazioneClient 
      videoUrl={videoUrl} 
      initialPrompt={displayPrompt}
      category={category}
    />
  );
}
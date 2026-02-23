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

  // 4. Controllo di sicurezza Server-Side
  if (!videoUrl) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white p-10 text-center">
        <div className="flex flex-col gap-4">
          <p className="text-xl font-bold">🎬 Parametri mancanti</p>
          <p className="text-gray-400">Non abbiamo trovato il video da elaborare.</p>
          <a href="/crea" className="mt-4 px-6 py-3 bg-yellow-400 text-black font-bold rounded-xl">
            Torna alla creazione
          </a>
        </div>
      </div>
    );
  }

  return (
    <FinalizzazioneClient 
      videoUrl={videoUrl} 
      initialPrompt={displayPrompt}
      category={category}
    />
  );
}
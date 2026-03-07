'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TerminiPrivacyPage() {
  return (
    <main className="min-h-screen h-full overflow-y-auto bg-white text-black py-12 px-6 sm:px-12 lg:px-24 font-sans selection:bg-yellow-200 relative z-[999]">
      {/* CSS per forzare lo scroll e nascondere la NavTab */}
      <style jsx global>{`
        html, body {
          overflow: auto !important;
          height: auto !important;
          position: relative !important;
        }
        /* Nasconde la barra di navigazione inferiore in questa pagina */
        nav, .bottom-nav, footer, [class*="BottomNav"] {
          display: none !important;
        }
      `}</style>

      <div className="max-w-3xl mx-auto">
        
        {/* Pulsante per tornare indietro (opzionale ma consigliato per la UX) */}
        <Link 
          href="/auth" 
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black mb-10 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Torna alla registrazione
        </Link>

        <h1 className="text-3xl font-bold mb-10 border-b pb-4 border-gray-100">
          Termini di Servizio e Privacy Policy (DeepFly)
        </h1>

        <div className="space-y-8 text-sm leading-relaxed text-gray-800">
          
          <section>
            <h2 className="text-xl font-bold text-black mb-4">1. Consenso al Trattamento dei Dati Biometrici</h2>
            <p className="mb-4">
              Utilizzando DeepFly, accetti che la nostra Intelligenza Artificiale analizzi i tratti del tuo volto caricato per generare il video.
            </p>
            <ul className="list-none space-y-2">
              <li><strong>Finalità:</strong> I dati vengono utilizzati esclusivamente per la creazione del contenuto richiesto.</li>
              <li><strong>Conservazione:</strong> Le immagini sorgente (la tua foto) vengono eliminate dai nostri server immediatamente dopo la generazione del video o entro un massimo di 24 ore. Non creiamo database di volti.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black mb-4">2. Responsabilità dell'Utente e Contenuti Vietati</h2>
            <p className="mb-4">
              Tu sei l'unico responsabile delle immagini che carichi. È severamente vietato:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Caricare foto di terzi senza il loro esplicito consenso.</li>
              <li>Utilizzare l'app per scopi di bullismo, molestie, diffamazione o denigrazione di compagni, professori o qualsiasi altra persona.</li>
              <li>Generare contenuti pedopornografici, violenti, politici o d'odio.</li>
            </ul>
            <p className="mt-4 italic">
              DeepFly si riserva il diritto di bannare l'utente e collaborare con le autorità competenti in caso di violazioni.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black mb-4">3. Età Minima</h2>
            <p>
              L'uso di DeepFly è consentito solo a utenti che abbiano compiuto 14 anni (età del consenso digitale in Italia). Se sei più giovane, dichiari di avere il consenso dei tuoi genitori o tutori legali.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black mb-4">4. Proprietà Intellettuale e Uso dei Personaggi</h2>
            <p>
              I personaggi cinematografici messi a disposizione sono utilizzati a scopo di parodia, satira e sperimentazione tecnologica. DeepFly non rivendica diritti sulle immagini degli attori originali. L'utente accetta che i video generati possano essere visualizzati nel feed interno della propria scuola.
            </p>
          </section>

          <section className="pb-20">
            <h2 className="text-xl font-bold text-black mb-4">5. Limitazione di Responsabilità</h2>
            <p>
              DeepFly è un servizio fornito "così com'è" in fase di sviluppo (Beta). Non garantiamo la perfezione del risultato tecnico e non siamo responsabili per eventuali danni derivanti dall'uso improprio dell'applicazione o dalla perdita accidentale di dati.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { supabaseAdmin } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

// Forza Vercel a non cachare le risposte di questa API
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    // 1. Leggiamo i dati dal body (incluso userId per fallback sicurezza)
    const body = await req.json();
    const { videoUrl, faceUrl, userId: bodyUserId } = body;

    console.log("--- API FACE-SWAP: CONTROLLO LIMITI E AVVIO ---");

    // Validazione input
    if (!videoUrl || !faceUrl) {
      return NextResponse.json({
        error: "Parametri mancanti",
        detail: `Video: ${!!videoUrl}, Face: ${!!faceUrl}`
      }, { status: 400 });
    }

    // 2. RECUPERO USER ID (Token Header con Fallback su Body)
    let userId = null;
   
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
   
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) userId = user.id;
    }

    // Se il token fallisce, usiamo l'ID passato dal body (paracadute di sicurezza)
    if (!userId && bodyUserId) {
        userId = bodyUserId;
    }

    if (!userId) {
        return NextResponse.json({ error: "Utente non autorizzato" }, { status: 401 });
    }


    // --- PUNTO 1: IL MURO (KILL-SWITCH) ---
    const { data: config } = await supabaseAdmin
      .from('system_config')
      .select('maintenance_mode')
      .eq('id', 1)
      .single();

    if (config?.maintenance_mode) {
      return NextResponse.json({
        error: "Sistema in manutenzione",
        detail: "La produzione video è stata temporaneamente sospesa dall'amministratore."
      }, { status: 503 });
    }
    // --------------------------------------

    // 3. RECUPERO PROFILO E CONTROLLO CONTEGGIO GIORNALIERO
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('daily_video_count, last_video_date')
      .eq('id', userId)
      .single();

    if (dbError) {
      return NextResponse.json({
        error: "Profilo non trovato",
        detail: "Impossibile recuperare i dati utente."
      }, { status: 404 });
    }

    // Verifica limite (3 video)
    const today = new Date().toISOString().split('T')[0];
    let currentCount = profile.daily_video_count || 0;

    if (profile.last_video_date !== today) {
      currentCount = 0;
    }

    if (currentCount >= 3) {
      return NextResponse.json({
        error: "Limite giornaliero raggiunto",
        detail: "Hai già creato i tuoi 3 video quotidiani. Torna domani!"
      }, { status: 429 });
    }

    // 4. ESECUZIONE PREDICTION REPLICATE
    // RIPRISTINO MODELLO STABILE: xrunda/hello
    // Attenzione: questo modello usa 'source' per il video e 'target' per la faccia.
    const prediction = await replicate.predictions.create({
      version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440",
      input: {
        source: videoUrl,  // Il video del personaggio (video Source)
        target: faceUrl    // La faccia dell'utente (face image)
      }
    });

    console.log("--- PREDICTION CREATA CON xrunda/hello --- ID:", prediction.id);

    // 5. AGGIORNAMENTO CONTEGGIO NEL DATABASE
    await supabaseAdmin
      .from('profiles')
      .update({
        daily_video_count: currentCount + 1,
        last_video_date: today
      })
      .eq('id', userId);

    return NextResponse.json({ id: prediction.id });

  } catch (error: any) {
    console.error("BACKEND ERROR:", error);
   
    // --- LOG ERRORE NELLA SCATOLA NERA ---
    try {
      await supabaseAdmin.from('debug_logs').insert([{
        device_info: "API_Server",
        error_message: `Replicate API Error (POST): ${error.message || "Errore sconosciuto"}`,
        context: "API_POST_FaceSwap_Crash"
      }]);
    } catch (logErr) {
      console.error("Errore log sicurezza:", logErr);
    }

    return NextResponse.json({
      error: "Errore backend",
      detail: error.message
    }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams = new URL(req.url).searchParams } = new URL(req.url);
  const id = searchParams.get("id");
 
  if (!id) return NextResponse.json({ error: "ID mancante" }, { status: 400 });

  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
 
  try {
    const prediction = await replicate.predictions.get(id);
    console.log(`Polling ID ${id.slice(-5)}: ${prediction.status}`);
    
    // Ritorna la predizione con header anti-cache per evitare il blocco al 98%
    return new NextResponse(JSON.stringify(prediction), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error: any) {
   
    try {
      await supabaseAdmin.from('debug_logs').insert([{
        device_info: "API_Server",
        error_message: `Replicate Polling Error (GET): ${error.message || "Errore sconosciuto"}`,
        context: "API_GET_Polling_Crash"
      }]);
    } catch (logErr) {
      console.error("Errore log sicurezza:", logErr);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import Replicate from "replicate";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });

    const body = await req.json();
    const { videoUrl, userId } = body;

    console.log("--- API FACE-SWAP: CONTROLLO LIMITI E AVVIO ---");

    if (!videoUrl || !userId) {
      return NextResponse.json({ 
        error: "Parametri mancanti", 
        detail: `Video: ${!!videoUrl}, User: ${!!userId}` 
      }, { status: 400 });
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

    // 1. CONTROLLO FASCIA ORARIA (08:00 - 23:00) ORA ITALIANA
    const stringTime = new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" });
    const localTime = new Date(stringTime);
    const currentHour = localTime.getHours();

    if (currentHour < 8 || currentHour >= 23) {
      return NextResponse.json({ 
        error: "Servizio non attivo", 
        detail: "La produzione è attiva solo dalle 08:00 alle 23:00 (Ora Italiana)." 
      }, { status: 403 });
    }

    // 2. RECUPERO PROFILO E CONTROLLO CONTEGGIO GIORNALIERO
    const { data: profile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .select('ia_face_url, daily_video_count, last_video_date')
      .eq('id', userId)
      .single();

    if (dbError || !profile?.ia_face_url) {
      return NextResponse.json({ 
        error: "Profilo non trovato", 
        detail: "Assicurati di aver caricato la foto nel profilo." 
      }, { status: 404 });
    }

    // Verifica limite dei 2 video
    // (Il trigger SQL gestisce il reset a 0 se la data è cambiata, ma qui facciamo un controllo extra)
    const today = new Date().toISOString().split('T')[0];
    let currentCount = profile.daily_video_count || 0;

    if (profile.last_video_date !== today) {
      currentCount = 0; // Se la data nel DB è vecchia, resettiamo virtualmente per questa richiesta
    }

    if (currentCount >= 2) {
      return NextResponse.json({ 
        error: "Limite giornaliero raggiunto", 
        detail: "Hai già creato i tuoi 2 video quotidiani. Torna domani dalle 08:00!" 
      }, { status: 429 });
    }

    // 3. ESECUZIONE PREDICTION REPLICATE
    const prediction = await replicate.predictions.create({
      version: "104b4a39315349db50880757bc8c1c996c5309e3aa11286b0a3c84dab81fd440",
      input: {
        source: videoUrl,           // Video
        target: profile.ia_face_url // Faccia
      }
    });

    console.log("--- PREDICTION CREATA --- ID:", prediction.id);

    // 4. AGGIORNAMENTO CONTEGGIO NEL DATABASE
    await supabaseAdmin
      .from('profiles')
      .update({ 
        daily_video_count: currentCount + 1,
        last_video_date: today 
      })
      .eq('id', userId);

    return NextResponse.json({ predictionId: prediction.id });

  } catch (error: any) {
    console.error("BACKEND ERROR:", error);
    
    // --- LOG ERRORE NELLA SCATOLA NERA (PUNTO 1 SICUREZZA) ---
    try {
      await supabaseAdmin.from('debug_logs').insert([{
        device_info: "API_Server",
        error_message: `Replicate API Error (POST): ${error.message || "Errore sconosciuto"}`,
        context: "API_POST_FaceSwap_Crash"
      }]);
    } catch (logErr) {
      console.error("Errore durante il salvataggio del log di sicurezza:", logErr);
    }
    // ---------------------------------------------------------

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
    return NextResponse.json(prediction);
  } catch (error: any) {
    
    // --- LOG ERRORE NELLA SCATOLA NERA (PUNTO 1 SICUREZZA) ---
    try {
      await supabaseAdmin.from('debug_logs').insert([{
        device_info: "API_Server",
        error_message: `Replicate Polling Error (GET): ${error.message || "Errore sconosciuto"}`,
        context: "API_GET_Polling_Crash"
      }]);
    } catch (logErr) {
      console.error("Errore durante il salvataggio del log di sicurezza:", logErr);
    }
    // ---------------------------------------------------------

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
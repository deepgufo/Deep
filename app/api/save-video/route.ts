import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { videoUrl, status, category, prompt } = await req.json();

    // 1. Inizializza Supabase con Service Role per i permessi di scrittura
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Recupera l'utente dalla sessione (Sicurezza)
    // Passiamo l'header di autorizzazione per essere sicuri di chi sta scrivendo
    const authHeader = req.headers.get('Authorization');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader?.replace('Bearer ', '') || '');

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    // 3. Scarica il video da Replicate (Server-to-Server, velocissimo)
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error("Impossibile scaricare il video dai server IA");
    
    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Definisci percorso e bucket
    const bucketName = status === 'pubblico' ? 'video_pubblici' : 'video_privati';
    const fileName = `${user.id}/${Date.now()}.mp4`;

    // 5. Upload su Storage
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: 'video/mp4',
        upsert: false
      });

    if (storageError) throw storageError;

    // 6. Ottieni URL pubblico
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    // 7. Inserimento nel Database
    if (status === 'pubblico') {
      await supabaseAdmin.from('public_videos').insert([{
        user_id: user.id,
        video_url: publicUrl,
        caption: prompt,
        oscar_count: 0
      }]);
    } else {
      await supabaseAdmin.from('films').insert([{
        user_id: user.id,
        video_url: publicUrl,
        prompt: prompt,
        category: category,
        status: 'privato'
      }]);
    }

    return NextResponse.json({ success: true, url: publicUrl });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
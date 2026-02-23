import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, isCoupleMode } = await request.json();
    
    // 1. Verifica immediata della Chiave API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ ERRORE: GEMINI_API_KEY mancante nel file .env.local");
      return NextResponse.json({ category: 'commedia' }); // Fallback di sicurezza
    }

    if (!text) return NextResponse.json({ category: 'commedia' });
    if (isCoupleMode) return NextResponse.json({ category: 'coppia' });

    const lowerText = text.toLowerCase();

    // --- LOGICA DI FERRO (Ignora l'IA se queste parole sono presenti) ---
    const actionKeywords = ['rincorre', 'scappa', 'polizia', 'carabinieri', 'rubato', 'moto', 'macchina', 'velocità', 'fuga', 'inseguimento'];
    const dramaKeywords = ['ghostato', 'lasciato', 'pianto', 'triste', 'solo', 'addio', 'cuore', 'tradito', 'soffro'];

    if (actionKeywords.some(word => lowerText.includes(word))) {
      console.log("⚡ FORCE: Action rilevata");
      return NextResponse.json({ category: 'action' });
    }
    
    if (dramaKeywords.some(word => lowerText.includes(word))) {
      console.log("😢 FORCE: Dramma rilevato");
      return NextResponse.json({ category: 'dramma' });
    }

    // --- SE NON CI SONO PAROLE CHIAVE, CHIEDIAMO A GEMINI ---
    // Inizializziamo l'IA dentro la funzione per essere sicuri che legga la variabile d'ambiente corretta
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { temperature: 0 } // Forza l'IA a non essere creativa
    });
    
    const prompt = `Classifica questo testo in una sola parola tra: "action", "commedia", "dramma".
    
    REGOLE RIGIDE:
    - Se c'è ghosting, amore finito o tristezza -> dramma
    - Se c'è pericolo, guardie o fughe -> action
    - Se è una figura di merda o scuola -> commedia
    
    Testo: "${text}"`;

    const result = await model.generateContent(prompt);
    let category = result.response.text().toLowerCase().trim().replace(/[^a-z]/g, "");

    const validCategories = ['action', 'commedia', 'dramma'];
    const finalCategory = validCategories.includes(category) ? category : 'commedia';

    console.log(`🤖 AI Decision: ${finalCategory}`);
    return NextResponse.json({ category: finalCategory });

  } catch (error: any) {
    console.error("❌ GEMINI API ERROR:", error.message);
    return NextResponse.json({ category: 'commedia' });
  }
}
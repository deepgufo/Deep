// utils/faceValidation.ts

export interface FaceValidationResult {
  valid: boolean;
  error?: string;
}

export const validateFaceImage = async (
  img: HTMLImageElement, 
  canvas: HTMLCanvasElement
): Promise<FaceValidationResult> => {
  try {
    // Controllo risoluzione
    if (img.width < 150 || img.height < 150) {
      return {
        valid: false,
        error: "Risoluzione troppo bassa. Scatta una foto più nitida.",
      };
    }

    // Qui c'è il problema della "faccia nel muro":
    // Al momento restituiamo sempre 'true' perché MediaPipe non è ancora attivo.
    // Lo attiviamo nel prossimo step se l'import rientra.
    return { valid: true }; 
    
  } catch (err) {
    console.error("Errore validazione:", err);
    return {
      valid: false,
      error: "Errore durante l'analisi.",
    };
  }
};
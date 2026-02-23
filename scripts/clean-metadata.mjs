import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Cartella dove il tuo sito tiene le immagini statiche
const PUBLIC_DIR = './public';

// Estensioni supportate
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

async function cleanImages(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    if (file.isDirectory()) {
      await cleanImages(fullPath); // Scansione ricorsiva (cartelle dentro cartelle)
      continue;
    }

    if (EXTENSIONS.includes(path.extname(file.name).toLowerCase())) {
      try {
        const buffer = await fs.readFile(fullPath);
        
        // Sharp carica l'immagine e la salva di nuovo. 
        // Di default, Sharp NON mantiene i metadati EXIF/IPTC/XMP.
        await sharp(buffer)
          .toFile(fullPath + '.tmp'); // Crea un file temporaneo

        // Sostituisce il file originale con quello pulito
        await fs.rename(fullPath + '.tmp', fullPath);
        
        console.log(`✅ Pulito: ${fullPath}`);
      } catch (err) {
        console.error(`❌ Errore su ${file.name}:`, err.message);
      }
    }
  }
}

console.log('🧹 Inizio pulizia metadati immagini...');
cleanImages(PUBLIC_DIR).then(() => console.log('✨ Tutte le immagini sono ora anonime.'));
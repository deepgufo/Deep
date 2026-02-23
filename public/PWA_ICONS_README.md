# 📱 Icone PWA per Cinema Scuola

## Icone Richieste

Per completare la configurazione PWA, devi creare e aggiungere queste icone nella cartella `/public`:

### 1. **icon-192x192.png** (192x192 pixels)
- Icona principale per Android
- Utilizzata anche come favicon
- Background: Nero (#000000)
- Design: Logo Cinema Scuola con trofeo dorato

### 2. **icon-512x512.png** (512x512 pixels)
- Icona ad alta risoluzione per Android
- Stesse caratteristiche della 192x192
- Background: Nero (#000000)

## Come Creare le Icone

### Opzione 1: Online Generator
Usa un generatore PWA online come:
- https://www.pwabuilder.com/imageGenerator
- https://favicon.io/favicon-generator/

### Opzione 2: Design Manuale
1. Crea un'immagine quadrata con:
   - Sfondo nero (#000000)
   - Icona trofeo dorato (#D4AF37)
   - Testo "Cinema Scuola" (opzionale)
   - Padding di almeno 10% sui bordi

2. Esporta in PNG con le dimensioni richieste

### Opzione 3: Usando Canva
1. Vai su Canva.com
2. Crea design personalizzato 512x512px
3. Sfondo nero
4. Aggiungi emoji trofeo 🏆 o simbolo cinema 🎬
5. Scarica come PNG
6. Ridimensiona a 192x192 per la versione piccola

## Colori del Brand
- **Nero**: #000000 (sfondo)
- **Oro**: #D4AF37 (accento principale)
- **Bianco Ghiaccio**: #F8F8F8 (testo)

## Posizionamento
Salva i file in:
```
/public/icon-192x192.png
/public/icon-512x512.png
```

## Test PWA
Dopo aver aggiunto le icone:
1. Deploy su hosting (Vercel/Netlify)
2. Apri su mobile
3. Su iOS: "Aggiungi a Home" da Safari
4. Su Android: Banner "Installa app" apparirà automaticamente

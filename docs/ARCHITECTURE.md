# Architettura RuralStay Collection

## Livelli
- `public/client`: esperienza utente pubblica
- `public/admin`: pannello gestionale per operatori
- `src/server.js`: API REST e routing statico
- `src/db.js`: schema SQLite, seed demo, regole di disponibilità e pricing
- `src/auth.js`: hashing password e token sessione

## Modello dati
### properties
Descrive la struttura: dati editoriali, hero image, rating, amenities, stato attivo.

### rooms
Camere collegate a una struttura: capacità, prezzo base, servizi, immagine.

### daily_inventory
Grana giornaliera per camera. Qui vivono:
- prezzo giorno
- disponibilità
- min nights
- nota operativa

### bookings
Prenotazione finale con cliente, stato, totale, token pubblico e dati soggiorno.

## Regole chiave
- niente overbooking: prima di creare una prenotazione viene verificato che tutte le date siano libere
- prezzi dinamici: il totale viene calcolato sui prezzi giornalieri reali
- multi tenant semplificato: ogni struttura è indipendente ma condivisa nello stesso pannello admin
- admin centralizzato: tutte le modifiche disponibilità/prezzi impattano subito sul frontend pubblico

## Seed demo
Tre agriturismi demo con camere, servizi e pricing stagionale/weekend già configurati.

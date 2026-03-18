# RuralStay Collection

Web app full-stack per gestione prenotazioni agriturismo multi-struttura con frontend pubblico stile Booking/Airbnb e pannello admin centralizzato.

## Stack scelto
- Frontend: HTML modulare, CSS custom, JavaScript vanilla moderno
- Backend: Node.js + Express
- Database: SQLite con `better-sqlite3`

### Perché questo stack
- rapido da avviare in locale
- semplice da distribuire su Render/Fly/VPS
- logica leggibile e facilmente estendibile verso React/Next in una fase successiva
- database file-based perfetto per demo avanzata e prototipazione

## Funzionalità incluse
### Frontend utente
- homepage con hero e search bar stile booking
- ricerca disponibilità multi-struttura
- filtri per prezzo medio e servizi
- scheda struttura con galleria e camere
- calendario mensile per camera con prezzi giornalieri e disponibilità
- checkout con totale dinamico e numero notti
- blocco overbooking lato backend

### Admin
- login admin
- dashboard con statistiche
- lista prenotazioni
- CRUD base strutture
- CRUD base camere
- calendar manager per ogni camera
- modifica disponibilità, prezzo giornaliero, min nights e nota
- cambio password

## Credenziali demo admin
- username: `admin`
- password: `agri123`

## Avvio locale
```bash
npm install
npm start
```

Server disponibile su:
- frontend: `http://localhost:3300`
- admin: `http://localhost:3300/admin`
- health: `http://localhost:3300/healthz`

## Struttura progetto
```text
agriturismo-booking-platform/
├── public/
│   ├── client/
│   └── admin/
├── src/
│   ├── auth.js
│   ├── db.js
│   └── server.js
├── docs/
└── README.md
```

## API principali
### Pubbliche
- `GET /api/config`
- `GET /api/search`
- `GET /api/properties`
- `GET /api/properties/:slug`
- `GET /api/rooms/:id/calendar?month=YYYY-MM`
- `POST /api/bookings`

### Admin
- `POST /api/admin/login`
- `POST /api/admin/logout`
- `POST /api/admin/change-password`
- `GET /api/admin/dashboard`
- `GET /api/admin/bookings`
- `GET /api/admin/properties`
- `POST /api/admin/properties`
- `POST /api/admin/rooms`
- `GET /api/admin/rooms/:id/calendar?month=YYYY-MM`
- `PATCH /api/admin/inventory/:roomId/:day`
- `POST /api/admin/bookings/manual`

## Deploy su Render
Il progetto è pronto per un deploy completo frontend + backend su Render tramite il file [`render.yaml`](/Users/buscattidocet/Documents/Playground/agriturismo-booking-platform/render.yaml).

Configurazione prevista:
- servizio web Node
- health check su `/healthz`
- disco persistente Render montato su `/var/data`
- database SQLite in produzione su:
  - `/var/data/agriturismo.sqlite`

Passi:
1. pubblica il repo su GitHub
2. in Render crea un nuovo `Blueprint`
3. seleziona il repo
4. Render leggerà automaticamente `render.yaml`

## Evoluzioni naturali
- pagamenti Stripe con caparra
- upload immagini reale
- account cliente e wishlist
- recensioni verificabili
- multilingua
- SEO server-side / Next.js

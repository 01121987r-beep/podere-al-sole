import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateToken, hashPassword } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDbPath = path.join(__dirname, '..', 'agriturismo.sqlite');
const dbPath = process.env.DB_PATH || defaultDbPath;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      region TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Italia',
      hero_image TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 4.7,
      review_count INTEGER NOT NULL DEFAULT 0,
      amenities_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS property_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      base_price REAL NOT NULL,
      image_url TEXT NOT NULL,
      amenities_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      day TEXT NOT NULL,
      price REAL NOT NULL,
      available INTEGER NOT NULL DEFAULT 1,
      min_nights INTEGER NOT NULL DEFAULT 1,
      note TEXT NOT NULL DEFAULT '',
      UNIQUE(room_id, day),
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_token TEXT UNIQUE NOT NULL,
      property_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      guest_count INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'confirmed',
      total_price REAL NOT NULL,
      nights INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    );
  `);

  seedAdmin();
  seedProperties();
  seedPropertyImages();
  seedRooms();
  seedRoomImages();
  seedDailyInventory();
  seedBookings();
}

function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get().count;
  if (count > 0) return;
  db.prepare('INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)')
    .run('admin', hashPassword('agri123'), 'Host Manager');
}

function seedProperties() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM properties').get().count;
  if (count > 0) return;
  const stmt = db.prepare(`
    INSERT INTO properties (name, slug, tagline, description, address, city, region, country, hero_image, rating, review_count, amenities_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const rows = [
    [
      'Podere al Sole',
      'podere-al-sole',
      'Vigne, tramonti e camere dal sapore toscano',
      'Un agriturismo tra filari e colline, con camere curate, colazioni fatte in casa e un ritmo lento che ricorda le estati in campagna.',
      'Strada del Vino 18',
      'San Gimignano',
      'Toscana',
      'Italia',
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1600&q=80',
      4.8,
      148,
      JSON.stringify(['Piscina panoramica', 'Colazione inclusa', 'Parcheggio gratuito', 'Wi-Fi'])
    ],
    [
      'Casale delle Colline',
      'casale-delle-colline',
      'Relax tra ulivi, cucina locale e vista aperta',
      'Casale ristrutturato con camere spaziose, piccola spa naturale e ristorante agricolo con prodotti dell’azienda.',
      'Via delle Ginestre 4',
      'Montalcino',
      'Toscana',
      'Italia',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1600&q=80',
      4.7,
      96,
      JSON.stringify(['Ristorante', 'Spa privata', 'Degustazioni', 'Pet friendly'])
    ],
    [
      'Masseria del Tramonto',
      'masseria-del-tramonto',
      'Pietra chiara, ulivi e quiete mediterranea',
      'Masseria pugliese con suite luminose, corte interna e piscina salina. Ideale per coppie e soggiorni lenti di più notti.',
      'Contrada Serra 9',
      'Ostuni',
      'Puglia',
      'Italia',
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1600&q=80',
      4.9,
      204,
      JSON.stringify(['Piscina salina', 'Transfer aeroporto', 'Colazione gourmet', 'Wi-Fi'])
    ]
  ];
  db.transaction(() => rows.forEach((row) => stmt.run(...row)))();
}

function seedPropertyImages() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM property_images').get().count;
  if (count > 0) return;
  const properties = db.prepare('SELECT id, slug, hero_image FROM properties').all();
  const stmt = db.prepare('INSERT INTO property_images (property_id, image_url, sort_order) VALUES (?, ?, ?)');
  const gallery = {
    'podere-al-sole': [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80'
    ],
    'casale-delle-colline': [
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80'
    ],
    'masseria-del-tramonto': [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1400&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80'
    ]
  };
  db.transaction(() => {
    for (const property of properties) {
      stmt.run(property.id, property.hero_image, 0);
      (gallery[property.slug] || []).forEach((imageUrl, index) => stmt.run(property.id, imageUrl, index + 1));
    }
  })();
}

function seedRooms() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM rooms').get().count;
  if (count > 0) return;
  const propertyIds = Object.fromEntries(db.prepare('SELECT id, slug FROM properties').all().map((row) => [row.slug, row.id]));
  const stmt = db.prepare(`
    INSERT INTO rooms (property_id, name, description, capacity, base_price, image_url, amenities_json, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const rows = [
    [propertyIds['podere-al-sole'], 'Camera Vigna', 'Matrimoniale con vista filari e bagno in pietra.', 2, 138, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['Aria condizionata', 'Vista vigneto', 'Mini bar'])],
    [propertyIds['podere-al-sole'], 'Suite Tramonto', 'Junior suite con patio privato e area living.', 4, 198, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['Patio privato', 'Divano letto', 'Welcome kit'])],
    [propertyIds['casale-delle-colline'], 'Camera Ulivo', 'Doppia superior con vista uliveto e toni caldi.', 2, 126, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['Vista ulivi', 'Colazione inclusa', 'Doccia walk-in'])],
    [propertyIds['casale-delle-colline'], 'Family Casale', 'Spazio ideale per famiglie con due ambienti.', 5, 214, 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['Due ambienti', 'Culla su richiesta', 'Tavolo pranzo'])],
    [propertyIds['masseria-del-tramonto'], 'Suite Corte Bianca', 'Suite luminosa con vasca freestanding.', 2, 186, 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['Vasca in camera', 'Corte privata', 'Kit spa'])],
    [propertyIds['masseria-del-tramonto'], 'Camera Pietra Viva', 'Doppia deluxe in pietra chiara e tessuti naturali.', 3, 152, 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80', JSON.stringify(['Terrazza', 'Coffee station', 'Doccia extra large'])]
  ];
  db.transaction(() => rows.forEach((row) => stmt.run(...row)))();
}

function seedDailyInventory() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM daily_inventory').get().count;
  if (count > 0) return;
  const rooms = db.prepare('SELECT id, base_price FROM rooms').all();
  const stmt = db.prepare(`
    INSERT INTO daily_inventory (room_id, day, price, available, min_nights, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const today = new Date();
  db.transaction(() => {
    for (const room of rooms) {
      for (let offset = 0; offset < 240; offset += 1) {
        const date = new Date(today);
        date.setDate(today.getDate() + offset);
        const iso = date.toISOString().slice(0, 10);
        const month = date.getMonth();
        const weekday = date.getDay();
        const isWeekend = weekday === 5 || weekday === 6;
        const isHighSeason = month >= 5 && month <= 8;
        const price = Number((room.base_price + (isHighSeason ? 28 : 0) + (isWeekend ? 18 : 0)).toFixed(2));
        const available = !(offset % 19 === 0 || offset % 23 === 0);
        const minNights = isHighSeason && isWeekend ? 2 : 1;
        stmt.run(room.id, iso, price, available ? 1 : 0, minNights, available ? '' : 'Blocco automatico demo');
      }
    }
  })();
}

function computeInventoryDefaults(basePrice, date) {
  const month = date.getMonth();
  const weekday = date.getDay();
  const isWeekend = weekday === 5 || weekday === 6;
  const isHighSeason = month >= 5 && month <= 8;
  return {
    price: Number((basePrice + (isHighSeason ? 28 : 0) + (isWeekend ? 18 : 0)).toFixed(2)),
    available: true,
    minNights: isHighSeason && isWeekend ? 2 : 1,
    note: ''
  };
}

function ensureInventoryRange(roomId, startDate, endDate) {
  const room = db.prepare('SELECT id, base_price FROM rooms WHERE id = ?').get(roomId);
  if (!room) return;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO daily_inventory (room_id, day, price, available, min_nights, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const end = new Date(endDate);
  const cursor = new Date(startDate);
  db.transaction(() => {
    while (cursor <= end) {
      const defaults = computeInventoryDefaults(room.base_price, cursor);
      insert.run(roomId, toISO(cursor), defaults.price, defaults.available ? 1 : 0, defaults.minNights, defaults.note);
      cursor.setDate(cursor.getDate() + 1);
    }
  })();
}

function seedRoomImages() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM room_images').get().count;
  if (count > 0) return;
  const rooms = db.prepare('SELECT id, name, image_url FROM rooms').all();
  const stmt = db.prepare('INSERT INTO room_images (room_id, image_url, sort_order) VALUES (?, ?, ?)');
  const gallery = {
    'Camera Vigna': [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1200&q=80'
    ],
    'Suite Tramonto': [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
    ],
    'Camera Ulivo': [
      'https://images.unsplash.com/photo-1505693536294-2334547f7e51?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80'
    ],
    'Family Casale': [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1500&q=80',
      'https://images.unsplash.com/photo-1505693314120-0d443867891c?auto=format&fit=crop&w=1200&q=80'
    ],
    'Suite Corte Bianca': [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1350&q=80',
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1300&q=80'
    ],
    'Camera Pietra Viva': [
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1250&q=80',
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'
    ]
  };
  db.transaction(() => {
    for (const room of rooms) {
      const images = gallery[room.name] || [];
      images.forEach((imageUrl, index) => stmt.run(room.id, imageUrl, index));
    }
  })();
}

function seedBookings() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
  if (count > 0) return;
  const room = db.prepare('SELECT id, property_id FROM rooms ORDER BY id LIMIT 1').get();
  if (!room) return;
  const checkIn = addDaysISO(new Date(), 5);
  const checkOut = addDaysISO(new Date(), 8);
  const totalPrice = computeBookingTotal(room.id, checkIn, checkOut);
  db.prepare(`
    INSERT INTO bookings (
      booking_token, property_id, room_id, check_in, check_out, guest_count,
      customer_name, customer_email, customer_phone, customer_notes,
      status, total_price, nights
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)
  `).run(
    generateToken(12),
    room.property_id,
    room.id,
    checkIn,
    checkOut,
    2,
    'Cliente Demo',
    'demo@example.com',
    '+39 333 9988776',
    'Arrivo in tarda serata',
    totalPrice,
    nightsBetween(checkIn, checkOut)
  );
}

export function getShopConfig() {
  return {
    brand_name: 'RuralStay Collection',
    hero_title: 'Scopri agriturismi autentici con disponibilità in tempo reale',
    hero_copy: 'Un unico motore per cercare strutture, camere e prezzi giornalieri con un calendario semplice da usare.',
    support_email: 'booking@ruralstay.it'
  };
}

export function getActiveProperties() {
  const properties = db.prepare('SELECT * FROM properties ORDER BY rating DESC, name ASC').all();
  return properties.map(mapPropertySummary);
}

export function getPropertyById(id) {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
  return property ? mapProperty(property) : null;
}

export function getPropertyBySlug(slug) {
  const property = db.prepare('SELECT * FROM properties WHERE slug = ?').get(slug);
  return property ? mapProperty(property) : null;
}

export function getPropertyImages(propertyId) {
  return db.prepare('SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC').all(propertyId);
}

export function getRoomsForProperty(propertyId) {
  return db.prepare('SELECT * FROM rooms WHERE property_id = ? AND active = 1 ORDER BY base_price ASC, id ASC').all(propertyId).map(mapRoom);
}

export function getRoomById(roomId) {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  return room ? mapRoom(room) : null;
}

export function getRoomImages(roomId) {
  return db.prepare('SELECT * FROM room_images WHERE room_id = ? ORDER BY sort_order ASC, id ASC').all(roomId);
}

export function getCalendarForRoom(roomId, month) {
  const start = new Date(`${month}-01T12:00:00`);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);
  end.setDate(0);
  ensureInventoryRange(roomId, start, end);
  return db.prepare(`
    SELECT day, price, available, min_nights, note
    FROM daily_inventory
    WHERE room_id = ? AND day BETWEEN ? AND ?
    ORDER BY day ASC
  `).all(roomId, toISO(start), toISO(end));
}

export function searchAvailability({ city = '', checkIn = '', checkOut = '', guests = 1, maxPrice = null, amenity = '' }) {
  const properties = getActiveProperties();
  return properties
    .map((property) => buildPropertySearchResult(property, { checkIn, checkOut, guests, maxPrice, amenity }))
    .filter(Boolean)
    .filter((property) => !city || `${property.city} ${property.region}`.toLowerCase().includes(city.toLowerCase()));
}

function buildPropertySearchResult(property, filters) {
  const rooms = getRoomsForProperty(property.id);
  const matchingRooms = rooms
    .map((room) => buildAvailableRoomResult(room, filters.checkIn, filters.checkOut, filters.guests, filters.maxPrice))
    .filter(Boolean);

  if (!matchingRooms.length) return null;
  if (filters.amenity && !property.amenities.some((item) => item.toLowerCase().includes(filters.amenity.toLowerCase()))) {
    return null;
  }

  return {
    ...property,
    available_rooms: matchingRooms,
    min_price: Math.min(...matchingRooms.map((room) => room.average_price))
  };
}

function buildAvailableRoomResult(room, checkIn, checkOut, guests, maxPrice) {
  if (guests && room.capacity < guests) return null;
  if (!checkIn || !checkOut) {
    return {
      ...room,
      nights: 0,
      total_price: room.base_price,
      average_price: room.base_price
    };
  }

  if (!isRoomAvailable(room.id, checkIn, checkOut)) return null;
  const totalPrice = computeBookingTotal(room.id, checkIn, checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  const average = Number((totalPrice / Math.max(nights, 1)).toFixed(2));
  if (maxPrice && average > maxPrice) return null;
  return {
    ...room,
    nights,
    total_price: totalPrice,
    average_price: average
  };
}

export function isRoomAvailable(roomId, checkIn, checkOut, bookingIdToIgnore = null) {
  const nights = enumerateDates(checkIn, checkOut);
  if (!nights.length) return false;
  ensureInventoryRange(roomId, new Date(`${nights[0]}T12:00:00`), new Date(`${nights[nights.length - 1]}T12:00:00`));

  const overrides = db.prepare(`
    SELECT day, available
    FROM daily_inventory
    WHERE room_id = ? AND day BETWEEN ? AND ?
  `).all(roomId, nights[0], nights[nights.length - 1]);
  const overrideMap = new Map(overrides.map((row) => [row.day, row]));
  for (const night of nights) {
    if (!overrideMap.has(night) || !overrideMap.get(night).available) {
      return false;
    }
  }

  const conflicting = db.prepare(`
    SELECT 1
    FROM bookings
    WHERE room_id = ?
      AND status IN ('confirmed', 'pending')
      AND NOT (check_out <= ? OR check_in >= ?)
      ${bookingIdToIgnore ? 'AND id != ?' : ''}
    LIMIT 1
  `).get(...(bookingIdToIgnore ? [roomId, checkIn, checkOut, bookingIdToIgnore] : [roomId, checkIn, checkOut]));

  return !conflicting;
}

export function computeBookingTotal(roomId, checkIn, checkOut) {
  const nights = enumerateDates(checkIn, checkOut);
  if (!nights.length) return 0;
  ensureInventoryRange(roomId, new Date(`${nights[0]}T12:00:00`), new Date(`${nights[nights.length - 1]}T12:00:00`));
  const rows = db.prepare(`
    SELECT day, price
    FROM daily_inventory
    WHERE room_id = ? AND day BETWEEN ? AND ?
    ORDER BY day ASC
  `).all(roomId, nights[0], nights[nights.length - 1]);
  const map = new Map(rows.map((row) => [row.day, row.price]));
  return Number(nights.reduce((sum, day) => sum + Number(map.get(day) || 0), 0).toFixed(2));
}

export function createBooking(payload) {
  const room = getRoomById(payload.room_id);
  const property = getPropertyById(payload.property_id);
  if (!room || !property) throw new Error('Camera o struttura non trovata');
  if (room.property_id !== property.id) throw new Error('Camera non coerente con la struttura');
  if (!isRoomAvailable(room.id, payload.check_in, payload.check_out)) throw new Error('Date non più disponibili');

  const totalPrice = computeBookingTotal(room.id, payload.check_in, payload.check_out);
  const nights = nightsBetween(payload.check_in, payload.check_out);
  const bookingToken = generateToken(12);

  db.prepare(`
    INSERT INTO bookings (
      booking_token, property_id, room_id, check_in, check_out, guest_count,
      customer_name, customer_email, customer_phone, customer_notes,
      status, total_price, nights
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bookingToken,
    property.id,
    room.id,
    payload.check_in,
    payload.check_out,
    payload.guest_count,
    payload.customer_name,
    payload.customer_email,
    payload.customer_phone,
    payload.customer_notes || '',
    payload.status || 'confirmed',
    totalPrice,
    nights
  );

  return getBookingByToken(bookingToken);
}

export function getBookingByToken(token) {
  const row = db.prepare(`
    SELECT bookings.*, rooms.name AS room_name, properties.name AS property_name, properties.city AS property_city
    FROM bookings
    JOIN rooms ON rooms.id = bookings.room_id
    JOIN properties ON properties.id = bookings.property_id
    WHERE bookings.booking_token = ?
  `).get(token);
  return row ? mapBooking(row) : null;
}

export function getAdminDashboardSummary() {
  const bookingsTotal = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
  const revenue = db.prepare("SELECT COALESCE(SUM(total_price), 0) AS total FROM bookings WHERE status = 'confirmed'").get().total;
  const occupancy = db.prepare(`
    SELECT ROUND(100.0 * SUM(CASE WHEN available = 0 THEN 1 ELSE 0 END) / COUNT(*), 1) AS occupancy_rate
    FROM daily_inventory
  `).get().occupancy_rate || 0;
  return {
    bookings_total: bookingsTotal,
    revenue_total: Number(revenue || 0),
    occupancy_rate: Number(occupancy)
  };
}

export function getAdminBookings(status = '') {
  const query = `
    SELECT bookings.*, rooms.name AS room_name, properties.name AS property_name
    FROM bookings
    JOIN rooms ON rooms.id = bookings.room_id
    JOIN properties ON properties.id = bookings.property_id
    ${status ? 'WHERE bookings.status = ?' : ''}
    ORDER BY bookings.check_in ASC, bookings.created_at DESC
  `;
  const rows = status ? db.prepare(query).all(status) : db.prepare(query).all();
  return rows.map(mapBooking);
}

export function getAdminProperties() {
  return getActiveProperties().map((property) => ({
    ...property,
    rooms: db.prepare('SELECT * FROM rooms WHERE property_id = ? ORDER BY base_price ASC, id ASC').all(property.id).map(mapRoom)
  }));
}

export function updateInventoryDay(roomId, day, payload) {
  db.prepare(`
    INSERT INTO daily_inventory (room_id, day, price, available, min_nights, note)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, day) DO UPDATE SET
      price = excluded.price,
      available = excluded.available,
      min_nights = excluded.min_nights,
      note = excluded.note
  `).run(roomId, day, payload.price, payload.available ? 1 : 0, payload.min_nights || 1, payload.note || '');
}

export function createProperty(payload) {
  const slug = slugify(payload.name);
  const result = db.prepare(`
    INSERT INTO properties (name, slug, tagline, description, address, city, region, country, hero_image, rating, review_count, amenities_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.name,
    slug,
    payload.tagline || '',
    payload.description,
    payload.address,
    payload.city,
    payload.region,
    payload.country || 'Italia',
    payload.hero_image,
    Number(payload.rating || 4.7),
    Number(payload.review_count || 0),
    JSON.stringify(payload.amenities || [])
  );
  return getPropertyById(result.lastInsertRowid);
}

export function createRoom(payload) {
  const result = db.prepare(`
    INSERT INTO rooms (property_id, name, description, capacity, base_price, image_url, amenities_json, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    payload.property_id,
    payload.name,
    payload.description,
    payload.capacity,
    payload.base_price,
    payload.image_url,
    JSON.stringify(payload.amenities || []),
    payload.active === false ? 0 : 1
  );
  replaceRoomImages(result.lastInsertRowid, payload.gallery_images || []);
  return getRoomById(result.lastInsertRowid);
}

export function updateRoom(roomId, payload) {
  const room = getRoomById(roomId);
  if (!room) throw new Error('Camera non trovata');
  db.prepare(`
    UPDATE rooms
    SET property_id = ?,
        name = ?,
        description = ?,
        capacity = ?,
        base_price = ?,
        image_url = ?,
        amenities_json = ?,
        active = ?
    WHERE id = ?
  `).run(
    payload.property_id,
    payload.name,
    payload.description,
    payload.capacity,
    payload.base_price,
    payload.image_url,
    JSON.stringify(payload.amenities || []),
    payload.active ? 1 : 0,
    roomId
  );
  replaceRoomImages(roomId, payload.gallery_images || []);
  return getRoomById(roomId);
}

function replaceRoomImages(roomId, images) {
  db.prepare('DELETE FROM room_images WHERE room_id = ?').run(roomId);
  if (!images.length) return;
  const stmt = db.prepare('INSERT INTO room_images (room_id, image_url, sort_order) VALUES (?, ?, ?)');
  images.forEach((imageUrl, index) => stmt.run(roomId, imageUrl, index));
}

export function updateBookingStatus(bookingId, status) {
  const allowed = new Set(['confirmed', 'pending', 'cancelled']);
  if (!allowed.has(status)) throw new Error('Stato prenotazione non valido');
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) throw new Error('Prenotazione non trovata');
  db.prepare(`
    UPDATE bookings
    SET status = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, bookingId);
  return db.prepare(`
    SELECT bookings.*, rooms.name AS room_name, properties.name AS property_name
    FROM bookings
    JOIN rooms ON rooms.id = bookings.room_id
    JOIN properties ON properties.id = bookings.property_id
    WHERE bookings.id = ?
  `).get(bookingId);
}

function mapPropertySummary(row) {
  const rooms = db.prepare('SELECT MIN(base_price) AS min_price FROM rooms WHERE property_id = ? AND active = 1').get(row.id);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    address: row.address,
    city: row.city,
    region: row.region,
    country: row.country,
    hero_image: row.hero_image,
    rating: row.rating,
    review_count: row.review_count,
    amenities: safeJson(row.amenities_json),
    min_price: Number(rooms?.min_price || 0)
  };
}

function mapProperty(row) {
  return {
    ...mapPropertySummary(row),
    images: getPropertyImages(row.id),
    rooms: getRoomsForProperty(row.id)
  };
}

function mapRoom(row) {
  return {
    id: row.id,
    property_id: row.property_id,
    name: row.name,
    description: row.description,
    capacity: row.capacity,
    base_price: Number(row.base_price),
    image_url: row.image_url,
    gallery_images: getRoomImages(row.id).map((item) => item.image_url),
    amenities: safeJson(row.amenities_json),
    active: Boolean(row.active)
  };
}

function mapBooking(row) {
  return {
    ...row,
    total_price: Number(row.total_price),
    status_label: row.status === 'pending' ? 'In attesa' : row.status === 'cancelled' ? 'Cancellata' : 'Confermata'
  };
}

function safeJson(value) {
  try {
    return JSON.parse(value || '[]');
  } catch {
    return [];
  }
}

function slugify(value) {
  return `${value || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `struttura-${generateToken(4)}`;
}

function enumerateDates(checkIn, checkOut) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];
  const dates = [];
  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(toISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function nightsBetween(checkIn, checkOut) {
  return enumerateDates(checkIn, checkOut).length;
}

function addDaysISO(date, offset) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + offset);
  return toISO(copy);
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

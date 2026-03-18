import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  db,
  initializeDatabase,
  getShopConfig,
  searchAvailability,
  getActiveProperties,
  getPropertyBySlug,
  getRoomById,
  getCalendarForRoom,
  createBooking,
  getBookingByToken,
  getAdminDashboardSummary,
  getAdminBookings,
  getAdminProperties,
  updateInventoryDay,
  createProperty,
  createRoom,
  updateRoom,
  updateBookingStatus,
  isRoomAvailable,
  computeBookingTotal,
  nightsBetween
} from './db.js';
import { generateToken, hashPassword, verifyPassword } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');
const app = express();
const PORT = process.env.PORT || 3300;
const HOST = process.env.HOST || '0.0.0.0';

initializeDatabase();

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(publicDir));

function respondError(res, status, message) {
  return res.status(status).json({ error: message });
}

function authTokenFromRequest(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function requireAdmin(req, res, next) {
  const token = authTokenFromRequest(req);
  if (!token) return respondError(res, 401, 'Unauthorized');
  const session = db.prepare(`
    SELECT admin_sessions.*, admin_users.username, admin_users.display_name
    FROM admin_sessions
    JOIN admin_users ON admin_users.id = admin_sessions.admin_id
    WHERE admin_sessions.token = ?
  `).get(token);
  if (!session) return respondError(res, 401, 'Unauthorized');
  if (new Date(session.expires_at) < new Date()) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    return respondError(res, 401, 'Session expired');
  }
  req.admin = session;
  next();
}

function requireFields(res, fields) {
  const missing = fields.filter(([_, value]) => value === undefined || value === null || value === '' || value === false);
  if (!missing.length) return null;
  return respondError(res, 400, `Campi obbligatori mancanti: ${missing.map(([key]) => key).join(', ')}`);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

app.get('/healthz', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (req, res) => {
  res.json({ config: getShopConfig() });
});

app.get('/api/search', (req, res) => {
  const results = searchAvailability({
    city: `${req.query.city || ''}`.trim(),
    checkIn: `${req.query.checkIn || ''}`.trim(),
    checkOut: `${req.query.checkOut || ''}`.trim(),
    guests: toNumber(req.query.guests, 1),
    maxPrice: req.query.maxPrice ? toNumber(req.query.maxPrice, null) : null,
    amenity: `${req.query.amenity || ''}`.trim()
  });
  res.json({ results });
});

app.get('/api/properties', (req, res) => {
  res.json({ properties: getActiveProperties() });
});

app.get('/api/properties/:slug', (req, res) => {
  const property = getPropertyBySlug(req.params.slug);
  if (!property) return respondError(res, 404, 'Struttura non trovata');
  res.json({ property });
});

app.get('/api/properties/:slug/availability', (req, res) => {
  const property = getPropertyBySlug(req.params.slug);
  if (!property) return respondError(res, 404, 'Struttura non trovata');

  const checkIn = `${req.query.checkIn || ''}`.trim();
  const checkOut = `${req.query.checkOut || ''}`.trim();
  const guests = toNumber(req.query.guests, 1);

  const fieldError = requireFields(res, [
    ['checkIn', checkIn],
    ['checkOut', checkOut],
    ['guests', guests]
  ]);
  if (fieldError) return fieldError;

  const matching = property.rooms
    .filter((room) => room.capacity >= guests)
    .filter((room) => isRoomAvailable(room.id, checkIn, checkOut))
    .map((room) => ({
      ...room,
      nights: nightsBetween(checkIn, checkOut),
      total_price: computeBookingTotal(room.id, checkIn, checkOut)
    }))
    .sort((a, b) => a.total_price - b.total_price || a.base_price - b.base_price);

  res.json({ rooms: matching });
});

app.get('/api/properties/:slug/calendar', (req, res) => {
  const property = getPropertyBySlug(req.params.slug);
  if (!property) return respondError(res, 404, 'Struttura non trovata');

  const month = `${req.query.month || ''}`.trim();
  const guests = toNumber(req.query.guests, 1);
  if (!month) return respondError(res, 400, 'month richiesto');

  const eligibleRooms = property.rooms.filter((room) => room.capacity >= guests);
  if (!eligibleRooms.length) return res.json({ calendar: [] });

  const monthMaps = eligibleRooms.map((room) => ({
    room,
    days: new Map(getCalendarForRoom(room.id, month).map((day) => [day.day, day]))
  }));

  const firstCalendar = getCalendarForRoom(eligibleRooms[0].id, month);
  const calendar = firstCalendar.map((baseDay) => {
    const matchingDays = monthMaps
      .map(({ days }) => days.get(baseDay.day))
      .filter(Boolean);
    const availableDays = matchingDays.filter((day) => day.available);
    return {
      day: baseDay.day,
      available: availableDays.length > 0,
      price: availableDays.length ? Math.min(...availableDays.map((day) => Number(day.price || 0))) : baseDay.price
    };
  });

  res.json({ calendar });
});

app.get('/api/rooms/:id/calendar', (req, res) => {
  const roomId = Number(req.params.id);
  const month = `${req.query.month || ''}`.trim();
  if (!roomId || !month) return respondError(res, 400, 'roomId e month richiesti');
  const room = getRoomById(roomId);
  if (!room) return respondError(res, 404, 'Camera non trovata');
  const calendar = getCalendarForRoom(roomId, month);
  res.json({ room, calendar });
});

app.post('/api/bookings', (req, res) => {
  const payload = {
    property_id: Number(req.body.property_id),
    room_id: Number(req.body.room_id),
    check_in: `${req.body.check_in || ''}`.trim(),
    check_out: `${req.body.check_out || ''}`.trim(),
    guest_count: Number(req.body.guest_count || 1),
    customer_name: `${req.body.customer_name || ''}`.trim(),
    customer_email: `${req.body.customer_email || ''}`.trim(),
    customer_phone: `${req.body.customer_phone || ''}`.trim(),
    customer_notes: `${req.body.customer_notes || ''}`.trim(),
    status: 'confirmed'
  };

  const fieldError = requireFields(res, [
    ['property_id', payload.property_id],
    ['room_id', payload.room_id],
    ['check_in', payload.check_in],
    ['check_out', payload.check_out],
    ['customer_name', payload.customer_name],
    ['customer_email', payload.customer_email],
    ['customer_phone', payload.customer_phone]
  ]);
  if (fieldError) return fieldError;
  if (payload.guest_count < 1) return respondError(res, 400, 'Numero ospiti non valido');

  try {
    const booking = createBooking(payload);
    res.status(201).json({ booking });
  } catch (error) {
    res.status(409).json({ error: error.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  const username = `${req.body.username || ''}`.trim();
  const password = `${req.body.password || ''}`;
  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username);
  if (!admin || !verifyPassword(password, admin.password_hash)) {
    return respondError(res, 401, 'Credenziali non valide');
  }

  const token = generateToken(24);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
  db.prepare('INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, ?)').run(token, admin.id, expiresAt);
  res.json({ token, admin: { username: admin.username, display_name: admin.display_name } });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = authTokenFromRequest(req);
  db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const currentPassword = `${req.body.currentPassword || ''}`;
  const newPassword = `${req.body.newPassword || ''}`;
  if (!currentPassword || !newPassword) return respondError(res, 400, 'Compila tutti i campi');
  if (newPassword.length < 6) return respondError(res, 400, 'La nuova password deve avere almeno 6 caratteri');

  const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.admin_id);
  if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
    return respondError(res, 400, 'Password attuale non corretta');
  }

  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), admin.id);
  res.json({ message: 'Password aggiornata con successo' });
});

app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  res.json({
    summary: getAdminDashboardSummary(),
    properties: getAdminProperties(),
    bookings: getAdminBookings()
  });
});

app.get('/api/admin/bookings', requireAdmin, (req, res) => {
  const status = `${req.query.status || ''}`.trim();
  res.json({ bookings: getAdminBookings(status) });
});

app.get('/api/admin/properties', requireAdmin, (req, res) => {
  res.json({ properties: getAdminProperties() });
});

app.post('/api/admin/properties', requireAdmin, (req, res) => {
  const payload = {
    name: `${req.body.name || ''}`.trim(),
    tagline: `${req.body.tagline || ''}`.trim(),
    description: `${req.body.description || ''}`.trim(),
    address: `${req.body.address || ''}`.trim(),
    city: `${req.body.city || ''}`.trim(),
    region: `${req.body.region || ''}`.trim(),
    country: `${req.body.country || 'Italia'}`.trim(),
    hero_image: `${req.body.hero_image || ''}`.trim(),
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities : []
  };
  const fieldError = requireFields(res, [
    ['name', payload.name],
    ['description', payload.description],
    ['address', payload.address],
    ['city', payload.city],
    ['region', payload.region],
    ['hero_image', payload.hero_image]
  ]);
  if (fieldError) return fieldError;
  const property = createProperty(payload);
  res.status(201).json({ property });
});

app.post('/api/admin/rooms', requireAdmin, (req, res) => {
  const payload = {
    property_id: Number(req.body.property_id),
    name: `${req.body.name || ''}`.trim(),
    description: `${req.body.description || ''}`.trim(),
    capacity: Number(req.body.capacity || 0),
    base_price: Number(req.body.base_price || 0),
    image_url: `${req.body.image_url || ''}`.trim(),
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
    gallery_images: Array.isArray(req.body.gallery_images) ? req.body.gallery_images : [],
    active: req.body.active !== false
  };
  const fieldError = requireFields(res, [
    ['property_id', payload.property_id],
    ['name', payload.name],
    ['description', payload.description],
    ['capacity', payload.capacity],
    ['base_price', payload.base_price],
    ['image_url', payload.image_url]
  ]);
  if (fieldError) return fieldError;
  const room = createRoom(payload);
  res.status(201).json({ room });
});

app.patch('/api/admin/rooms/:id', requireAdmin, (req, res) => {
  const roomId = Number(req.params.id);
  const payload = {
    property_id: Number(req.body.property_id),
    name: `${req.body.name || ''}`.trim(),
    description: `${req.body.description || ''}`.trim(),
    capacity: Number(req.body.capacity),
    base_price: Number(req.body.base_price),
    image_url: `${req.body.image_url || ''}`.trim(),
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
    gallery_images: Array.isArray(req.body.gallery_images) ? req.body.gallery_images : [],
    active: Boolean(req.body.active)
  };
  const missing = requireFields(res, [
    ['property_id', payload.property_id],
    ['name', payload.name],
    ['description', payload.description],
    ['capacity', payload.capacity],
    ['base_price', payload.base_price],
    ['image_url', payload.image_url]
  ]);
  if (missing) return missing;
  try {
    const room = updateRoom(roomId, payload);
    res.json({ room });
  } catch (error) {
    respondError(res, 400, error.message);
  }
});

app.post('/api/admin/rooms/:id/update', requireAdmin, (req, res) => {
  const roomId = Number(req.params.id);
  const payload = {
    property_id: Number(req.body.property_id),
    name: `${req.body.name || ''}`.trim(),
    description: `${req.body.description || ''}`.trim(),
    capacity: Number(req.body.capacity),
    base_price: Number(req.body.base_price),
    image_url: `${req.body.image_url || ''}`.trim(),
    amenities: Array.isArray(req.body.amenities) ? req.body.amenities : [],
    gallery_images: Array.isArray(req.body.gallery_images) ? req.body.gallery_images : [],
    active: Boolean(req.body.active)
  };
  const missing = requireFields(res, [
    ['property_id', payload.property_id],
    ['name', payload.name],
    ['description', payload.description],
    ['capacity', payload.capacity],
    ['base_price', payload.base_price],
    ['image_url', payload.image_url]
  ]);
  if (missing) return missing;
  try {
    const room = updateRoom(roomId, payload);
    res.json({ room });
  } catch (error) {
    respondError(res, 400, error.message);
  }
});

app.patch('/api/admin/bookings/:id', requireAdmin, (req, res) => {
  const bookingId = Number(req.params.id);
  const status = `${req.body.status || ''}`.trim();
  if (!bookingId || !status) return respondError(res, 400, 'bookingId e status richiesti');
  try {
    const booking = updateBookingStatus(bookingId, status);
    res.json({ booking });
  } catch (error) {
    respondError(res, 400, error.message);
  }
});

app.post('/api/admin/bookings/:id/update', requireAdmin, (req, res) => {
  const bookingId = Number(req.params.id);
  const status = `${req.body.status || ''}`.trim();
  if (!bookingId || !status) return respondError(res, 400, 'bookingId e status richiesti');
  try {
    const booking = updateBookingStatus(bookingId, status);
    res.json({ booking });
  } catch (error) {
    respondError(res, 400, error.message);
  }
});

app.patch('/api/admin/inventory/:roomId/:day', requireAdmin, (req, res) => {
  const roomId = Number(req.params.roomId);
  const day = `${req.params.day || ''}`.trim();
  if (!roomId || !day) return respondError(res, 400, 'roomId e day richiesti');
  const room = getRoomById(roomId);
  if (!room) return respondError(res, 404, 'Camera non trovata');
  updateInventoryDay(roomId, day, {
    price: Number(req.body.price || room.base_price),
    available: req.body.available !== false,
    min_nights: Number(req.body.min_nights || 1),
    note: `${req.body.note || ''}`.trim()
  });
  res.json({ ok: true });
});

app.get('/api/admin/rooms/:id/calendar', requireAdmin, (req, res) => {
  const roomId = Number(req.params.id);
  const month = `${req.query.month || ''}`.trim();
  if (!roomId || !month) return respondError(res, 400, 'roomId e month richiesti');
  const room = getRoomById(roomId);
  if (!room) return respondError(res, 404, 'Camera non trovata');
  res.json({ room, calendar: getCalendarForRoom(roomId, month) });
});

app.post('/api/admin/bookings/manual', requireAdmin, (req, res) => {
  const payload = {
    property_id: Number(req.body.property_id),
    room_id: Number(req.body.room_id),
    check_in: `${req.body.check_in || ''}`.trim(),
    check_out: `${req.body.check_out || ''}`.trim(),
    guest_count: Number(req.body.guest_count || 1),
    customer_name: `${req.body.customer_name || ''}`.trim(),
    customer_email: `${req.body.customer_email || ''}`.trim(),
    customer_phone: `${req.body.customer_phone || ''}`.trim(),
    customer_notes: `${req.body.customer_notes || ''}`.trim(),
    status: `${req.body.status || 'confirmed'}`.trim()
  };

  const fieldError = requireFields(res, [
    ['property_id', payload.property_id],
    ['room_id', payload.room_id],
    ['check_in', payload.check_in],
    ['check_out', payload.check_out],
    ['customer_name', payload.customer_name],
    ['customer_email', payload.customer_email],
    ['customer_phone', payload.customer_phone]
  ]);
  if (fieldError) return fieldError;

  try {
    const booking = createBooking(payload);
    res.status(201).json({ booking });
  } catch (error) {
    res.status(409).json({ error: error.message });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (req.path === '/admin') return next();
  return res.sendFile(path.join(publicDir, 'client', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Agriturismo platform running on http://${HOST}:${PORT}`);
});

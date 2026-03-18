const state = {
  token: localStorage.getItem('ruralstay-admin-token') || '',
  admin: JSON.parse(localStorage.getItem('ruralstay-admin-profile') || 'null'),
  properties: [],
  allBookings: [],
  bookings: [],
  summary: null,
  selectedRoomId: null,
  calendarPickerYear: new Date().getFullYear(),
  bookingPeriodYear: new Date().getFullYear(),
  bookingPeriodSelection: null
};

const ACTIVE_PROPERTY_SLUG = 'podere-al-sole';

const refs = {
  loginView: document.querySelector('#login-view'),
  appView: document.querySelector('#app-view'),
  loginForm: document.querySelector('#login-form'),
  loginStatus: document.querySelector('#login-status'),
  summaryGrid: document.querySelector('#summary-grid'),
  roomForm: document.querySelector('#room-form'),
  roomFormStatus: document.querySelector('#room-form-status'),
  roomGalleryPreview: document.querySelector('#room-gallery-preview'),
  roomDialog: document.querySelector('#room-dialog'),
  closeRoomModal: document.querySelector('#close-room-modal'),
  roomEditForm: document.querySelector('#room-edit-form'),
  roomEditStatus: document.querySelector('#room-edit-status'),
  roomEditGalleryPreview: document.querySelector('#room-edit-gallery-preview'),
  bookingsTableBody: document.querySelector('#bookings-table-body'),
  bookingStatusFilter: document.querySelector('#booking-status-filter'),
  bookingPeriodMode: document.querySelector('#booking-period-mode'),
  bookingPeriodInputWrap: document.querySelector('#booking-period-input-wrap'),
  bookingPeriodLabel: document.querySelector('#booking-period-label'),
  bookingPeriodTrigger: document.querySelector('#booking-period-trigger'),
  bookingPeriodDisplay: document.querySelector('#booking-period-display'),
  bookingPeriodPanel: document.querySelector('#booking-period-panel'),
  bookingPeriodPrevYear: document.querySelector('#booking-period-prev-year'),
  bookingPeriodNextYear: document.querySelector('#booking-period-next-year'),
  bookingPeriodYear: document.querySelector('#booking-period-year'),
  bookingPeriodMonths: document.querySelector('#booking-period-months'),
  bookingPeriodWeeks: document.querySelector('#booking-period-weeks'),
  bookingDialog: document.querySelector('#booking-dialog'),
  closeBookingModal: document.querySelector('#close-booking-modal'),
  bookingEditForm: document.querySelector('#booking-edit-form'),
  bookingEditStatus: document.querySelector('#booking-edit-status'),
  bookingModalCustomer: document.querySelector('#booking-modal-customer'),
  bookingModalMeta: document.querySelector('#booking-modal-meta'),
  refreshDashboard: document.querySelector('#refresh-dashboard'),
  logoutButton: document.querySelector('#logout-button'),
  calendarRoomSelect: document.querySelector('#calendar-room-select'),
  calendarMonthInput: document.querySelector('#calendar-month-input'),
  calendarMonthTrigger: document.querySelector('#calendar-month-trigger'),
  calendarMonthDisplay: document.querySelector('#calendar-month-display'),
  calendarMonthPanel: document.querySelector('#calendar-month-panel'),
  calendarMonthPrevYear: document.querySelector('#calendar-month-prev-year'),
  calendarMonthNextYear: document.querySelector('#calendar-month-next-year'),
  calendarMonthYear: document.querySelector('#calendar-month-year'),
  calendarMonthsGrid: document.querySelector('#calendar-months-grid'),
  loadCalendarButton: document.querySelector('#load-calendar-button'),
  calendarEditor: document.querySelector('#calendar-editor'),
  passwordDialog: document.querySelector('#password-dialog'),
  openPasswordModal: document.querySelector('#open-password-modal'),
  closePasswordModal: document.querySelector('#close-password-modal'),
  passwordForm: document.querySelector('#password-form'),
  passwordStatus: document.querySelector('#password-status')
};

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelShort(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function saveSession() {
  localStorage.setItem('ruralstay-admin-token', state.token || '');
  localStorage.setItem('ruralstay-admin-profile', JSON.stringify(state.admin || null));
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...(options.headers || {})
  };
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Richiesta non riuscita');
  return data;
}

function formatMoney(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDateRange(checkIn, checkOut) {
  const fmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });
  return `${fmt.format(new Date(`${checkIn}T12:00:00`))} → ${fmt.format(new Date(`${checkOut}T12:00:00`))}`;
}

function parseGalleryImages(value) {
  return `${value || ''}`.split('\n').map((item) => item.trim()).filter(Boolean);
}

function setVisible() {
  refs.loginView.classList.toggle('is-hidden', Boolean(state.token));
  refs.appView.classList.toggle('is-hidden', !state.token);
}

function setStatus(node, message = '', mode = '') {
  node.textContent = message;
  node.className = `status-text${mode ? ` is-${mode}` : ''}`;
}

function renderSummary() {
  if (!state.summary) {
    refs.summaryGrid.innerHTML = '';
    return;
  }
  const cards = [
    ['Prenotazioni totali', state.summary.total_bookings],
    ['Guadagni confermati', formatMoney(state.summary.confirmed_revenue)],
    ['Occupazione media', `${state.summary.occupancy_rate}%`]
  ];
  refs.summaryGrid.innerHTML = cards.map(([label, value]) => `
    <article class="stat-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </article>
  `).join('');
}

function getActiveProperty() {
  return state.properties.find((property) => property.slug === ACTIVE_PROPERTY_SLUG) || state.properties[0] || null;
}

function roomOptions() {
  const property = getActiveProperty();
  return property ? property.rooms.map((room) => ({ ...room, property_name: property.name })) : [];
}

function getFilteredBookings() {
  const status = refs.bookingStatusFilter.value;
  const mode = refs.bookingPeriodMode.value;
  const selectedPeriod = state.bookingPeriodSelection;
  return state.allBookings.filter((booking) => {
    if (status && booking.status !== status) return false;
    if (!mode || !selectedPeriod) return true;
    const checkInDate = new Date(`${booking.check_in}T12:00:00`);
    if (mode === 'month') {
      return checkInDate.getFullYear() === selectedPeriod.year && (checkInDate.getMonth() + 1) === selectedPeriod.month;
    }
    if (mode === 'week') {
      const bookingStart = new Date(`${booking.check_in}T12:00:00`);
      const bookingEnd = new Date(`${booking.check_out}T12:00:00`);
      return bookingStart <= selectedPeriod.end && bookingEnd >= selectedPeriod.start;
    }
    return true;
  });
}

function renderRoomsPanel() {
  const property = getActiveProperty();
  if (!property) return;
  const listRoot = document.querySelector('#rooms-admin-list');
  if (!listRoot) return;
  listRoot.innerHTML = `
    <div class="room-admin-list">
    <div class="panel-head">
      <div>
        <p class="eyebrow soft">Camere pubblicate</p>
        <h2>${property.name}</h2>
      </div>
    </div>
    <div class="room-list">
      ${property.rooms.map((room) => `
        <div class="room-item">
          <div>
            <strong>${room.name}</strong>
            <span class="soft-copy">${room.capacity} ospiti · ${formatMoney(room.base_price)} · ${room.active ? 'Online' : 'Nascosta'}</span>
          </div>
          <button class="ghost-btn small-btn" type="button" data-edit-room="${room.id}">Modifica</button>
        </div>
      `).join('')}
    </div>
    </div>
  `;
  listRoot.querySelectorAll('[data-edit-room]').forEach((button) => {
    button.addEventListener('click', () => openRoomEditor(Number(button.dataset.editRoom)));
  });

  const roomSelectOptions = roomOptions();
  refs.calendarRoomSelect.innerHTML = roomSelectOptions.length
    ? roomSelectOptions.map((room) => `<option value="${room.id}">${room.property_name} · ${room.name}</option>`).join('')
    : '<option value="">Nessuna camera</option>';
  if (!state.selectedRoomId && roomSelectOptions[0]) state.selectedRoomId = roomSelectOptions[0].id;
  if (state.selectedRoomId) refs.calendarRoomSelect.value = String(state.selectedRoomId);
}

function renderCalendarMonthPicker() {
  refs.calendarMonthYear.textContent = String(state.calendarPickerYear);
  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  const selected = refs.calendarMonthInput.value || monthValue();
  refs.calendarMonthsGrid.innerHTML = monthNames.map((label, index) => {
    const month = index + 1;
    const value = `${state.calendarPickerYear}-${String(month).padStart(2, '0')}`;
    const active = value === selected;
    return `<button class="period-month-btn${active ? ' is-active' : ''}" type="button" data-calendar-month="${value}">${label}</button>`;
  }).join('');
  refs.calendarMonthsGrid.querySelectorAll('[data-calendar-month]').forEach((button) => {
    button.addEventListener('click', () => {
      refs.calendarMonthInput.value = button.dataset.calendarMonth;
      refs.calendarMonthDisplay.textContent = monthLabelShort(button.dataset.calendarMonth);
      refs.calendarMonthPanel.classList.add('is-hidden');
    });
  });
}

function renderGalleryPreview(target, images = []) {
  if (!target) return;
  if (!images.length) {
    target.classList.add('is-empty');
    target.innerHTML = '<p class="gallery-preview-note">Nessuna foto secondaria inserita.</p>';
    return;
  }
  target.classList.remove('is-empty');
  target.innerHTML = images.map((image, index) => `
    <div class="gallery-preview-item">
      <img src="${image}" alt="Foto secondaria ${index + 1}">
      <span>Foto ${index + 1}</span>
    </div>
  `).join('');
}

function renderBookings() {
  state.bookings = getFilteredBookings();
  refs.bookingsTableBody.innerHTML = state.bookings.map((booking) => `
    <tr>
      <td>${booking.room_name}</td>
      <td>
        <strong>${booking.customer_name}</strong><br>
        <span class="soft-copy">${booking.customer_email}<br>${booking.customer_phone}</span>
      </td>
      <td>${booking.customer_notes ? booking.customer_notes : '<span class="soft-copy">Nessuna nota</span>'}</td>
      <td>${formatDateRange(booking.check_in, booking.check_out)}</td>
      <td>${formatMoney(booking.total_price)}</td>
      <td>
        <div class="booking-status-cell">
          <span class="badge ${booking.status}">${booking.status_label}</span>
          <button class="ghost-btn small-btn" type="button" data-edit-booking="${booking.id}">Modifica</button>
        </div>
      </td>
    </tr>
  `).join('');

  refs.bookingsTableBody.querySelectorAll('[data-edit-booking]').forEach((button) => {
    button.addEventListener('click', () => openBookingEditor(Number(button.dataset.editBooking)));
  });
}

function findRoom(roomId) {
  return roomOptions().find((room) => room.id === roomId);
}

function openRoomEditor(roomId) {
  const room = findRoom(roomId);
  if (!room) return;
  refs.roomEditForm.elements.id.value = room.id;
  refs.roomEditForm.elements.name.value = room.name;
  refs.roomEditForm.elements.description.value = room.description;
  refs.roomEditForm.elements.capacity.value = room.capacity;
  refs.roomEditForm.elements.base_price.value = room.base_price;
  refs.roomEditForm.elements.image_url.value = room.image_url;
  refs.roomEditForm.elements.amenities.value = room.amenities.join(', ');
  refs.roomEditForm.elements.gallery_images.value = (room.gallery_images || []).join('\n');
  refs.roomEditForm.elements.active.checked = Boolean(room.active);
  renderGalleryPreview(refs.roomEditGalleryPreview, room.gallery_images || []);
  setStatus(refs.roomEditStatus, '');
  refs.roomDialog.showModal();
}

async function loadCalendar() {
  const roomId = Number(refs.calendarRoomSelect.value || state.selectedRoomId || 0);
  const month = refs.calendarMonthInput.value || monthValue();
  if (!roomId || !month) {
    refs.calendarEditor.innerHTML = '<p class="status-text">Seleziona una camera valida.</p>';
    return;
  }
  state.selectedRoomId = roomId;
  refs.calendarEditor.innerHTML = '<p class="status-text">Carico calendario...</p>';
  try {
    const { room, calendar } = await api(`/api/admin/rooms/${roomId}/calendar?month=${month}`);
    refs.calendarEditor.innerHTML = `
      <div class="panel-head">
        <div>
          <p class="eyebrow soft">${room.property_name || 'Camera'}</p>
          <h2>${room.name}</h2>
        </div>
        <div class="calendar-head-actions">
          <div class="pill-row">
          <span class="pill">${room.capacity} ospiti</span>
          <span class="pill">Base ${formatMoney(room.base_price)}</span>
          </div>
          <button id="save-calendar-button" class="primary-btn" type="button">Salva modifiche</button>
        </div>
      </div>
      <div class="calendar-grid">
        ${calendar.map((day) => `
          <div class="day-card${day.available ? '' : ' is-unavailable'}" data-day-card data-room-id="${roomId}" data-day="${day.day}">
            <div class="day-head">
              <strong>${new Date(`${day.day}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' })}</strong>
              <span class="pill">${day.booked ? 'Occupata' : 'Libera'}</span>
            </div>
            <div class="day-fields">
              <label>
                <span>Prezzo</span>
                <input name="price" type="number" min="50" value="${day.price}">
              </label>
              <label>
                <span>Notti minime</span>
                <input name="min_nights" type="number" min="1" value="${day.min_nights || 1}">
              </label>
              <label>
                <span>Nota</span>
                <input name="note" type="text" value="${day.note || ''}">
              </label>
              <label class="day-switch">
                <input name="available" type="checkbox" ${day.available ? 'checked' : ''} ${day.booked ? 'disabled' : ''}>
                <span>${day.booked ? 'Bloccata da prenotazione' : 'Disponibile'}</span>
              </label>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    refs.calendarEditor.querySelector('#save-calendar-button')?.addEventListener('click', saveCalendarInventory);
  } catch (error) {
    refs.calendarEditor.innerHTML = `<p class="status-text is-error">${error.message}</p>`;
  }
}

async function saveCalendarInventory() {
  const dayCards = Array.from(refs.calendarEditor.querySelectorAll('[data-day-card]'));
  const saveButton = refs.calendarEditor.querySelector('#save-calendar-button');
  if (!dayCards.length || !saveButton) return;
  saveButton.disabled = true;
  saveButton.textContent = 'Salvo...';
  try {
    for (const card of dayCards) {
      const roomId = card.dataset.roomId;
      const day = card.dataset.day;
      await api(`/api/admin/inventory/${roomId}/${day}`, {
        method: 'PATCH',
        body: JSON.stringify({
          price: Number(card.querySelector('[name="price"]')?.value || 0),
          min_nights: Number(card.querySelector('[name="min_nights"]')?.value || 1),
          note: `${card.querySelector('[name="note"]')?.value || ''}`.trim(),
          available: card.querySelector('[name="available"]')?.checked === true
        })
      });
    }
    saveButton.textContent = 'Modifiche salvate';
    setTimeout(() => {
      saveButton.disabled = false;
      saveButton.textContent = 'Salva modifiche';
    }, 1400);
  } catch (error) {
    saveButton.disabled = false;
    saveButton.textContent = 'Salva modifiche';
    alert(error.message);
  }
}

async function loadDashboard() {
  const { summary, properties, bookings } = await api('/api/admin/dashboard');
  const activeProperty = properties.find((property) => property.slug === ACTIVE_PROPERTY_SLUG) || properties[0] || null;
  state.properties = activeProperty ? [activeProperty] : [];
  state.allBookings = activeProperty ? bookings.filter((booking) => booking.property_name === activeProperty.name) : [];
  state.summary = {
    total_bookings: state.allBookings.length,
    confirmed_revenue: state.allBookings.filter((booking) => booking.status === 'confirmed').reduce((sum, booking) => sum + Number(booking.total_price || 0), 0),
    occupancy_rate: summary.occupancy_rate
  };
  renderSummary();
  renderRoomsPanel();
  renderBookings();
}

async function loadBookingsByStatus() {
  renderBookings();
}

async function login(event) {
  event.preventDefault();
  setStatus(refs.loginStatus, 'Controllo credenziali...');
  const data = new FormData(refs.loginForm);
  try {
    const response = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({
        username: `${data.get('username') || ''}`.trim(),
        password: `${data.get('password') || ''}`
      })
    });
    state.token = response.token;
    state.admin = response.admin;
    saveSession();
    setVisible();
    await loadDashboard();
    refs.calendarMonthInput.value = monthValue();
    await loadCalendar();
  } catch (error) {
    setStatus(refs.loginStatus, error.message, 'error');
  }
}

async function logout() {
  try {
    if (state.token) await api('/api/admin/logout', { method: 'POST' });
  } catch (_) {}
  state.token = '';
  state.admin = null;
  saveSession();
  setVisible();
}

async function submitRoom(event) {
  event.preventDefault();
  const data = new FormData(refs.roomForm);
  const property = getActiveProperty();
  setStatus(refs.roomFormStatus, 'Salvo camera...');
  try {
    await api('/api/admin/rooms', {
      method: 'POST',
      body: JSON.stringify({
        property_id: Number(property?.id || 0),
        name: `${data.get('name') || ''}`.trim(),
        description: `${data.get('description') || ''}`.trim(),
        capacity: Number(data.get('capacity') || 0),
        base_price: Number(data.get('base_price') || 0),
        image_url: `${data.get('image_url') || ''}`.trim(),
        amenities: `${data.get('amenities') || ''}`.split(',').map((item) => item.trim()).filter(Boolean),
        gallery_images: parseGalleryImages(data.get('gallery_images')),
        active: true
      })
    });
    refs.roomForm.reset();
    renderGalleryPreview(refs.roomGalleryPreview, []);
    setStatus(refs.roomFormStatus, 'Camera creata', 'success');
    await loadDashboard();
    await loadCalendar();
  } catch (error) {
    setStatus(refs.roomFormStatus, error.message, 'error');
  }
}

async function submitRoomEdit(event) {
  event.preventDefault();
  const data = new FormData(refs.roomEditForm);
  const roomId = Number(data.get('id') || 0);
  setStatus(refs.roomEditStatus, 'Aggiorno camera...');
  try {
    await api(`/api/admin/rooms/${roomId}/update`, {
      method: 'POST',
      body: JSON.stringify({
        property_id: Number(getActiveProperty()?.id || 0),
        name: `${data.get('name') || ''}`.trim(),
        description: `${data.get('description') || ''}`.trim(),
        capacity: Number(data.get('capacity') || 0),
        base_price: Number(data.get('base_price') || 0),
        image_url: `${data.get('image_url') || ''}`.trim(),
        amenities: `${data.get('amenities') || ''}`.split(',').map((item) => item.trim()).filter(Boolean),
        gallery_images: parseGalleryImages(data.get('gallery_images')),
        active: data.get('active') === 'on'
      })
    });
    setStatus(refs.roomEditStatus, 'Camera aggiornata', 'success');
    await loadDashboard();
    await loadCalendar();
    setTimeout(() => refs.roomDialog.close(), 500);
  } catch (error) {
    setStatus(refs.roomEditStatus, error.message, 'error');
  }
}

function openBookingEditor(bookingId) {
  const booking = state.allBookings.find((item) => item.id === bookingId);
  if (!booking) return;
  refs.bookingEditForm.elements.id.value = booking.id;
  refs.bookingEditForm.elements.status.value = booking.status;
  refs.bookingModalCustomer.textContent = booking.customer_name;
  refs.bookingModalMeta.textContent = `${booking.room_name} · ${formatDateRange(booking.check_in, booking.check_out)}`;
  setStatus(refs.bookingEditStatus, '');
  refs.bookingDialog.showModal();
}

async function saveBookingStatus(event) {
  event.preventDefault();
  const data = new FormData(refs.bookingEditForm);
  const bookingId = Number(data.get('id') || 0);
  const status = `${data.get('status') || ''}`;
  setStatus(refs.bookingEditStatus, 'Aggiorno stato...');
  try {
    await api(`/api/admin/bookings/${bookingId}/update`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
    setStatus(refs.bookingEditStatus, 'Stato aggiornato', 'success');
    await loadDashboard();
    setTimeout(() => refs.bookingDialog.close(), 400);
  } catch (error) {
    setStatus(refs.bookingEditStatus, error.message, 'error');
  }
}

function updateBookingPeriodControl() {
  const mode = refs.bookingPeriodMode.value;
  if (!mode) {
    refs.bookingPeriodInputWrap.classList.add('is-hidden');
    refs.bookingPeriodPanel.classList.add('is-hidden');
    refs.bookingPeriodDisplay.textContent = 'Seleziona';
    refs.bookingPeriodLabel.textContent = 'Seleziona dal calendario';
    refs.bookingPeriodWeeks.classList.add('is-hidden');
    refs.bookingPeriodWeeks.innerHTML = '';
    state.bookingPeriodSelection = null;
    return;
  }
  refs.bookingPeriodInputWrap.classList.remove('is-hidden');
  refs.bookingPeriodDisplay.textContent = mode === 'week' ? 'Scegli settimana' : 'Scegli mese';
  refs.bookingPeriodLabel.textContent = mode === 'week' ? 'Scegli mese e settimana' : 'Scegli mese';
  state.bookingPeriodSelection = null;
  renderBookingPeriodPanel();
}

function renderBookingPeriodPanel() {
  refs.bookingPeriodYear.textContent = String(state.bookingPeriodYear);
  const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  refs.bookingPeriodMonths.innerHTML = monthNames.map((label, index) => {
    const month = index + 1;
    const active = state.bookingPeriodSelection?.mode === 'month'
      && state.bookingPeriodSelection.year === state.bookingPeriodYear
      && state.bookingPeriodSelection.month === month;
    return `<button class="period-month-btn${active ? ' is-active' : ''}" type="button" data-period-month="${month}">${label}</button>`;
  }).join('');
  refs.bookingPeriodMonths.querySelectorAll('[data-period-month]').forEach((button) => {
    button.addEventListener('click', () => selectBookingMonth(Number(button.dataset.periodMonth)));
  });
}

function selectBookingMonth(month) {
  const mode = refs.bookingPeriodMode.value;
  if (mode === 'month') {
    state.bookingPeriodSelection = { mode: 'month', year: state.bookingPeriodYear, month };
    refs.bookingPeriodDisplay.textContent = `${monthNameLong(month)} ${state.bookingPeriodYear}`;
    refs.bookingPeriodPanel.classList.add('is-hidden');
    renderBookingPeriodPanel();
    loadBookingsByStatus();
    return;
  }
  renderBookingWeeks(month);
}

function renderBookingWeeks(month) {
  const weeks = getWeeksForMonth(state.bookingPeriodYear, month);
  refs.bookingPeriodWeeks.classList.remove('is-hidden');
  refs.bookingPeriodWeeks.innerHTML = weeks.map((week, index) => `
    <button class="period-week-btn" type="button" data-week-index="${index}">
      ${week.label}
    </button>
  `).join('');
  refs.bookingPeriodWeeks.querySelectorAll('[data-week-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const week = weeks[Number(button.dataset.weekIndex)];
      state.bookingPeriodSelection = {
        mode: 'week',
        year: state.bookingPeriodYear,
        month,
        start: week.start,
        end: week.end,
        label: week.label
      };
      refs.bookingPeriodDisplay.textContent = `${monthNameLong(month)} · ${week.label}`;
      refs.bookingPeriodPanel.classList.add('is-hidden');
      loadBookingsByStatus();
    });
  });
}

function monthNameLong(month) {
  return new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(new Date(2026, month - 1, 1));
}

function getWeeksForMonth(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const weeks = [];
  let cursor = new Date(firstDay);
  while (cursor <= lastDay) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(Math.min(start.getDate() + 6, lastDay.getDate()));
    weeks.push({
      start,
      end,
      label: `${String(start.getDate()).padStart(2, '0')}–${String(end.getDate()).padStart(2, '0')}`
    });
    cursor = new Date(end);
    cursor.setDate(end.getDate() + 1);
  }
  return weeks;
}

async function changePassword(event) {
  event.preventDefault();
  const data = new FormData(refs.passwordForm);
  setStatus(refs.passwordStatus, 'Aggiorno password...');
  try {
    const { message } = await api('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: `${data.get('currentPassword') || ''}`,
        newPassword: `${data.get('newPassword') || ''}`
      })
    });
    refs.passwordForm.reset();
    setStatus(refs.passwordStatus, message, 'success');
  } catch (error) {
    setStatus(refs.passwordStatus, error.message, 'error');
  }
}

function bindEvents() {
  refs.loginForm.addEventListener('submit', login);
  refs.logoutButton.addEventListener('click', logout);
  refs.roomForm.addEventListener('submit', submitRoom);
  refs.refreshDashboard.addEventListener('click', async () => {
    await loadDashboard();
    await loadCalendar();
  });
  refs.bookingStatusFilter.addEventListener('change', loadBookingsByStatus);
  refs.bookingPeriodMode.addEventListener('change', () => {
    updateBookingPeriodControl();
    loadBookingsByStatus();
  });
  refs.bookingPeriodTrigger.addEventListener('click', () => {
    refs.bookingPeriodPanel.classList.toggle('is-hidden');
  });
  refs.bookingPeriodPrevYear.addEventListener('click', () => {
    state.bookingPeriodYear -= 1;
    refs.bookingPeriodWeeks.classList.add('is-hidden');
    refs.bookingPeriodWeeks.innerHTML = '';
    renderBookingPeriodPanel();
  });
  refs.bookingPeriodNextYear.addEventListener('click', () => {
    state.bookingPeriodYear += 1;
    refs.bookingPeriodWeeks.classList.add('is-hidden');
    refs.bookingPeriodWeeks.innerHTML = '';
    renderBookingPeriodPanel();
  });
  refs.loadCalendarButton.addEventListener('click', loadCalendar);
  refs.calendarRoomSelect.addEventListener('change', () => {
    state.selectedRoomId = Number(refs.calendarRoomSelect.value || 0);
  });
  refs.calendarMonthTrigger.addEventListener('click', () => {
    refs.calendarMonthPanel.classList.toggle('is-hidden');
  });
  refs.calendarMonthPrevYear.addEventListener('click', () => {
    state.calendarPickerYear -= 1;
    renderCalendarMonthPicker();
  });
  refs.calendarMonthNextYear.addEventListener('click', () => {
    state.calendarPickerYear += 1;
    renderCalendarMonthPicker();
  });
  refs.openPasswordModal.addEventListener('click', () => refs.passwordDialog.showModal());
  refs.closePasswordModal.addEventListener('click', () => refs.passwordDialog.close());
  refs.passwordForm.addEventListener('submit', changePassword);
  refs.closeRoomModal.addEventListener('click', () => refs.roomDialog.close());
  refs.roomEditForm.addEventListener('submit', submitRoomEdit);
  refs.closeBookingModal.addEventListener('click', () => refs.bookingDialog.close());
  refs.bookingEditForm.addEventListener('submit', saveBookingStatus);
  refs.roomForm.elements.gallery_images.addEventListener('input', (event) => {
    renderGalleryPreview(refs.roomGalleryPreview, parseGalleryImages(event.target.value));
  });
  refs.roomEditForm.elements.gallery_images.addEventListener('input', (event) => {
    renderGalleryPreview(refs.roomEditGalleryPreview, parseGalleryImages(event.target.value));
  });
}

async function bootstrap() {
  refs.calendarMonthInput.value = monthValue();
  refs.calendarMonthDisplay.textContent = monthLabelShort(refs.calendarMonthInput.value);
  state.calendarPickerYear = Number((refs.calendarMonthInput.value || monthValue()).split('-')[0]);
  setVisible();
  bindEvents();
  renderCalendarMonthPicker();
  updateBookingPeriodControl();
  renderGalleryPreview(refs.roomGalleryPreview, []);
  renderGalleryPreview(refs.roomEditGalleryPreview, []);
  if (!state.token) return;
  try {
    await loadDashboard();
    await loadCalendar();
  } catch (error) {
    state.token = '';
    state.admin = null;
    saveSession();
    setVisible();
  }
}

bootstrap();

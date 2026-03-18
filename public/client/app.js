const FEATURED_SLUG = 'podere-al-sole';
const RESTAURANT_STORIES = [
  {
    kicker: 'Sapori autentici',
    text: 'Colazioni fatte in casa, cene su prenotazione, materie prime locali e una sala affacciata sulle colline: un’esperienza pensata per completare il soggiorno con il gusto autentico della campagna toscana.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80'
  },
  {
    kicker: 'Ingredienti del territorio',
    text: 'Pane cotto al mattino, ortaggi dell’orto, olio del territorio e un menu che cambia con le stagioni accompagnano il soggiorno con un ritmo semplice e accogliente.',
    image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1600&q=80'
  },
  {
    kicker: 'Degustazioni e cena',
    text: 'Taglieri, vini locali e una cucina essenziale ma curata trasformano la sera in una piccola esperienza da vivere lentamente, senza formalità inutili.',
    image: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1600&q=80'
  }
];
const state = {
  config: null,
  property: null,
  selectedRoom: null,
  bookingDraft: null,
  bookingCalendar: [],
  bookingMonth: '',
  heroCalendar: [],
  heroMonth: '',
  restaurantImageIndex: 0,
  restaurantTimer: null,
  roomGalleryImages: [],
  roomGalleryIndex: 0,
  featureStories: [],
  activeStoryIndex: 0,
  storyTimer: null,
  filters: {
    checkIn: '',
    checkOut: '',
    guests: 2
  }
};

const refs = {
  heroTitle: document.querySelector('#hero-title'),
  heroCopy: document.querySelector('#hero-copy'),
  heroSelectedPeriod: document.querySelector('#hero-selected-period'),
  heroPeriodTrigger: document.querySelector('#hero-period-trigger'),
  heroCalendarShell: document.querySelector('#hero-calendar-shell'),
  heroPrevMonth: document.querySelector('#hero-prev-month'),
  heroNextMonth: document.querySelector('#hero-next-month'),
  heroMonthLabel: document.querySelector('#hero-month-label'),
  heroCalendarStatus: document.querySelector('#hero-calendar-status'),
  heroCalendarGrid: document.querySelector('#hero-calendar-grid'),
  storyVisual: document.querySelector('#story-visual'),
  storyVisualKicker: document.querySelector('#story-visual-kicker'),
  storyVisualText: document.querySelector('#story-visual-text'),
  storySequence: document.querySelector('#story-sequence'),
  searchForm: document.querySelector('#search-form'),
  resultsStatus: document.querySelector('#results-status'),
  roomsGrid: document.querySelector('#rooms-grid'),
  roomGalleryDialog: document.querySelector('#room-gallery-dialog'),
  closeRoomGalleryDialog: document.querySelector('#close-room-gallery-dialog'),
  roomGalleryTitle: document.querySelector('#room-gallery-title'),
  roomGalleryStage: document.querySelector('#room-gallery-stage'),
  roomGalleryThumbs: document.querySelector('#room-gallery-thumbs'),
  languageSwitchButtons: document.querySelectorAll('[data-lang]'),
  bookingDialog: document.querySelector('#booking-dialog'),
  closeBookingDialog: document.querySelector('#close-booking-dialog'),
  bookingRoomResult: document.querySelector('#booking-room-result'),
  bookingActivate: document.querySelector('#booking-activate'),
  bookingSummary: document.querySelector('#booking-summary'),
  bookingFlow: document.querySelector('#booking-flow'),
  bookingPrevMonth: document.querySelector('#booking-prev-month'),
  bookingNextMonth: document.querySelector('#booking-next-month'),
  bookingMonthLabel: document.querySelector('#booking-month-label'),
  bookingCalendarGrid: document.querySelector('#booking-calendar-grid'),
  bookingCalendarStatus: document.querySelector('#booking-calendar-status'),
  bookingForm: document.querySelector('#booking-form'),
  bookingTotalValue: document.querySelector('#booking-total-value'),
  bookingFormStatus: document.querySelector('#booking-form-status'),
  contactForm: document.querySelector('#contact-form'),
  contactFormStatus: document.querySelector('#contact-form-status'),
  cookieBanner: document.querySelector('#cookie-banner'),
  cookieAccept: document.querySelector('#cookie-accept'),
  cookieReject: document.querySelector('#cookie-reject'),
  roomCardTemplate: document.querySelector('#room-card-template')
};

const COOKIE_KEY = 'podere-cookie-consent';

function toIsoLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso() {
  return toIsoLocal(new Date());
}

function currentMonthIso() {
  return monthValue(new Date());
}

function isPastDay(day) {
  return day < todayIso();
}

function initLanguageSwitch() {
  const current = document.documentElement.lang?.toLowerCase().startsWith('en') ? 'en' : 'it';
  refs.languageSwitchButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.lang === current);
  });
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Richiesta non riuscita');
  return data;
}

function formatMoney(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function toLongDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`));
}

function nightsBetween(checkIn, checkOut) {
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  return Math.round((end - start) / 86400000);
}

function monthValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(value) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

function shiftMonth(value, offset) {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return monthValue(date);
}

function syncCalendarNavState() {
  const minMonth = currentMonthIso();
  if (refs.heroPrevMonth) {
    refs.heroPrevMonth.disabled = shiftMonth(state.heroMonth, -1) < minMonth;
  }
  if (refs.bookingPrevMonth) {
    refs.bookingPrevMonth.disabled = shiftMonth(state.bookingMonth, -1) < minMonth;
  }
}

function setStatus(message = '', mode = '') {
  refs.resultsStatus.textContent = message;
  refs.resultsStatus.className = `status-copy${mode ? ` is-${mode}` : ''}`;
}

function renderRestaurantVisual(index = 0) {
  const story = RESTAURANT_STORIES[index] || RESTAURANT_STORIES[0];
  refs.storyVisual.style.backgroundImage = `linear-gradient(180deg, rgba(20, 14, 10, 0.08), rgba(20, 14, 10, 0.56)), url('${story.image}')`;
  refs.storyVisualKicker.textContent = story.kicker;
  refs.storyVisualText.textContent = story.text;
}

function startRestaurantVisualRotation() {
  renderRestaurantVisual(0);
  if (state.restaurantTimer) window.clearInterval(state.restaurantTimer);
  state.restaurantTimer = window.setInterval(() => {
    state.restaurantImageIndex = (state.restaurantImageIndex + 1) % RESTAURANT_STORIES.length;
    renderRestaurantVisual(state.restaurantImageIndex);
  }, 4200);
}

function getRoomGallery(room) {
  const gallery = Array.isArray(room.gallery_images) ? room.gallery_images.filter(Boolean) : [];
  if (gallery.length) {
    return [room.image_url, ...gallery.filter((image) => image !== room.image_url)];
  }
  return [
    room.image_url,
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
  ];
}

function renderRoomGallery(index = 0) {
  state.roomGalleryIndex = index;
  const image = state.roomGalleryImages[index];
  refs.roomGalleryStage.innerHTML = `<div class="room-gallery-hero" style="background-image: linear-gradient(180deg, rgba(31, 21, 13, 0.10), rgba(31, 21, 13, 0.26)), url('${image}');"></div>`;
  refs.roomGalleryThumbs.innerHTML = state.roomGalleryImages.map((item, itemIndex) => `
    <button class="room-gallery-thumb${itemIndex === index ? ' is-active' : ''}" type="button" data-gallery-index="${itemIndex}" style="background-image: url('${item}');" aria-label="Immagine ${itemIndex + 1}"></button>
  `).join('');
  refs.roomGalleryThumbs.querySelectorAll('[data-gallery-index]').forEach((button) => {
    button.addEventListener('click', () => renderRoomGallery(Number(button.dataset.galleryIndex)));
  });
}

function openRoomGallery(room) {
  state.roomGalleryImages = getRoomGallery(room);
  refs.roomGalleryTitle.textContent = room.name;
  renderRoomGallery(0);
  refs.roomGalleryDialog.showModal();
}

function buildFeatureStories(property) {
  const images = property.images?.length ? property.images.map((item) => item.image_url) : [property.hero_image];
  return [
    {
      image: images[0] || property.hero_image,
      eyebrow: 'Atmosfera',
      title: property.name,
      copy: property.description,
      details: [
        `${property.city}, ${property.region}`,
        `Rating ${property.rating.toFixed(1)}`,
        `${property.review_count} recensioni`
      ]
    },
    {
      image: images[1] || images[0] || property.hero_image,
      eyebrow: 'Caratteristiche',
      title: 'Dettagli che fanno la differenza',
      copy: property.tagline || 'Una struttura autentica con servizi chiari e una promessa di soggiorno semplice da capire e facile da prenotare.',
      details: property.amenities.slice(0, 4)
    },
    {
      image: images[2] || images[1] || images[0] || property.hero_image,
      eyebrow: 'Esperienza',
      title: 'Un soggiorno concreto, senza passaggi confusi',
      copy: 'Calendario leggibile, prezzi giorno per giorno e camere pensate per un’esperienza di campagna più elegante e rilassata.',
      details: [
        `${property.rooms.length} camere disponibili`,
        'Prezzi dinamici per data',
        'Prenotazione diretta dal sito'
      ]
    }
  ];
}

function renderStoryIndicators() {
  const indicatorsRoot = document.querySelector('#story-indicators');
  if (!indicatorsRoot) return;
  indicatorsRoot.innerHTML = state.featureStories.map((story, index) => `
    <button class="story-dot${index === state.activeStoryIndex ? ' is-active' : ''}" type="button" data-story-index="${index}" aria-label="${story.title}"></button>
  `).join('');
  indicatorsRoot.querySelectorAll('[data-story-index]').forEach((button) => {
    button.addEventListener('click', () => {
      showStory(Number(button.dataset.storyIndex));
      restartStoryTimer();
    });
  });
}

function showStory(index) {
  state.activeStoryIndex = index;
  const story = state.featureStories[index];
  if (!story) return;
  refs.storySequence.innerHTML = `
    <article class="feature-slide">
      <div class="feature-slide-image" style="background-image: linear-gradient(180deg, rgba(31, 21, 13, 0.14), rgba(31, 21, 13, 0.34)), url('${story.image}');"></div>
      <div class="feature-slide-copy">
        <p class="eyebrow ${index % 2 === 1 ? 'olive' : 'warm'}">${story.eyebrow}</p>
        <h3>${story.title}</h3>
        <p class="lead-copy">${story.copy}</p>
        <div class="feature-points">
          ${story.details.map((detail, detailIndex) => `
            <div class="feature-point" style="animation-delay: ${180 + detailIndex * 120}ms;">
              <span class="feature-point-index">${String(detailIndex + 1).padStart(2, '0')}</span>
              <span>${detail}</span>
            </div>
          `).join('')}
        </div>
        <div id="story-indicators" class="story-indicators"></div>
      </div>
    </article>
  `;
  renderStoryIndicators();
}

function restartStoryTimer() {
  if (state.storyTimer) window.clearInterval(state.storyTimer);
  if (state.featureStories.length <= 1) return;
  state.storyTimer = window.setInterval(() => {
    const nextIndex = (state.activeStoryIndex + 1) % state.featureStories.length;
    showStory(nextIndex);
  }, 4600);
}

function renderStorySequence(property) {
  state.featureStories = buildFeatureStories(property);
  state.activeStoryIndex = 0;
  showStory(0);
  restartStoryTimer();
}

function renderProperty(property) {
  refs.heroTitle.textContent = property.name;
  refs.heroCopy.textContent = property.tagline || property.description;
  renderStorySequence(property);
  renderRooms(property.rooms);
}

async function fetchRoomCalendar(roomId) {
  const month = state.bookingMonth || state.filters.checkIn?.slice(0, 7) || monthValue(new Date());
  const { calendar } = await api(`/api/rooms/${roomId}/calendar?month=${month}`);
  return calendar;
}

async function fetchPropertyCalendar() {
  const month = state.heroMonth || monthValue(new Date());
  try {
    const { calendar } = await api(`/api/properties/${FEATURED_SLUG}/calendar?month=${month}&guests=${encodeURIComponent(state.filters.guests || 1)}`);
    return calendar;
  } catch (error) {
    if (!state.property?.rooms?.length) throw error;
    const eligibleRooms = state.property.rooms.filter((room) => room.capacity >= (state.filters.guests || 1));
    if (!eligibleRooms.length) return [];
    const monthMaps = await Promise.all(
      eligibleRooms.map(async (room) => {
        const { calendar } = await api(`/api/rooms/${room.id}/calendar?month=${month}`);
        return new Map(calendar.map((day) => [day.day, day]));
      })
    );
    const seedMap = monthMaps[0];
    return Array.from(seedMap.values()).map((baseDay) => {
      const variants = monthMaps.map((map) => map.get(baseDay.day)).filter(Boolean);
      const availableVariants = variants.filter((day) => day.available);
      return {
        day: baseDay.day,
        available: availableVariants.length > 0,
        price: availableVariants.length
          ? Math.min(...availableVariants.map((day) => Number(day.price || 0)))
          : Number(baseDay.price || 0)
      };
    });
  }
}

async function fetchAvailableRooms() {
  try {
    const { rooms } = await api(
      `/api/properties/${FEATURED_SLUG}/availability?checkIn=${encodeURIComponent(state.filters.checkIn)}&checkOut=${encodeURIComponent(state.filters.checkOut)}&guests=${encodeURIComponent(state.filters.guests)}`
    );
    return rooms;
  } catch (error) {
    if (!state.property?.rooms?.length) throw error;
    const eligibleRooms = state.property.rooms.filter((room) => room.capacity >= (state.filters.guests || 1));
    const availableRooms = [];

    for (const room of eligibleRooms) {
      const month = state.filters.checkIn.slice(0, 7);
      const { calendar } = await api(`/api/rooms/${room.id}/calendar?month=${month}`);
      const dayMap = new Map(calendar.map((day) => [day.day, day]));
      let isAvailable = true;
      let totalPrice = 0;

      const start = new Date(`${state.filters.checkIn}T12:00:00`);
      const end = new Date(`${state.filters.checkOut}T12:00:00`);
      for (let cursor = new Date(start); cursor < end; cursor.setDate(cursor.getDate() + 1)) {
        const isoDay = cursor.toISOString().slice(0, 10);
        const day = dayMap.get(isoDay);
        if (!day || !day.available) {
          isAvailable = false;
          break;
        }
        totalPrice += Number(day.price || room.base_price || 0);
      }

      if (isAvailable) {
        availableRooms.push({
          ...room,
          nights: nightsBetween(state.filters.checkIn, state.filters.checkOut),
          total_price: totalPrice
        });
      }
    }

    return availableRooms.sort((a, b) => a.total_price - b.total_price || a.base_price - b.base_price);
  }
}

function updateHeroPeriodDisplay() {
  if (state.filters.checkIn && state.filters.checkOut && nightsBetween(state.filters.checkIn, state.filters.checkOut) > 0) {
    refs.heroSelectedPeriod.textContent = `${toLongDate(state.filters.checkIn)} → ${toLongDate(state.filters.checkOut)}`;
    return;
  }
  if (state.filters.checkIn) {
    refs.heroSelectedPeriod.textContent = `${toLongDate(state.filters.checkIn)} · scegli il check-out`;
    return;
  }
  refs.heroSelectedPeriod.textContent = 'Scegli dal calendario qui sotto';
}

function setHeroCalendarOpen(isOpen) {
  refs.heroCalendarShell.classList.toggle('is-hidden', !isOpen);
  refs.heroPeriodTrigger.classList.toggle('is-active', isOpen);
}

function updateBookingSummary() {
  if (!state.selectedRoom || !state.property) return;
  const checkIn = state.bookingDraft?.checkIn || '';
  const checkOut = state.bookingDraft?.checkOut || '';
  const guests = Number(state.bookingDraft?.guests || state.filters.guests || 1);
  if (!checkIn || !checkOut || nightsBetween(checkIn, checkOut) <= 0) {
    refs.bookingTotalValue.textContent = 'Seleziona il periodo';
    refs.bookingSummary.innerHTML = `
      <strong>${state.property.name}</strong>
      <p>${state.selectedRoom.name}</p>
      <p>Seleziona check-in e check-out per vedere il riepilogo.</p>
    `;
    return;
  }
  const nights = nightsBetween(checkIn, checkOut);
  const totalPrice = state.selectedRoom.base_price * nights;
  state.bookingDraft = { ...state.bookingDraft, room: state.selectedRoom, checkIn, checkOut, nights, totalPrice, guests };
  refs.bookingTotalValue.textContent = `${formatMoney(totalPrice)} · ${nights} notti`;
  refs.bookingSummary.innerHTML = `
    <strong>${state.property.name}</strong>
    <p>${state.selectedRoom.name}</p>
    <p>${toLongDate(checkIn)} → ${toLongDate(checkOut)}</p>
    <p>${nights} notti · ${guests} ospiti</p>
    <p><strong>Totale stimato da ${formatMoney(totalPrice)}</strong></p>
  `;
}

function renderBookingRoomResult(room, mode = 'search') {
  const nights = state.bookingDraft?.checkIn && state.bookingDraft?.checkOut
    ? nightsBetween(state.bookingDraft.checkIn, state.bookingDraft.checkOut)
    : 0;
  const totalPrice = room.total_price || (nights > 0 ? room.base_price * nights : room.base_price);
  refs.bookingRoomResult.innerHTML = `
    <article class="booking-room-card">
      <div class="booking-room-visual" style="background-image: linear-gradient(180deg, rgba(31, 21, 13, 0.08), rgba(31, 21, 13, 0.24)), url('${room.image_url}')"></div>
      <div class="booking-room-copy">
        <p class="eyebrow warm">${mode === 'search' ? 'Disponibile' : 'Camera scelta'}</p>
        <h3>${room.name}</h3>
        <p>${room.description}</p>
        <div class="booking-room-meta">
          <span class="meta-chip">${room.capacity} ospiti max</span>
          <span class="meta-chip">${formatMoney(room.base_price)} / notte</span>
          ${nights > 0 ? `<span class="meta-chip strong">${nights} notti · ${formatMoney(totalPrice)}</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

function renderBookingCalendar() {
  refs.bookingMonthLabel.textContent = monthLabel(state.bookingMonth);
  syncCalendarNavState();
  const [year, month] = state.bookingMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const visibleStartDate = state.bookingMonth === currentMonthIso()
    ? new Date(`${todayIso()}T12:00:00`)
    : firstDay;
  const leadingBlanks = (visibleStartDate.getDay() + 6) % 7;
  const checkIn = state.bookingDraft?.checkIn || '';
  const checkOut = state.bookingDraft?.checkOut || '';
  const weekdayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const cells = [];

  weekdayLabels.forEach((label) => {
    cells.push(`<div class="calendar-weekday">${label}</div>`);
  });

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
  }

  state.bookingCalendar.forEach((day) => {
    if (state.bookingMonth === currentMonthIso() && isPastDay(day.day)) return;
    const blocked = !day.available || isPastDay(day);
    const selected = checkIn === day.day || checkOut === day.day;
    const inRange = checkIn && checkOut && day.day > checkIn && day.day < checkOut;
    return cells.push(`
      <button class="calendar-day${blocked ? ' is-unavailable' : ''}${selected ? ' is-selected' : ''}${inRange ? ' is-range' : ''}" type="button" data-booking-day="${day.day}" ${blocked ? 'disabled' : ''}>
        <strong>${new Date(`${day.day}T12:00:00`).getDate()}</strong>
        ${blocked
          ? '<span class="calendar-x" aria-hidden="true">×</span>'
          : `<span class="calendar-price">${formatMoney(day.price)}</span>`}
      </button>
    `);
  });

  refs.bookingCalendarGrid.innerHTML = cells.join('');
  refs.bookingCalendarGrid.querySelectorAll('[data-booking-day]').forEach((button) => {
    button.addEventListener('click', () => {
      const day = button.dataset.bookingDay;
      if (!state.bookingDraft?.checkIn || (state.bookingDraft?.checkIn && state.bookingDraft?.checkOut)) {
        state.bookingDraft = { ...state.bookingDraft, checkIn: day, checkOut: '', guests: state.filters.guests };
      } else if (day > state.bookingDraft.checkIn) {
        state.bookingDraft = { ...state.bookingDraft, checkOut: day, guests: state.filters.guests };
      } else {
        state.bookingDraft = { ...state.bookingDraft, checkIn: day, checkOut: '', guests: state.filters.guests };
      }
      updateBookingSummary();
      renderBookingCalendar();
    });
  });
}

function renderHeroCalendar() {
  refs.heroMonthLabel.textContent = monthLabel(state.heroMonth);
  syncCalendarNavState();
  const [year, month] = state.heroMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const visibleStartDate = state.heroMonth === currentMonthIso()
    ? new Date(`${todayIso()}T12:00:00`)
    : firstDay;
  const leadingBlanks = (visibleStartDate.getDay() + 6) % 7;
  const weekdayLabels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const cells = [];

  weekdayLabels.forEach((label) => {
    cells.push(`<div class="calendar-weekday">${label}</div>`);
  });

  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push('<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>');
  }

  state.heroCalendar.forEach((day) => {
    if (state.heroMonth === currentMonthIso() && isPastDay(day.day)) return;
    const blocked = !day.available || isPastDay(day);
    const selected = state.filters.checkIn === day.day || state.filters.checkOut === day.day;
    const inRange = state.filters.checkIn && state.filters.checkOut && day.day > state.filters.checkIn && day.day < state.filters.checkOut;
    cells.push(`
      <button class="calendar-day${blocked ? ' is-unavailable' : ''}${selected ? ' is-selected' : ''}${inRange ? ' is-range' : ''}" type="button" data-hero-day="${day.day}" ${blocked ? 'disabled' : ''}>
        <strong>${new Date(`${day.day}T12:00:00`).getDate()}</strong>
        ${blocked
          ? '<span class="calendar-x" aria-hidden="true">×</span>'
          : `<span class="calendar-price">${formatMoney(day.price)}</span>`}
      </button>
    `);
  });

  refs.heroCalendarGrid.innerHTML = cells.join('');
  refs.heroCalendarGrid.querySelectorAll('[data-hero-day]').forEach((button) => {
    button.addEventListener('click', () => {
      const day = button.dataset.heroDay;
      if (!state.filters.checkIn || (state.filters.checkIn && state.filters.checkOut)) {
        state.filters.checkIn = day;
        state.filters.checkOut = '';
      } else if (day > state.filters.checkIn) {
        state.filters.checkOut = day;
        setHeroCalendarOpen(false);
      } else {
        state.filters.checkIn = day;
        state.filters.checkOut = '';
      }
      updateHeroPeriodDisplay();
      renderHeroCalendar();
    });
  });
}

async function loadHeroCalendar() {
  refs.heroCalendarStatus.textContent = 'Carico disponibilità...';
  refs.heroCalendarStatus.className = 'hero-calendar-status';
  try {
    state.heroCalendar = await fetchPropertyCalendar();
    refs.heroCalendarStatus.textContent = 'Seleziona check-in e check-out dal calendario.';
    refs.heroCalendarStatus.className = 'hero-calendar-status is-ready';
    renderHeroCalendar();
  } catch (error) {
    refs.heroCalendarStatus.textContent = error.message;
    refs.heroCalendarStatus.className = 'hero-calendar-status is-error';
    refs.heroCalendarGrid.innerHTML = '';
  }
}

async function loadBookingMonth() {
  if (!state.selectedRoom) return;
  refs.bookingCalendarStatus.textContent = 'Carico calendario...';
  refs.bookingCalendarStatus.className = 'status-copy';
  try {
    state.bookingCalendar = await fetchRoomCalendar(state.selectedRoom.id);
    refs.bookingCalendarStatus.textContent = 'Seleziona check-in e check-out direttamente dal calendario.';
    refs.bookingCalendarStatus.className = 'status-copy is-success';
    renderBookingCalendar();
  } catch (error) {
    refs.bookingCalendarStatus.textContent = error.message;
    refs.bookingCalendarStatus.className = 'status-copy is-error';
    refs.bookingCalendarGrid.innerHTML = '';
  }
}

function renderRooms(rooms) {
  refs.roomsGrid.innerHTML = '';
  if (!rooms.length) {
    refs.roomsGrid.innerHTML = '<p class="status-copy">Nessuna camera disponibile.</p>';
    return;
  }

  for (const room of rooms) {
    const card = refs.roomCardTemplate.content.firstElementChild.cloneNode(true);
    card.querySelector('.room-visual').style.backgroundImage = `linear-gradient(180deg, rgba(206,111,56,0.10), rgba(55,79,46,0.36)), url('${room.image_url}')`;
    card.querySelector('h3').textContent = room.name;
    card.querySelector('.room-copy').textContent = room.description;
    card.querySelector('.room-price').textContent = `${formatMoney(room.base_price)} / notte`;
    card.querySelector('.room-meta').innerHTML = `
      <span class="meta-chip">${room.capacity} ospiti max</span>
      <span class="meta-chip">Tariffa dinamica nel calendario</span>
    `;
    card.querySelector('.room-amenities').innerHTML = room.amenities.map((item) => `<span class="amenity-pill">${item}</span>`).join('');
    card.querySelector('.room-open-gallery').addEventListener('click', () => openRoomGallery(room));
    const bookingButton = card.querySelector('.room-open-booking');
    bookingButton.addEventListener('click', () => openBookingDialog(room));
    refs.roomsGrid.appendChild(card);
  }
}

async function openBookingDialog(room) {
  state.selectedRoom = room;
  state.bookingMonth = state.filters.checkIn ? state.filters.checkIn.slice(0, 7) : monthValue(new Date());
  state.bookingDraft = {
    room,
    checkIn: state.filters.checkIn || '',
    checkOut: state.filters.checkOut || '',
    guests: state.filters.guests || 2
  };
  refs.bookingFormStatus.textContent = '';
  refs.bookingFormStatus.className = 'status-copy';
  refs.bookingFlow.classList.add('is-hidden');
  refs.bookingActivate.hidden = false;
  refs.bookingActivate.textContent = 'Prenota questa camera';
  renderBookingRoomResult(room, 'direct');
  updateBookingSummary();
  refs.bookingDialog.showModal();
}

async function startBookingFlow() {
  if (!state.selectedRoom) return;
  refs.bookingFlow.classList.remove('is-hidden');
  refs.bookingActivate.hidden = true;
  updateBookingSummary();
  await loadBookingMonth();
}

async function handleAvailabilitySearch() {
  if (!state.filters.checkIn || !state.filters.checkOut || !state.filters.guests) {
    setStatus('Inserisci check-in, check-out e ospiti per continuare.', 'error');
    return false;
  }
  const rooms = await fetchAvailableRooms();
  if (!rooms.length) {
    setStatus('Nessuna camera disponibile per questo periodo.', 'error');
    return false;
  }

  const room = rooms[0];
  state.selectedRoom = room;
  state.bookingMonth = state.filters.checkIn.slice(0, 7);
  state.bookingDraft = {
    room,
    checkIn: state.filters.checkIn,
    checkOut: state.filters.checkOut,
    guests: state.filters.guests
  };
  refs.bookingForm.reset();
  refs.bookingFormStatus.textContent = '';
  refs.bookingFormStatus.className = 'status-copy';
  refs.bookingFlow.classList.add('is-hidden');
  refs.bookingActivate.hidden = false;
  refs.bookingActivate.textContent = 'Prenota questa camera';
  renderBookingRoomResult(room, 'search');
  updateBookingSummary();
  refs.bookingDialog.showModal();
  refs.bookingFlow.classList.remove('is-hidden');
  refs.bookingActivate.hidden = true;
  await loadBookingMonth();
  return true;
}

async function submitBooking(event) {
  event.preventDefault();
  if (!state.selectedRoom || !state.property) return;
  const data = new FormData(refs.bookingForm);
  const checkIn = state.bookingDraft?.checkIn || '';
  const checkOut = state.bookingDraft?.checkOut || '';
  const guests = Number(state.bookingDraft?.guests || state.filters.guests || 1);
  if (!checkIn || !checkOut || nightsBetween(checkIn, checkOut) <= 0) {
    refs.bookingFormStatus.textContent = 'Seleziona un periodo valido prima di confermare.';
    refs.bookingFormStatus.className = 'status-copy is-error';
    return;
  }
  const nights = nightsBetween(checkIn, checkOut);
  refs.bookingFormStatus.textContent = 'Invio prenotazione...';
  refs.bookingFormStatus.className = 'status-copy';
  try {
    const { booking } = await api('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        property_id: state.property.id,
        room_id: state.selectedRoom.id,
        check_in: checkIn,
        check_out: checkOut,
        guest_count: guests,
        customer_name: `${data.get('customer_name') || ''}`.trim(),
        customer_email: `${data.get('customer_email') || ''}`.trim(),
        customer_phone: `${data.get('customer_phone') || ''}`.trim(),
        customer_notes: `${data.get('customer_notes') || ''}`.trim()
      })
    });
    refs.bookingFormStatus.textContent = `Prenotazione confermata: ${booking.room_name}`;
    refs.bookingFormStatus.className = 'status-copy is-success';
    refs.bookingForm.reset();
    state.bookingDraft = null;
    await loadFeaturedProperty();
  } catch (error) {
    refs.bookingFormStatus.textContent = error.message;
    refs.bookingFormStatus.className = 'status-copy is-error';
  }
}

function submitContactForm(event) {
  event.preventDefault();
  const data = new FormData(refs.contactForm);
  const name = `${data.get('name') || ''}`.trim();
  const email = `${data.get('email') || ''}`.trim();
  const message = `${data.get('message') || ''}`.trim();

  if (!name || !email || !message) {
    refs.contactFormStatus.textContent = 'Compila nome, email e messaggio per inviare la richiesta.';
    refs.contactFormStatus.className = 'status-copy is-error';
    return;
  }

  refs.contactFormStatus.textContent = 'Richiesta inviata. Ti contatteremo al più presto.';
  refs.contactFormStatus.className = 'status-copy is-success';
  refs.contactForm.reset();
}

async function loadFeaturedProperty() {
  const { property } = await api(`/api/properties/${FEATURED_SLUG}`);
  state.property = property;
  renderProperty(property);
}

async function handleSearch(event) {
  event.preventDefault();
  try {
    const data = new FormData(refs.searchForm);
    state.filters.guests = Number(data.get('guests') || 1);
    await loadHeroCalendar();
    if (!state.property) return;
    if (!state.filters.checkIn || !state.filters.checkOut || nightsBetween(state.filters.checkIn, state.filters.checkOut) <= 0) {
      setStatus('Seleziona il periodo dal calendario prima di continuare.', 'error');
      return;
    }
    renderRooms(state.property.rooms.filter((room) => room.capacity >= state.filters.guests));
    const opened = await handleAvailabilitySearch();
    if (opened) {
      setStatus('Camera disponibile trovata. Puoi completare la prenotazione nel popup.', 'success');
    }
  } catch (error) {
    setStatus(error.message || 'Non sono riuscito a verificare la disponibilità.', 'error');
  }
}

function bindEvents() {
  refs.searchForm.addEventListener('submit', handleSearch);
  refs.heroPeriodTrigger.addEventListener('click', async () => {
    const willOpen = refs.heroCalendarShell.classList.contains('is-hidden');
    setHeroCalendarOpen(willOpen);
    if (willOpen && !state.heroCalendar.length) {
      await loadHeroCalendar();
    }
  });
  refs.heroPrevMonth.addEventListener('click', async () => {
    if (shiftMonth(state.heroMonth, -1) < currentMonthIso()) return;
    state.heroMonth = shiftMonth(state.heroMonth, -1);
    await loadHeroCalendar();
  });
  refs.heroNextMonth.addEventListener('click', async () => {
    state.heroMonth = shiftMonth(state.heroMonth, 1);
    await loadHeroCalendar();
  });
  refs.bookingActivate.addEventListener('click', startBookingFlow);
  refs.bookingPrevMonth.addEventListener('click', async () => {
    if (shiftMonth(state.bookingMonth, -1) < currentMonthIso()) return;
    state.bookingMonth = shiftMonth(state.bookingMonth, -1);
    await loadBookingMonth();
  });
  refs.bookingNextMonth.addEventListener('click', async () => {
    state.bookingMonth = shiftMonth(state.bookingMonth, 1);
    await loadBookingMonth();
  });
  refs.closeBookingDialog.addEventListener('click', () => refs.bookingDialog.close());
  refs.bookingDialog.addEventListener('click', (event) => {
    const rect = refs.bookingDialog.getBoundingClientRect();
    const inside = rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width;
    if (!inside) refs.bookingDialog.close();
  });
  refs.bookingForm.addEventListener('submit', submitBooking);
  refs.contactForm.addEventListener('submit', submitContactForm);
  refs.closeRoomGalleryDialog.addEventListener('click', () => refs.roomGalleryDialog.close());
  refs.roomGalleryDialog.addEventListener('click', (event) => {
    const rect = refs.roomGalleryDialog.getBoundingClientRect();
    const inside = rect.top <= event.clientY && event.clientY <= rect.top + rect.height && rect.left <= event.clientX && event.clientX <= rect.left + rect.width;
    if (!inside) refs.roomGalleryDialog.close();
  });
  refs.cookieAccept?.addEventListener('click', () => setCookieConsent('accepted'));
  refs.cookieReject?.addEventListener('click', () => setCookieConsent('rejected'));
}

function setCookieConsent(value) {
  window.localStorage.setItem(COOKIE_KEY, value);
  refs.cookieBanner?.classList.add('is-hidden');
}

function initCookieBanner() {
  if (!refs.cookieBanner) return;
  const saved = window.localStorage.getItem(COOKIE_KEY);
  refs.cookieBanner.classList.toggle('is-hidden', Boolean(saved));
}

async function bootstrap() {
  const { config } = await api('/api/config');
  state.config = config;
  const today = new Date();
  const checkIn = new Date(today);
  checkIn.setDate(today.getDate() + 5);
  const checkOut = new Date(today);
  checkOut.setDate(today.getDate() + 8);
  state.filters.checkIn = checkIn.toISOString().slice(0, 10);
  state.filters.checkOut = checkOut.toISOString().slice(0, 10);
  state.filters.guests = Number(refs.searchForm.elements.guests.value || 2);
  state.heroMonth = monthValue(checkIn);
  await loadFeaturedProperty();
  startRestaurantVisualRotation();
  updateHeroPeriodDisplay();
  setStatus('Seleziona le date e scegli la camera.', 'success');
}

bindEvents();
initLanguageSwitch();
initCookieBanner();
bootstrap();

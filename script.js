/* ═══════════════════════════════════════════════════════
   Jetski Arcachon — script.js
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── SUPABASE — anon key is safe to expose client-side.
const SUPABASE_URL      = 'https://uwoqubisdlqoqblitzrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3b3F1YmlzZGxxb3FibGl0enJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzI5MjgsImV4cCI6MjA5NDk0ODkyOH0.AxSPUEV_KtLYxBRDs3xOCAHFQVmQBuwQ3J5hXeHclvw';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── CONSTANTS
const MODELS = [
  { name: 'Sea-Doo GTI SE 130', dbName: 'GTI SE 130', level: 'Débutant',      price: '110 €', prices: { 1: '110 €', 2: '195 €', 4: '350 €' } },
  { name: 'Sea-Doo GTX 230',    dbName: 'GTX 230',    level: 'Intermédiaire', price: '125 €', prices: { 1: '125 €', 2: '220 €', 4: '400 €' } },
  { name: 'Sea-Doo RXT-X 300',  dbName: 'RXT-X 300',  level: 'Expert',        price: '140 €', prices: { 1: '140 €', 2: '245 €', 4: '450 €' } },
];

// Must match slot_time values in the DB
const SLOT_TIMES = ['09:00', '11:00', '14:00', '16:00'];

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const $ = id => document.getElementById(id);

// ── STATE
let currentModel     = 0;
let mtIsAnimating    = false;
let calY             = TODAY.getFullYear();
let calM             = TODAY.getMonth();
let availY           = TODAY.getFullYear();
let availM           = TODAY.getMonth();
let selectedDate     = null;
let selectedTime     = null;
let selectedDuration = null;
let selectedJetSki   = null;   // MODELS[n].dbName, or null (avail path before model selection)
let bookingFromAvail = false;  // true when opened from availability calendar

// Supabase-backed availability
let jetSkis   = [];        // {id, name} — active jet skis
let jetSkiIds = [];        // UUID list derived from jetSkis
let blockedSet = new Set(); // "YYYY-MM-DD|HH:MM|jet_ski_id"

// ── SUPABASE — DATA LAYER

async function fetchJetSkis() {
  // Only fetch active + booking-enabled jet skis, ordered by power_hp ASC for stable ordering.
  const { data } = await sb.from('jet_skis').select('id,name,power_hp,booking_enabled')
    .eq('status', 'active')
    .eq('booking_enabled', true)
    .order('power_hp', { ascending: true });
  jetSkis   = data ?? [];
  jetSkiIds = jetSkis.map(r => r.id);
}

// Fetch all blocked slots from today → +1 year (covers the full next season).
// Uses a SECURITY DEFINER RPC that UNIONs:
//   ① availabilities.is_blocked = true  (manual blocks)
//   ② reservations status IN ('confirmed','in_progress')
// Supabase TIME columns arrive as "HH:MM:SS" — slice to 5 for "HH:MM".
async function fetchBlocked() {
  const from = TODAY.toISOString().split('T')[0];
  const to   = new Date(TODAY.getFullYear() + 1, TODAY.getMonth(), TODAY.getDate())
                 .toISOString().split('T')[0];

  const { data } = await sb.rpc('public_blocked_slots', { from_date: from, to_date: to });

  blockedSet = new Set(
    (data ?? []).map(r =>
      `${r.blocked_date}|${String(r.blocked_slot).slice(0, 5)}|${r.blocked_jet_ski_id}`
    )
  );
}

// ── AVAILABILITY HELPERS

// A day is "Complet" only when all jet skis × all 4 slots are blocked.
function isDayFull(dateStr) {
  if (!jetSkiIds.length) return false;
  return SLOT_TIMES.every(slot =>
    jetSkiIds.every(id => blockedSet.has(`${dateStr}|${slot}|${id}`))
  );
}

// A time slot is disabled when all jet skis are booked for that date+slot.
function isSlotFull(dateStr, slot) {
  if (!jetSkiIds.length) return false;
  return jetSkiIds.every(id => blockedSet.has(`${dateStr}|${slot}|${id}`));
}

// ── SUPABASE — REALTIME

function setupRealtime() {
  // Availabilities — all events (manual blocks added/removed by staff)
  sb.channel('site-availabilities')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities' }, onLiveUpdate)
    .subscribe();

  // Reservations — explicit INSERT / UPDATE / DELETE listeners.
  // '*' was not reliably firing for UPDATE; explicit event types are.
  sb.channel('site-reservations')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reservations' },
      () => onLiveUpdate()
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'reservations' },
      () => onLiveUpdate()
    )
    .on('postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'reservations' },
      () => onLiveUpdate()
    )
    .subscribe();
}

async function onLiveUpdate() {
  await fetchBlocked();
  renderAvail();
  if (overlay.classList.contains('open')) {
    buildCal('calGrid', calY, calM, true, selectedDate);
    // Refresh slot buttons whenever blockedSet changes,
    // regardless of which step is currently active.
    // renderTimeSlots() guards against null selectedDate internally.
    if (selectedDate) renderTimeSlots();
  }
}

// ── MODEL TABS
const mtTabs   = document.querySelectorAll('.mt-tab');
const mtSlides = document.querySelectorAll('.mt-slide');

// Wrap tabs in pill container
(function () {
  const container = document.querySelector('.mt-tabs');
  if (!container) return;
  const inner = document.createElement('div');
  inner.className = 'mt-tabs-inner';
  while (container.firstChild) inner.appendChild(container.firstChild);
  container.appendChild(inner);
})();

const mtStage = document.querySelector('.mt-stage');

mtTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const idx = +tab.dataset.idx;
    if (idx === currentModel || mtIsAnimating) return;

    const direction = idx > currentModel ? 1 : -1;
    const oldSlide  = mtSlides[currentModel];
    const newSlide  = mtSlides[idx];

    mtIsAnimating = true;
    currentModel  = idx;

    // Snap active tab
    mtTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Lock stage height so it doesn't collapse while children are absolute
    mtStage.style.height = mtStage.offsetHeight + 'px';

    // Old slide: keep its current position, will slide out
    oldSlide.classList.add('is-leaving');
    oldSlide.classList.remove('active');
    oldSlide.style.transform = 'translateX(0)';

    // New slide: position off-screen on the entry side
    newSlide.classList.add('is-entering');
    newSlide.style.transform = `translateX(${direction * 100}%)`;

    // Force reflow so initial transforms register before transitions start
    newSlide.getBoundingClientRect(); // eslint-disable-line no-unused-expressions

    const easing = '380ms cubic-bezier(0.32, 0, 0.18, 1)';
    oldSlide.style.transition = `transform ${easing}`;
    oldSlide.style.transform  = `translateX(${-direction * 100}%)`;
    newSlide.style.transition = `transform ${easing}`;
    newSlide.style.transform  = 'translateX(0)';

    newSlide.addEventListener('transitionend', function cleanup(e) {
      if (e.propertyName !== 'transform') return;
      newSlide.removeEventListener('transitionend', cleanup);

      // Promote new slide to normal flow
      newSlide.classList.remove('is-entering');
      newSlide.classList.add('active');
      newSlide.style.transform  = '';
      newSlide.style.transition = '';

      // Remove leaving helpers from old slide
      oldSlide.classList.remove('is-leaving');
      oldSlide.style.transform  = '';
      oldSlide.style.transition = '';

      // Restore stage to auto height
      mtStage.style.height = '';
      mtIsAnimating = false;
    });
  });
});

// ── MODEL STAGE — Mac trackpad two-finger swipe
(function () {
  if (!mtStage) return;
  let wheelCooling = false;
  mtStage.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (wheelCooling || mtIsAnimating) return;
    wheelCooling = true;
    setTimeout(() => { wheelCooling = false; }, 500);
    const dir    = e.deltaX > 40 ? 1 : e.deltaX < -40 ? -1 : 0;
    if (dir === 0) return;
    const newIdx = Math.max(0, Math.min(mtTabs.length - 1, currentModel + dir));
    if (newIdx !== currentModel) mtTabs[newIdx].click();
  }, { passive: false });
})();

// ── RESERVE BUTTONS (model CTA)
document.querySelectorAll('.btn-reserve').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = +(btn.dataset.model ?? currentModel);
    openModal(idx);
  });
});

// ── CALENDAR BUILDER
function buildCal(gridId, year, month, interactive, selDate, onDateClick) {
  const grid = $(gridId);
  if (!grid) return;
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const off   = first === 0 ? 6 : first - 1;

  let html = DAY_NAMES.map(n => `<div class="cal-dn">${n}</div>`).join('');
  for (let i = 0; i < off; i++) html += `<div class="cal-d cal-d--empty"></div>`;

  for (let d = 1; d <= days; d++) {
    const date    = new Date(year, month, d);
    date.setHours(0, 0, 0, 0);
    const isPast  = date < TODAY;
    const isToday = date.getTime() === TODAY.getTime();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isFull  = !isPast && isDayFull(dateStr);
    const isSel   = interactive && selDate === dateStr;

    let cls = 'cal-d';
    if (isSel)        cls += ' cal-d--sel';
    else if (isToday) cls += ' cal-d--today';
    else if (isPast)  cls += ' cal-d--off';
    else if (isFull)  cls += ' cal-d--booked';

    const clickable = interactive && !isPast && !isFull;
    const data = clickable ? `data-date="${dateStr}"` : '';
    html += `<div class="${cls}" ${data}>${d}</div>`;
  }

  grid.innerHTML = html;

  if (interactive) {
    grid.querySelectorAll('.cal-d[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        if (onDateClick) {
          onDateClick(el.dataset.date);
          return;
        }
        // Default: modal-calendar behavior
        selectedDate = el.dataset.date;
        buildCal(gridId, year, month, true, selectedDate);
        $('toStep2').disabled = false;
        // Reset time + duration whenever the date changes
        selectedTime     = null;
        selectedDuration = null;
        document.querySelectorAll('.tslot').forEach(t => t.classList.remove('sel'));
        document.querySelectorAll('.dslot').forEach(b => b.classList.remove('sel'));
        $('toStep3').disabled = true;
      });
    });
  }
}

// ── TIME SLOTS (step 2)
function renderTimeSlots() {
  if (!selectedDate) return; // nothing to render without a date

  // Match by name (not index) so that booking_enabled=false models absent from jetSkis[]
  // are correctly detected as unavailable rather than silently mapping to the wrong jet ski.
  const jetSki     = jetSkis.find(j => j.name === selectedJetSki);
  const selectedId = jetSki?.id ?? null;

  // Model selected but missing from jetSkis[] → booking_enabled=false (or deactivated).
  // Disable every slot so the user can't book it.
  const modelUnavailable = !!selectedJetSki && !jetSki;

  document.querySelectorAll('.tslot').forEach(btn => {
    const slot = btn.dataset.t;
    let full = modelUnavailable;
    if (!full) {
      // Per-jet-ski check when we know the exact model; all-skis fallback otherwise.
      full = selectedId
        ? blockedSet.has(`${selectedDate}|${slot}|${selectedId}`)
        : isSlotFull(selectedDate, slot);
    }
    btn.disabled = full;
    btn.classList.toggle('tslot--disabled', full);
    // If the currently-selected slot just became unavailable, deselect it
    if (full && selectedTime === slot) {
      selectedTime = null;
      btn.classList.remove('sel');
      updateStep3Btn();
    }
  });
}

document.querySelectorAll('.tslot').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    selectedTime = btn.dataset.t;
    document.querySelectorAll('.tslot').forEach(t => t.classList.remove('sel'));
    btn.classList.add('sel');
    updateStep3Btn();
  });
});

// ── DURATION BUTTONS (step 2)
document.querySelectorAll('.dslot').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedDuration = +btn.dataset.d;
    document.querySelectorAll('.dslot').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    updateStep3Btn();
    updateDurPrice();
  });
});

// "Continuer →" only unlocks when BOTH a slot AND a duration are selected
function updateStep3Btn() {
  $('toStep3').disabled = !(selectedTime && selectedDuration);
}

// Show the price for the selected model + duration below the duration grid
function updateDurPrice() {
  const el = $('durPrice');
  if (!el) return;
  const m = MODELS.find(x => x.dbName === selectedJetSki);
  if (!m || !selectedDuration) { el.textContent = ''; return; }
  const durLabel = selectedDuration === 4 ? 'Demi-journée' : `${selectedDuration}h`;
  el.textContent = `${m.prices[selectedDuration]} · ${durLabel}`;
}

// ── STEP NAVIGATION
const overlay = $('overlay');

// All step IDs in document order
const ALL_STEP_IDS = ['step1', 'step2', 'step_model', 'step3', 'step4'];

// Progress bar order (step4 is outside the bar — all items go "done" / none "active")
const STEP_ORDER = ['step1', 'step_model', 'step2', 'step3'];
const PS_MAP     = { step1: 'ps1', step2: 'ps2', step_model: 'ps_model', step3: 'ps3' };

function goStep(stepId) {
  ALL_STEP_IDS.forEach(id => {
    const el = $(id);
    if (el) el.classList.toggle('active', id === stepId);
  });
  updateProgressBar(stepId);
}

function updateProgressBar(stepId) {
  const currentIdx = STEP_ORDER.indexOf(stepId);
  STEP_ORDER.forEach((id, i) => {
    const el = $(PS_MAP[id]);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i === currentIdx)      el.classList.add('active');
    else if (i < currentIdx)   el.classList.add('done');
  });
}

function updateCalTitle() {
  const el = $('calTitle');
  if (el) el.textContent = `${MONTHS_FR[calM]} ${calY}`;
}

// ── OPEN MODAL — model CTA path
function openModal(idx) {
  bookingFromAvail = false;
  selectedJetSki   = MODELS[idx].dbName;

  $('modalModelName').textContent = MODELS[idx].name;
  document.getElementById('modal').classList.remove('modal--avail');

  calY = TODAY.getFullYear();
  calM = TODAY.getMonth();
  selectedDate     = null;
  selectedTime     = null;
  selectedDuration = null;
  $('toStep2').disabled = true;
  $('toStep3').disabled = true;

  document.querySelectorAll('.tslot').forEach(t => {
    t.classList.remove('sel', 'tslot--disabled');
    t.disabled = false;
  });
  document.querySelectorAll('.dslot').forEach(b => b.classList.remove('sel'));
  $('durPrice').textContent = '';

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  goStep('step1');
  updateCalTitle();
  buildCal('calGrid', calY, calM, true, null);
}

// ── OPEN MODAL — avail calendar path
function openModalFromAvail(dateStr) {
  bookingFromAvail = true;
  selectedJetSki   = null;
  selectedDate     = dateStr;

  $('modalModelName').textContent = 'Tous modèles';
  document.getElementById('modal').classList.add('modal--avail');

  selectedTime     = null;
  selectedDuration = null;
  $('toStep3').disabled = true;
  $('durPrice').textContent = '';

  document.querySelectorAll('.tslot').forEach(t => {
    t.classList.remove('sel', 'tslot--disabled');
    t.disabled = false;
  });
  document.querySelectorAll('.dslot').forEach(b => b.classList.remove('sel'));
  document.querySelectorAll('.mslot').forEach(s => s.classList.remove('sel'));
  $('toStep3FromModel').disabled = true;

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  goStep('step_model');
}

function closeModal() {
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  document.getElementById('modal').classList.remove('modal--avail');
  bookingFromAvail = false;
}

// ── MODAL — EVENT LISTENERS
$('modalClose').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('calPrev').addEventListener('click', () => {
  calM--; if (calM < 0) { calM = 11; calY--; }
  // In the non-avail path, navigating clears the date selection.
  // In the avail path, the pre-selected date stays (may be in a different month — that's fine).
  if (!bookingFromAvail) { selectedDate = null; $('toStep2').disabled = true; }
  updateCalTitle(); buildCal('calGrid', calY, calM, true, selectedDate);
});

$('calNext').addEventListener('click', () => {
  calM++; if (calM > 11) { calM = 0; calY++; }
  if (!bookingFromAvail) { selectedDate = null; $('toStep2').disabled = true; }
  updateCalTitle(); buildCal('calGrid', calY, calM, true, selectedDate);
});

// Step 1 → Step 2 (CTA path only)
$('toStep2').addEventListener('click', () => {
  if (!selectedDate) return;
  const d = new Date(selectedDate + 'T12:00:00');
  $('step2Date').textContent = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, c => c.toUpperCase());
  goStep('step2');
  renderTimeSlots();
  updateDurPrice();
});

// Step 2 → Step 3 (both paths — model is already known by now)
$('toStep3').addEventListener('click', () => {
  buildRecap();
  goStep('step3');
});

// ── MODEL SELECTOR (step_model — avail path only)
document.querySelectorAll('.mslot').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = +btn.dataset.modelIdx;
    selectedJetSki = MODELS[idx].dbName;
    document.querySelectorAll('.mslot').forEach(b => b.classList.remove('sel'));
    btn.classList.add('sel');
    $('toStep3FromModel').disabled = false;
  });
});

// Step_model → Step 2 (avail path: model chosen, now pick a slot)
$('toStep3FromModel').addEventListener('click', () => {
  if (!selectedJetSki) return;
  const d = new Date(selectedDate + 'T12:00:00');
  $('step2Date').textContent = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, c => c.toUpperCase());
  goStep('step2');
  renderTimeSlots();
  updateDurPrice();
});

// ── BACK BUTTONS
// Step 2 → Step 1 (CTA) or Step_model (avail)
$('back1').addEventListener('click', () => {
  if (bookingFromAvail) {
    goStep('step_model');
  } else {
    goStep('step1');
  }
});

// Step 3 → Step 2 (both paths)
$('back2').addEventListener('click', () => {
  goStep('step2');
  renderTimeSlots();
  updateDurPrice();
});

// Step_model → close modal (back to avail calendar section)
$('back_model').addEventListener('click', () => {
  closeModal();
});

// ── RECAP
function buildRecap() {
  const d   = new Date(selectedDate + 'T12:00:00');
  const ds  = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dur = selectedDuration === 4 ? 'Demi-journée (4h)' : `${selectedDuration}h`;
  const m   = MODELS.find(x => x.dbName === selectedJetSki);
  const modelLabel = m ? `${m.name} — ${m.price}/h` : 'Au choix';
  $('recap').innerHTML =
    `<strong>${modelLabel}</strong><br>${ds} à ${selectedTime} · ${dur}`;
}

// ── FORM SUBMISSION
$('submitBtn').addEventListener('click', async function () {
  const rawName = $('fName').value.trim();
  const email   = $('fEmail').value.trim();
  const phone   = $('fPhone').value.trim();
  const msg     = $('fMsg').value.trim();

  // Inline validation
  [$('fName'), $('fEmail')].forEach(f => {
    f.style.borderColor = f.value.trim() ? '' : '#FF3B30';
  });
  if (!rawName || !email) return;

  this.disabled    = true;
  this.textContent = 'Envoi…';
  document.querySelector('.submit-err')?.remove();

  try {
    // Split "Prénom Nom" → first_name + last_name
    // If only one word, use it for both (edge case)
    const parts     = rawName.split(/\s+/);
    const firstName = parts[0];
    const lastName  = parts.slice(1).join(' ') || parts[0];

    // Upsert client via SECURITY DEFINER RPC.
    // A plain .upsert() would fail for returning clients because anon has
    // no UPDATE policy. The RPC handles the conflict server-side and returns
    // only the UUID — no client data is exposed.
    const { data: clientId, error: rpcErr } = await sb.rpc('public_upsert_client', {
      p_first_name: firstName,
      p_last_name:  lastName,
      p_email:      email,
      p_phone:      phone || null,
    });

    if (rpcErr || !clientId) throw new Error(rpcErr?.message ?? 'Erreur lors de la création du client');

    // Insert pending reservation.
    // requested_jet_ski: the model the user selected (or null for staff to assign freely).
    // jet_ski_id stays null — staff assigns the physical unit in the CRM.
    const reservationPayload = {
      client_id:         clientId,
      jet_ski_id:        null,
      date:              selectedDate,
      slot_time:         selectedTime,
      duration_hours:    selectedDuration,
      nb_persons:        1,
      source:            'online',
      status:            'pending',
      license_verified:  'not_verified',
      client_message:    msg || null,
      requested_jet_ski: selectedJetSki,
    };
    const { error: resErr } = await sb.from('reservations').insert(reservationPayload);

    if (resErr) throw new Error(resErr.message);

    goStep('step4');

  } catch (err) {
    console.error('[booking]', err);
    this.disabled    = false;
    this.textContent = 'Envoyer ma demande';
    const errEl = document.createElement('p');
    errEl.className  = 'submit-err';
    errEl.style.cssText = 'color:#FF3B30;font-size:0.78rem;text-align:center;margin-top:-4px';
    errEl.textContent = 'Une erreur est survenue. Veuillez réessayer ou nous appeler.';
    this.insertAdjacentElement('afterend', errEl);
    setTimeout(() => errEl.remove(), 5000);
  }
});

$('doneBtn').addEventListener('click', () => {
  closeModal();
  ['fName', 'fPhone', 'fEmail', 'fMsg'].forEach(id => { $(id).value = ''; });
  [$('fName'), $('fEmail')].forEach(f => { f.style.borderColor = ''; });
  const sb_ = $('submitBtn');
  sb_.disabled    = false;
  sb_.textContent = 'Envoyer ma demande';
  document.querySelector('.submit-err')?.remove();
});

// ── AVAILABILITY CALENDAR (section)
function updateAvailTitle() {
  const el = $('availTitle');
  if (el) el.textContent = `${MONTHS_FR[availM]} ${availY}`;
}

function renderAvail() {
  updateAvailTitle();
  buildCal('availGrid', availY, availM, true, null, openModalFromAvail);
}

$('availPrev').addEventListener('click', () => {
  availM--; if (availM < 0) { availM = 11; availY--; }
  renderAvail();
});

$('availNext').addEventListener('click', () => {
  availM++; if (availM > 11) { availM = 0; availY++; }
  renderAvail();
});

// ── BURGER / MOBILE MENU
const burger  = $('burger');
const mobMenu = $('mobMenu');
let menuOpen  = false;

burger.addEventListener('click', () => {
  menuOpen = !menuOpen;
  mobMenu.classList.toggle('open', menuOpen);
  mobMenu.style.display = menuOpen ? 'flex' : 'none';
  const spans = burger.querySelectorAll('span');
  spans[0].style.transform = menuOpen ? 'rotate(45deg) translate(4.5px, 4.5px)'  : '';
  spans[1].style.transform = menuOpen ? 'rotate(-45deg) translate(4.5px, -4.5px)' : '';
});

mobMenu.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    menuOpen = false;
    mobMenu.classList.remove('open');
    mobMenu.style.display = 'none';
    burger.querySelectorAll('span').forEach(s => s.style.transform = '');
  });
});

// ── SMOOTH SCROLL
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const tgt = document.querySelector(a.getAttribute('href'));
    if (!tgt) return;
    e.preventDefault();
    const top = tgt.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// ── INIT
mobMenu.style.display = 'none';

async function init() {
  try {
    await fetchJetSkis();
    await fetchBlocked();
  } catch (e) {
    // If Supabase is unreachable, render calendars with no blocks
    // rather than crashing the page. Realtime will recover when possible.
    console.warn('[init] Supabase unavailable, calendars will show no blocks', e);
  }
  renderAvail();
  setupRealtime();
}

init();

// ── STAGGER RAF — timestamp-based, 160Hz-safe
function staggerRAF(elements, msPerStep, onReveal) {
  if (!elements.length) return;
  const start = performance.now();
  let lastIdx = -1;
  function step(now) {
    const idx = Math.min(
      Math.floor((now - start) / msPerStep),
      elements.length - 1
    );
    for (let i = lastIdx + 1; i <= idx; i++) {
      onReveal(elements[i], i);
    }
    lastIdx = idx;
    if (lastIdx < elements.length - 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

// ── SCROLL REVEAL — Intersection Observer
(function () {
  // Nav glass on scroll
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  }, { passive: true });

  // Generic .reveal elements
  const revealEls = document.querySelectorAll('.reveal');
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => revealObs.observe(el));

  // Staggered inc-cards — RAF-based stagger for 160Hz smoothness
  const incCards = Array.from(document.querySelectorAll('.inc-card'));
  let incRevealPending = false;
  const incObs = new IntersectionObserver((entries) => {
    if (incRevealPending) return;
    if (entries.some(e => e.isIntersecting)) {
      incRevealPending = true;
      staggerRAF(incCards, 120, el => el.classList.add('visible'));
      incObs.disconnect();
    }
  }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });
  incCards.forEach(el => incObs.observe(el));

  // Location section
  const locInfo = document.querySelector('.loc-info');
  const locMap  = document.querySelector('.loc-map');
  if (locInfo && locMap) {
    const locObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          locObs.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    locObs.observe(locInfo);
    locObs.observe(locMap);
  }

  // Models section — entrance animation (active slide only, once)
  const modelsSection = document.querySelector('.models');
  const mtRevealEls   = Array.from(document.querySelectorAll('.mt-reveal'));
  if (modelsSection && mtRevealEls.length) {
    let modelsDone = false;
    const modelsObs = new IntersectionObserver((entries) => {
      if (modelsDone) return;
      if (entries.some(e => e.isIntersecting)) {
        modelsDone = true;
        mtRevealEls.forEach(el => el.classList.add('mt-visible'));
        modelsObs.disconnect();
      }
    }, { threshold: 0.4, rootMargin: '0px 0px -80px 0px' });
    modelsObs.observe(modelsSection);
  }

  // Pricing rows — lightweight row-by-row fade
  const ptRows = Array.from(
    document.querySelectorAll('.pt-row:not(.pt-head)')
  );
  const priceTable = document.querySelector('.price-table');
  if (priceTable && ptRows.length) {
    let ptDone = false;
    const ptObs = new IntersectionObserver((entries) => {
      if (ptDone || !entries.some(e => e.isIntersecting)) return;
      ptDone = true;
      const incDone = incCards.every(c => c.classList.contains('visible'));
      const delay   = incDone ? 0 : 400;
      setTimeout(() => staggerRAF(ptRows, 150, el => {
        el.classList.add('visible');
      }), delay);
      ptObs.disconnect();
    }, { threshold: 0.05 });
    ptObs.observe(priceTable);
  }
})();

// ── HERO TEXT — entrance sequence
setTimeout(() => {
  staggerRAF(
    Array.from(document.querySelectorAll('.intro-hero-el')),
    150,
    el => el.classList.add('visible')
  );
}, 100);

// ── MÉTÉO — Open-Meteo live data
(function () {
  const BASE =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=44.66&longitude=-1.17' +
    '&current=temperature_2m,windspeed_10m,weathercode' +
    '&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,sunrise,sunset' +
    '&wind_speed_unit=kn&forecast_days=5&timezone=Europe%2FParis';

  const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

  function getCondition(windKn) {
    if (windKn < 10) return { label: 'Idéal pour naviguer',   cls: 'weather-badge--good' };
    if (windKn < 15) return { label: 'Conditions favorables', cls: 'weather-badge--ok' };
    if (windKn < 22) return { label: 'Navigation sportive',   cls: 'weather-badge--caution' };
    return             { label: 'Sortie déconseillée',        cls: 'weather-badge--danger' };
  }

  function emojiForCode(code) {
    if (code <= 2)                                                 return '☀️';  // clear / mainly clear / partly cloudy
    if (code === 3)                                                return '🌤';  // overcast
    if (code === 45 || code === 48)                                return '🌫';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return '🌧';
    if (code >= 71 && code <= 77)                                  return '❄️';
    if (code >= 95)                                                return '⛈';
    return '🌥';
  }

  function buildForecast(daily, currentTemp) {
    const el = document.getElementById('weatherForecast');
    if (!el) return;

    const tmaxs     = daily.temperature_2m_max;
    const tmins     = daily.temperature_2m_min;
    const globalMin = Math.min(...tmins);
    const globalMax = Math.max(...tmaxs);
    const range     = globalMax - globalMin || 1;

    el.innerHTML = daily.time.map((dateStr, i) => {
      const code  = daily.weathercode[i];
      const tmax  = Math.round(tmaxs[i]);
      const tmin  = Math.round(tmins[i]);
      const dow   = new Date(dateStr + 'T12:00:00').getDay();
      const day   = i === 0 ? 'Aujourd\'hui' : i === 1 ? 'Demain' : DAYS_FR[dow];
      const emoji = emojiForCode(code);

      // Bar segment: left offset + width as % of global range
      const barLeft  = ((tmin - globalMin) / range * 100).toFixed(1);
      const barWidth = ((tmax - tmin)      / range * 100).toFixed(1);

      // Current-temp dot on today's row only
      let dotHtml = '';
      if (i === 0 && currentTemp != null) {
        const clamped = Math.max(globalMin, Math.min(globalMax, currentTemp));
        const dotLeft = ((clamped - globalMin) / range * 100).toFixed(1);
        dotHtml = '<span class="wf-dot" style="left:' + dotLeft + '%"></span>';
      }

      return '<div class="wf-row">' +
        '<span class="wf-day">' + day + '</span>' +
        '<span class="wf-emoji">' + emoji + '</span>' +
        '<span class="wf-lo">' + tmin + '°</span>' +
        '<div class="wf-bar-wrap">' +
          '<div class="wf-bar" style="left:' + barLeft + '%;width:' + barWidth + '%"></div>' +
          dotHtml +
        '</div>' +
        '<span class="wf-hi">' + tmax + '°</span>' +
        '</div>';
    }).join('');
  }

  function buildCta(code, wind) {
    const el = document.getElementById('weatherCta');
    if (!el) return;
    let text, btn;

    if (code === 0 && wind < 10) {
      text = "☀️ Soleil parfait aujourd'hui — les créneaux partent vite.";
      btn  = { label: 'Réserver maintenant',    href: '#availability' };
    } else if (code <= 3 && wind < 15) {
      text = "🌤 Belles conditions prévues — profitez-en.";
      btn  = { label: 'Voir les disponibilités', href: '#availability' };
    } else if (wind >= 15 && wind <= 21) {
      text = "💨 Ça souffle un peu — pour les amateurs de sensations.";
      btn  = { label: 'Réserver quand même',    href: '#availability' };
    } else if (code >= 51 && code <= 82) {
      text = "🌧 À votre place, j'attendrais demain. Mais c'est vous qui voyez.";
      btn  = { label: 'Voir les prévisions',     href: '#weatherForecast' };
    } else if (code >= 95) {
      text = "⛈ Même les dauphins restent à terre aujourd'hui.";
      btn  = null;
    } else {
      // brouillard, neige, codes intermédiaires
      text = "🌫 Conditions variables — consultez les prévisions avant de partir.";
      btn  = { label: 'Voir les disponibilités', href: '#availability' };
    }

    el.innerHTML = '<p class="weather-cta-text">' + text + '</p>' +
      (btn ? '<a href="' + btn.href + '" class="btn">' + btn.label + '</a>' : '');
  }

  async function fetchWeather() {
    try {
      const res  = await fetch(BASE);
      const data = await res.json();
      const c    = data.current;
      const d    = data.daily;

      const temp = Math.round(c.temperature_2m);
      const wind = Math.round(c.windspeed_10m);
      const code = c.weathercode;

      // ── Night mode: override display after sunset ─────────────────
      const sunsetStr  = data.daily?.sunset?.[0];   // "2026-05-24T21:38"
      const sunriseStr = data.daily?.sunrise?.[0];  // "2026-05-24T06:17"
      const now        = new Date();
      const sunset     = sunsetStr  ? new Date(sunsetStr)  : null;
      const sunrise    = sunriseStr ? new Date(sunriseStr) : null;
      const isNight    = sunset && sunrise
        ? (now >= sunset || now < sunrise)
        : now.getHours() >= 22 || now.getHours() < 7; // fallback

      if (isNight) {
        // Override weather icon to moon
        document.getElementById('weatherIcon').innerHTML =
          '<span style="font-size:56px;line-height:1">🌙</span>';

        // Show "À demain" badge in hero eyebrow
        const eyebrow = document.querySelector('.intro .eyebrow');
        if (eyebrow) {
          eyebrow.textContent = 'On reprend demain matin 🌙  ·  Réservez dès maintenant';
        }

        // Soft night message in availability section subtitle
        const availSub = document.querySelector('.avail-text .sec-sub');
        if (availSub) {
          availSub.innerHTML =
            'Nos jets skis rentrent au port après le coucher du soleil. ' +
            'Vous pouvez dès maintenant réserver un créneau pour demain — ' +
            'premier départ à 9h.';
        }

        return; // Skip rest of weather rendering (no forecast needed at night)
      }

      // ① Conditions actuelles
      document.getElementById('weatherIcon').innerHTML = '<span style="font-size:56px;line-height:1">' + emojiForCode(code) + '</span>';
      document.getElementById('weatherTemp').textContent = temp;
      document.getElementById('weatherWind').textContent = wind;

      const cond  = getCondition(wind);
      const badge = document.getElementById('weatherBadge');
      badge.className = 'weather-badge ' + cond.cls;
      document.getElementById('weatherLabel').textContent = cond.label;

      // ② Prévisions 5 jours
      buildForecast(d, temp);

      // ③ CTA dynamique
      buildCta(code, wind);

    } catch {
      const badge = document.getElementById('weatherBadge');
      if (badge) badge.style.display = 'none';
    }
  }

  fetchWeather();
}());

// ── CAROUSEL — Expérience & Sécurité
(function () {
  const viewport = document.getElementById('carouselViewport');
  const track    = document.getElementById('carouselTrack');
  if (!track) return;

  // Capture real slides BEFORE cloning
  const realSlides = Array.from(track.querySelectorAll('.carousel-slide'));
  const dots       = Array.from(document.querySelectorAll('#carouselDots .carousel-dot'));
  const prevBtn    = document.getElementById('carouselPrev');
  const nextBtn    = document.getElementById('carouselNext');
  const TOTAL      = realSlides.length;   // 6
  const GAP        = 20;                  // must match CSS gap
  let cur          = 1;                   // index in extended track (1 = slide 0)
  let autoTimer    = null;

  /* ── Infinite loop: clone first and last slides ── */
  const cloneLast  = realSlides[TOTAL - 1].cloneNode(true);
  const cloneFirst = realSlides[0].cloneNode(true);
  [cloneLast, cloneFirst].forEach(c => c.setAttribute('aria-hidden', 'true'));
  track.insertBefore(cloneLast,  track.firstChild); // slot 0
  track.appendChild(cloneFirst);                    // slot TOTAL + 1
  // Extended track: [cloneLast | s0 s1 … s5 | cloneFirst]  (8 items)
  const all = Array.from(track.children);

  function slideW() { return all[0].offsetWidth; }

  function getOffset(idx) {
    const vw = viewport.offsetWidth;
    return (vw - slideW()) / 2 - idx * (slideW() + GAP);
  }

  /* Real dot index for any extended-track index */
  function dotIdx(idx) { return ((idx - 1) % TOTAL + TOTAL) % TOTAL; }

  function applyClasses(idx) {
    all.forEach((s, i)  => s.classList.toggle('cs-active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === dotIdx(idx)));
  }

  /* Instant position — no transition */
  function snap(idx) {
    track.classList.add('no-transition');
    track.style.transform = `translateX(${getOffset(idx)}px)`;
    cur = idx;
    applyClasses(idx);
    // Double RAF: first paints the snap, second re-enables transitions
    requestAnimationFrame(() => requestAnimationFrame(() =>
      track.classList.remove('no-transition')
    ));
  }

  /* Animated move */
  function go(idx) {
    track.style.transform = `translateX(${getOffset(idx)}px)`;
    cur = idx;
    applyClasses(idx);
  }

  /* After animated slide ends, jump if on a ghost clone */
  track.addEventListener('transitionend', e => {
    if (e.propertyName !== 'transform') return;
    if (cur === 0)           snap(TOTAL);     // ghost last → real last
    if (cur === TOTAL + 1)   snap(1);         // ghost first → real first
  });

  /* Watchdog: every 800ms check the active slide is actually
     visible. If not, re-snap to recover from lost transitionend
     (tab switches, browser throttle, slow desktop image loads). */
  setInterval(() => {
    const active = track.querySelector('.cs-active');
    if (!active) { snap(1); return; }
    // If we're stuck on a ghost (idx 0 or TOTAL+1), recover
    if (cur === 0)         { snap(TOTAL);   return; }
    if (cur === TOTAL + 1) { snap(1);       return; }
    // If active slide has near-zero opacity (transition stuck), re-snap
    if (parseFloat(getComputedStyle(active).opacity) < 0.5) {
      snap(cur);
    }
  }, 800);

  function slideNext() { go(cur + 1); }
  function slidePrev() { go(cur - 1); }

  function startAuto() { stopAuto(); autoTimer = setInterval(slideNext, 5000); }
  function stopAuto()  { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }

  /* Init — wait for full page load so images are sized and layout is stable */
  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        snap(1);
        startAuto();
      });
    });
  });

  /* Safety net: if the active slide is still transparent 1200ms after load,
     re-snap to force correct opacity (catches slow desktop image loads) */
  setTimeout(() => {
    const active = track.querySelector('.cs-active');
    if (active && parseFloat(getComputedStyle(active).opacity) < 0.5) {
      snap(cur);
    }
  }, 1200);

  /* Arrows */
  prevBtn.addEventListener('click', () => { slidePrev(); startAuto(); });
  nextBtn.addEventListener('click', () => { slideNext(); startAuto(); });

  /* Dots — dot i maps to extended-track slot i + 1 */
  dots.forEach(d =>
    d.addEventListener('click', () => { go(+d.dataset.dot + 1); startAuto(); })
  );

  /* Keyboard */
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { slidePrev(); startAuto(); }
    if (e.key === 'ArrowRight') { slideNext(); startAuto(); }
  });

  /* Pause on hover */
  viewport.addEventListener('mouseenter', stopAuto);
  viewport.addEventListener('mouseleave', startAuto);

  /* Touch / swipe */
  let touchX = 0;
  viewport.addEventListener('touchstart', e => {
    touchX = e.touches[0].clientX;
  }, { passive: true });
  viewport.addEventListener('touchend', e => {
    const delta = touchX - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      delta > 0 ? slideNext() : slidePrev();
      startAuto();
    }
  }, { passive: true });

  /* Mac trackpad two-finger horizontal swipe */
  let wheelCooling = false;
  viewport.addEventListener('wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; // ignore vertical scroll
    e.preventDefault();
    if (wheelCooling) return;
    wheelCooling = true;
    setTimeout(() => { wheelCooling = false; }, 500);
    if (e.deltaX > 40)       { slideNext(); startAuto(); }
    else if (e.deltaX < -40) { slidePrev(); startAuto(); }
  }, { passive: false });

  /* Resize — recalculate position without animation */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => snap(cur), 100);
  }, { passive: true });
}());

// ── PRICING HEADING — rotating phrase animation
(function () {
  const heading = document.getElementById('pricingHeading');
  const eyebrow = document.getElementById('pricingEyebrow');
  if (!heading) return;

  const isMobile   = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const staticLine = isMobile ? 'Posez votre téléphone.' : 'Fermez votre ordinateur.';
  if (!isMobile && eyebrow) eyebrow.style.display = 'none';

  const phrases = [
    'Venez prendre le guidon.',
    'Venez vous mouiller.',
    'Venez toucher le sable.',
    'Venez visiter le Bassin.',
    'Venez respirer l’air du large.',
  ];
  let idx = 0;

  // Build heading: static first line + animated span on second line
  heading.innerHTML =
    staticLine + '<br><span class="rotating-phrase">' + phrases[0] + '</span>';
  const span = heading.querySelector('.rotating-phrase');

  const HOLD     = 2800; // ms each phrase is held visible
  const FADE_OUT =  300; // ms fade-to-invisible
  const FADE_IN  =  400; // ms fade-to-visible
  const CYCLE    = HOLD + FADE_OUT + FADE_IN;

  function rotate() {
    // ① Fade out + slide up
    span.style.transition = `opacity ${FADE_OUT}ms ease, transform ${FADE_OUT}ms ease`;
    span.style.opacity    = '0';
    span.style.transform  = 'translateY(-8px)';

    // ② After fade-out: swap text, teleport below, then fade in
    setTimeout(() => {
      idx = (idx + 1) % phrases.length;
      span.textContent      = phrases[idx];
      span.style.transition = 'none';
      span.style.opacity    = '0';
      span.style.transform  = 'translateY(8px)';

      // Force reflow so the instant reset registers before transition re-enables
      span.getBoundingClientRect(); // eslint-disable-line no-unused-expressions

      requestAnimationFrame(() => {
        span.style.transition = `opacity ${FADE_IN}ms ease, transform ${FADE_IN}ms ease`;
        span.style.opacity    = '1';
        span.style.transform  = 'translateY(0)';
      });
    }, FADE_OUT);
  }

  setInterval(rotate, CYCLE);
}());


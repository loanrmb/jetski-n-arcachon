/* ═══════════════════════════════════════════════════════
   Jetski Arcachon — script.js
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────
   SUPABASE — anon key is safe to expose client-side.
   RLS policies enforce what anon can read/write.
───────────────────────────── */
const SUPABASE_URL      = 'https://uwoqubisdlqoqblitzrf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3b3F1YmlzZGxxb3FibGl0enJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzI5MjgsImV4cCI6MjA5NDk0ODkyOH0.AxSPUEV_KtLYxBRDs3xOCAHFQVmQBuwQ3J5hXeHclvw';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ─────────────────────────────
   CONSTANTS
───────────────────────────── */
const MODELS = [
  { name: 'Sea-Doo GTI SE 130', dbName: 'GTI SE 130', price: '110 €', prices: { 1: '110 €', 2: '195 €', 4: '360 €' } },
  { name: 'Sea-Doo GTX 230',    dbName: 'GTX 230',    price: '125 €', prices: { 1: '125 €', 2: '220 €', 4: '395 €' } },
  { name: 'Sea-Doo RXT-X 300',  dbName: 'RXT-X 300',  price: '140 €', prices: { 1: '140 €', 2: '245 €', 4: '430 €' } },
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

/* ─────────────────────────────
   STATE
───────────────────────────── */
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

/* ─────────────────────────────
   SUPABASE — DATA LAYER
───────────────────────────── */

async function fetchJetSkis() {
  const { data } = await sb.from('jet_skis').select('id,name').eq('status', 'active');
  jetSkis   = data ?? [];
  jetSkiIds = jetSkis.map(r => r.id);
}

// Fetch all blocked slots from today → +1 year (covers the full next season).
// Supabase TIME columns arrive as "HH:MM:SS" — slice to 5 for "HH:MM".
async function fetchBlocked() {
  const from = TODAY.toISOString().split('T')[0];
  const to   = new Date(TODAY.getFullYear() + 1, TODAY.getMonth(), TODAY.getDate())
                 .toISOString().split('T')[0];

  const { data } = await sb
    .from('availabilities')
    .select('date,slot_time,jet_ski_id')
    .eq('is_blocked', true)
    .gte('date', from)
    .lte('date', to);

  blockedSet = new Set(
    (data ?? []).map(r => `${r.date}|${r.slot_time.slice(0, 5)}|${r.jet_ski_id}`)
  );
}

/* ─────────────────────────────
   AVAILABILITY HELPERS
───────────────────────────── */

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

/* ─────────────────────────────
   SUPABASE — REALTIME
───────────────────────────── */

function setupRealtime() {
  sb.channel('site-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availabilities' }, onLiveUpdate)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' },   onLiveUpdate)
    .subscribe();
}

async function onLiveUpdate() {
  await fetchBlocked();
  renderAvail();
  if (overlay.classList.contains('open')) {
    buildCal('calGrid', calY, calM, true, selectedDate);
    if ($('step2')?.classList.contains('active') && selectedDate) renderTimeSlots();
  }
}

/* ─────────────────────────────
   MODEL TABS
───────────────────────────── */
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

/* ─────────────────────────────
   RESERVE BUTTONS (model CTA)
   Each .btn-reserve has data-model="0|1|2" matching MODELS index.
───────────────────────────── */
document.querySelectorAll('.btn-reserve').forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = +(btn.dataset.model ?? currentModel);
    openModal(idx);
  });
});

/* ─────────────────────────────
   CALENDAR BUILDER
   onDateClick — optional callback(dateStr).
   When supplied (avail calendar), a date click calls the callback instead
   of the default modal-calendar behavior (select date in current modal).
───────────────────────────── */
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

/* ─────────────────────────────
   TIME SLOTS (step 2)
───────────────────────────── */
function renderTimeSlots() {
  document.querySelectorAll('.tslot').forEach(btn => {
    const slot = btn.dataset.t;
    const full = !!(selectedDate && isSlotFull(selectedDate, slot));
    btn.disabled = full;
    btn.classList.toggle('tslot--disabled', full);
    // If the currently-selected slot just became full, deselect it
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

/* ─────────────────────────────
   DURATION BUTTONS (step 2)
───────────────────────────── */
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

/* ─────────────────────────────
   STEP NAVIGATION
───────────────────────────── */
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

/* ─────────────────────────────
   OPEN MODAL — model CTA path
   Pre-selects the jet ski; 3-step flow (Date → Heure → Infos).
───────────────────────────── */
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

/* ─────────────────────────────
   OPEN MODAL — avail calendar path
   Date is already known; 4-step flow (Date → Modèle → Heure → Infos).
   Opens directly at step_model — step1 (calendar) is skipped.
───────────────────────────── */
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

/* ─────────────────────────────
   MODAL — EVENT LISTENERS
───────────────────────────── */
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

/* ─────────────────────────────
   MODEL SELECTOR (step_model — avail path only)
───────────────────────────── */
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

/* ─────────────────────────────
   BACK BUTTONS
───────────────────────────── */
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

/* ─────────────────────────────
   RECAP
───────────────────────────── */
function buildRecap() {
  const d   = new Date(selectedDate + 'T12:00:00');
  const ds  = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dur = selectedDuration === 4 ? 'Demi-journée (4h)' : `${selectedDuration}h`;
  const m   = MODELS.find(x => x.dbName === selectedJetSki);
  const modelLabel = m ? `${m.name} — ${m.price}/h` : 'Au choix';
  $('recap').innerHTML =
    `<strong>${modelLabel}</strong><br>${ds} à ${selectedTime} · ${dur}`;
}

/* ─────────────────────────────
   FORM SUBMISSION
───────────────────────────── */
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

/* ─────────────────────────────
   AVAILABILITY CALENDAR (section)
   Interactive: clicking an available day opens the booking modal.
───────────────────────────── */
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

/* ─────────────────────────────
   BURGER / MOBILE MENU
───────────────────────────── */
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

/* ─────────────────────────────
   SMOOTH SCROLL
───────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const tgt = document.querySelector(a.getAttribute('href'));
    if (!tgt) return;
    e.preventDefault();
    const top = tgt.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ─────────────────────────────
   INIT
───────────────────────────── */
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

/* ─────────────────────────────
   SCROLL REVEAL — Intersection Observer
───────────────────────────── */
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

  // Staggered inc-cards
  const incCards = document.querySelectorAll('.inc-card');
  const incObs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        const idx = Array.from(incCards).indexOf(e.target);
        setTimeout(() => {
          e.target.classList.add('visible');
        }, idx * 80);
        incObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });
  incCards.forEach(el => incObs.observe(el));

  // Gallery blocks
  const gblocks = document.querySelectorAll('.gblock');
  const gObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        gObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  gblocks.forEach(el => gObs.observe(el));

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

  // Airport flip — price cells (left-to-right, row-by-row, 80ms stagger)
  const ptFlipCells = Array.from(
    document.querySelectorAll('.pt-row:not(.pt-head) .pt-c:not(.pt-c--name)')
  );
  const priceTable = document.querySelector('.price-table');
  if (priceTable && ptFlipCells.length) {
    let ptFlipDone = false;
    const ptFlipObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && !ptFlipDone) {
          ptFlipDone = true;
          ptFlipCells.forEach((el, i) => {
            setTimeout(() => el.classList.add('visible'), i * 80);
          });
          ptFlipObs.disconnect();
        }
      });
    }, { threshold: 0.2 });
    ptFlipObs.observe(priceTable);
  }
})();

/* ─────────────────────────────
   HERO TEXT — entrance sequence
───────────────────────────── */
setTimeout(() => {
  document.querySelectorAll('.intro-hero-el').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), i * 150);
  });
}, 200);

/* ─────────────────────────────
   MÉTÉO — Open-Meteo live data
───────────────────────────── */
(function () {
  const BASE =
    'https://api.open-meteo.com/v1/forecast' +
    '?latitude=44.66&longitude=-1.17' +
    '&current=temperature_2m,windspeed_10m,weathercode' +
    '&daily=weathercode_dominant,temperature_2m_max,temperature_2m_min,windspeed_10m_max' +
    '&wind_speed_unit=kn&forecast_days=5&timezone=Europe%2FParis';

  const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // ── SVG shapes (viewBox 0 0 48 48) ──────────────────────────────
  const SHAPES = {
    sun:
      '<circle cx="24" cy="24" r="9" fill="#FBBF24"/>' +
      '<g stroke="#FBBF24" stroke-width="3" stroke-linecap="round">' +
        '<line x1="24" y1="4"    x2="24"  y2="10"/>' +
        '<line x1="24" y1="38"   x2="24"  y2="44"/>' +
        '<line x1="8.1" y1="8.1"   x2="12.3" y2="12.3"/>' +
        '<line x1="35.7" y1="35.7" x2="39.9" y2="39.9"/>' +
        '<line x1="4"  y1="24"   x2="10"  y2="24"/>' +
        '<line x1="38" y1="24"   x2="44"  y2="24"/>' +
        '<line x1="8.1"  y1="39.9" x2="12.3" y2="35.7"/>' +
        '<line x1="35.7" y1="12.3" x2="39.9" y2="8.1"/>' +
      '</g>',
    cloud:
      '<circle cx="33" cy="18" r="6"  fill="#FBBF24" opacity="0.9"/>' +
      '<circle cx="19" cy="28" r="9"  fill="#94A3B8"/>' +
      '<circle cx="30" cy="24" r="10" fill="#94A3B8"/>' +
      '<rect x="10" y="28" width="28" height="10" rx="5" fill="#94A3B8"/>',
    rain:
      '<circle cx="18" cy="21" r="9"  fill="#64748B"/>' +
      '<circle cx="30" cy="17" r="11" fill="#64748B"/>' +
      '<rect x="9" y="21" width="28" height="10" rx="5" fill="#64748B"/>' +
      '<g stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round">' +
        '<line x1="16" y1="36" x2="14" y2="43"/>' +
        '<line x1="24" y1="36" x2="22" y2="43"/>' +
        '<line x1="32" y1="36" x2="30" y2="43"/>' +
      '</g>',
    storm:
      '<circle cx="18" cy="20" r="9"  fill="#475569"/>' +
      '<circle cx="30" cy="16" r="11" fill="#475569"/>' +
      '<rect x="9" y="20" width="28" height="10" rx="5" fill="#475569"/>' +
      '<polygon points="27,28 20,39 25,39 23,48 32,34 27,34" fill="#FCD34D"/>',
  };

  function shapeType(code) {
    if (code === 0)                              return 'sun';
    if (code <= 3 || code === 45 || code === 48) return 'cloud';
    if (code >= 95)                              return 'storm';
    return 'rain';
  }

  function buildSvg(code, cls) {
    return '<svg class="' + cls + '" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      SHAPES[shapeType(code)] + '</svg>';
  }

  function getCondition(windKn) {
    if (windKn < 10) return { label: 'Idéal pour naviguer',   cls: 'weather-badge--good' };
    if (windKn < 15) return { label: 'Conditions favorables', cls: 'weather-badge--ok' };
    if (windKn < 22) return { label: 'Navigation sportive',   cls: 'weather-badge--caution' };
    return             { label: 'Sortie déconseillée',        cls: 'weather-badge--danger' };
  }

  function buildForecast(daily) {
    const el = document.getElementById('weatherForecast');
    if (!el) return;
    el.innerHTML = daily.time.map((dateStr, i) => {
      const code = daily.weathercode_dominant[i];
      const tmax = Math.round(daily.temperature_2m_max[i]);
      const tmin = Math.round(daily.temperature_2m_min[i]);
      const dow  = new Date(dateStr + 'T12:00:00').getDay();
      const day  = i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : DAYS_FR[dow];
      return '<div class="wf-card' + (i === 0 ? ' wf-today' : '') + '">' +
        '<span class="wf-day">' + day + '</span>' +
        buildSvg(code, 'wf-icon') +
        '<span class="wf-tmax">' + tmax + '°</span>' +
        '<span class="wf-tmin">' + tmin + '°</span>' +
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

      // ① Conditions actuelles
      document.getElementById('weatherIcon').innerHTML = buildSvg(code, 'weather-icon');
      document.getElementById('weatherTemp').textContent = temp;
      document.getElementById('weatherWind').textContent = wind;

      const cond  = getCondition(wind);
      const badge = document.getElementById('weatherBadge');
      badge.className = 'weather-badge ' + cond.cls;
      document.getElementById('weatherLabel').textContent = cond.label;

      // ② Prévisions 5 jours
      buildForecast(d);

      // ③ CTA dynamique
      buildCta(code, wind);

    } catch {
      const badge = document.getElementById('weatherBadge');
      if (badge) badge.style.display = 'none';
    }
  }

  fetchWeather();
}());

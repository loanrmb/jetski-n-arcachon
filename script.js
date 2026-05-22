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

mtTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const idx = +tab.dataset.idx;
    if (idx === currentModel) return;
    currentModel = idx;
    mtTabs.forEach(t  => t.classList.remove('active'));
    mtSlides.forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    mtSlides[idx].classList.add('active');
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
    const { error: resErr } = await sb.from('reservations').insert({
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
    });

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

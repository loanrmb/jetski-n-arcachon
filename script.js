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
  { name: 'Sea-Doo GTI SE 130', price: '110 €' },
  { name: 'Sea-Doo GTX 230',    price: '125 €' },
  { name: 'Sea-Doo RXT-X 300',  price: '140 €' },
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
let bookingModel     = 0;
let calY             = TODAY.getFullYear();
let calM             = TODAY.getMonth();
let availY           = TODAY.getFullYear();
let availM           = TODAY.getMonth();
let selectedDate     = null;
let selectedTime     = null;
let selectedDuration = null;

// Supabase-backed availability
let jetSkiIds  = [];        // active jet ski UUIDs (fetched once)
let blockedSet = new Set(); // "YYYY-MM-DD|HH:MM|jet_ski_id" — all is_blocked=true rows

/* ─────────────────────────────
   SUPABASE — DATA LAYER
───────────────────────────── */

async function fetchJetSkiIds() {
  const { data } = await sb.from('jet_skis').select('id').eq('status', 'active');
  jetSkiIds = (data ?? []).map(r => r.id);
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

// A day is "Complet" only when all 3 jet skis × all 4 slots are blocked (12 combos).
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
    if (steps[1].classList.contains('active') && selectedDate) renderTimeSlots();
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
   RESERVE BUTTONS
───────────────────────────── */
document.querySelectorAll('.btn-reserve').forEach(btn => {
  btn.addEventListener('click', () => {
    bookingModel = +(btn.dataset.model ?? currentModel);
    openModal();
  });
});

/* ─────────────────────────────
   CALENDAR BUILDER
   Now uses full "YYYY-MM-DD" date strings instead of bare day
   numbers — fixes the bug where the same days were blocked every month.
───────────────────────────── */
function buildCal(gridId, year, month, interactive, selDate) {
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
    const isPast   = date < TODAY;
    const isToday  = date.getTime() === TODAY.getTime();
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isFull   = !isPast && isDayFull(dateStr);
    const isSel    = interactive && selDate === dateStr;

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
  });
});

// "Continuer →" only unlocks when BOTH a slot AND a duration are selected
function updateStep3Btn() {
  $('toStep3').disabled = !(selectedTime && selectedDuration);
}

/* ─────────────────────────────
   BOOKING MODAL
───────────────────────────── */
const overlay = $('overlay');
const steps   = ['step1', 'step2', 'step3', 'step4'].map($);
const psEls   = ['ps1',   'ps2',   'ps3'].map($);

function openModal() {
  $('modalModelName').textContent = MODELS[bookingModel].name;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  // Reset booking state
  calY = TODAY.getFullYear();
  calM = TODAY.getMonth();
  selectedDate     = null;
  selectedTime     = null;
  selectedDuration = null;
  $('toStep2').disabled = true;
  $('toStep3').disabled = true;

  // Reset slot + duration UI
  document.querySelectorAll('.tslot').forEach(t => {
    t.classList.remove('sel', 'tslot--disabled');
    t.disabled = false;
  });
  document.querySelectorAll('.dslot').forEach(b => b.classList.remove('sel'));

  goStep(1);
  updateCalTitle();
  buildCal('calGrid', calY, calM, true, null);
}

function closeModal() {
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function goStep(n) {
  steps.forEach((s, i) => s.classList.toggle('active', i + 1 === n));
  psEls.forEach((p, i) => {
    p.classList.toggle('active', i + 1 === n);
    p.classList.toggle('done',   i + 1 <  n);
  });
}

function updateCalTitle() {
  const el = $('calTitle');
  if (el) el.textContent = `${MONTHS_FR[calM]} ${calY}`;
}

$('modalClose').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

$('calPrev').addEventListener('click', () => {
  calM--; if (calM < 0) { calM = 11; calY--; }
  selectedDate = null; $('toStep2').disabled = true;
  updateCalTitle(); buildCal('calGrid', calY, calM, true, null);
});

$('calNext').addEventListener('click', () => {
  calM++; if (calM > 11) { calM = 0; calY++; }
  selectedDate = null; $('toStep2').disabled = true;
  updateCalTitle(); buildCal('calGrid', calY, calM, true, null);
});

$('toStep2').addEventListener('click', () => {
  if (!selectedDate) return;
  const d = new Date(selectedDate + 'T12:00:00');
  $('step2Date').textContent = d.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, c => c.toUpperCase());
  goStep(2);
  renderTimeSlots(); // apply real availability to slots
});

$('toStep3').addEventListener('click', () => {
  const m   = MODELS[bookingModel];
  const d   = new Date(selectedDate + 'T12:00:00');
  const ds  = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dur = selectedDuration === 4 ? 'Demi-journée (4h)' : `${selectedDuration}h`;
  $('recap').innerHTML =
    `<strong>${m.name}</strong><br>${ds} à ${selectedTime} · ${dur} — ${m.price}/h`;
  goStep(3);
});

$('back1').addEventListener('click', () => goStep(1));
$('back2').addEventListener('click', () => { goStep(2); renderTimeSlots(); });

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

    // Insert pending reservation — jet ski assigned later by staff in CRM
    const { error: resErr } = await sb.from('reservations').insert({
      client_id:        clientId,
      jet_ski_id:       null,
      date:             selectedDate,
      slot_time:        selectedTime,
      duration_hours:   selectedDuration,
      nb_persons:       1,
      source:           'online',
      status:           'pending',
      license_verified: 'not_verified',
      client_message:   msg || null,
    });

    if (resErr) throw new Error(resErr.message);

    goStep(4);

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
───────────────────────────── */
function updateAvailTitle() {
  const el = $('availTitle');
  if (el) el.textContent = `${MONTHS_FR[availM]} ${availY}`;
}

function renderAvail() {
  updateAvailTitle();
  buildCal('availGrid', availY, availM, false, null);
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
    await fetchJetSkiIds();
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

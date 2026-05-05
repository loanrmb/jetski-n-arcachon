/* ═══════════════════════════════════════════════════════
   Jetski'n Arcachon — script.js
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────
   DATA
───────────────────────────── */
const MODELS = [
  {
    id:    'gti',
    name:  'Sea-Doo GTI SE 130',
    tag:   'Découverte · Débutant',
    label: 'GTI SE 130',
    power: '130', speed: '75', seats: '3', cyl: '1 630',
    price: '110 €',
    // SVG fill colors per model
    colors: { body:'#CBD5E1', cabin:'#B0BEC5', wheel:'#90A4AE', line:'#90A4AE' },
  },
  {
    id:    'gtx',
    name:  'Sea-Doo GTX 230',
    tag:   'Sport · Intermédiaire',
    label: 'GTX 230',
    power: '230', speed: '95', seats: '3', cyl: '1 630',
    price: '125 €',
    colors: { body:'#BFDBFE', cabin:'#93C5FD', wheel:'#60A5FA', line:'#60A5FA' },
  },
  {
    id:    'rxt',
    name:  'Sea-Doo RXT-X 300',
    tag:   'Performance · Expert',
    label: 'RXT-X 300',
    power: '300', speed: '110', seats: '3', cyl: '1 630',
    price: '140 €',
    colors: { body:'#334155', cabin:'#1E293B', wheel:'#475569', line:'#64748B' },
  },
];

// Booked day numbers (day of month) for preview — same set applied to any month
const BOOKED_DAYS = new Set([5, 6, 12, 13, 19, 21, 26, 27]);

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];

/* ─────────────────────────────
   STATE
───────────────────────────── */
let currentModel  = 0;
let bookingModel  = 0;
let calY          = new Date().getFullYear();
let calM          = new Date().getMonth();
let availY        = new Date().getFullYear();
let availM        = new Date().getMonth();
let selectedDate  = null;   // 'YYYY-MM-DD'
let selectedTime  = null;   // 'HH:MM'
const TODAY       = new Date();
TODAY.setHours(0,0,0,0);

/* ─────────────────────────────
   ELEMENT REFS
───────────────────────────── */
const $ = id => document.getElementById(id);
const modelNameEl  = $('modelName');
const modelTagEl   = $('modelTag');
const modelCounter = $('modelCounter');
const priceLabel   = $('priceLabel');
const modelFrame   = $('modelFrame');
const modelPhLabel = $('modelPhLabel');
const svgBody      = $('svgBody');
const svgCabin     = $('svgCabin');
const svgW1a       = $('svgW1a');
const svgW2a       = $('svgW2a');
const svgW1b       = $('svgW1b');
const svgW2b       = $('svgW2b');
const svgLine      = $('svgLine');
const svPower      = $('svPower');
const svSpeed      = $('svSpeed');
const svSeats      = $('svSeats');
const svCyl        = $('svCyl');
const dotsEl       = $('dotsEl');

/* ─────────────────────────────
   HELPERS
───────────────────────────── */
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function animNum(el, from, toStr) {
  const to = parseInt(toStr.replace(/[\s,]/g, ''), 10);
  if (isNaN(to)) { el.textContent = toStr; return; }
  const dur = 380;
  const t0  = performance.now();
  const tick = now => {
    const p = Math.min((now - t0) / dur, 1);
    const e = p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2,2)/2;
    el.textContent = lerp(from, to, e);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = toStr;
  };
  requestAnimationFrame(tick);
}

/* ─────────────────────────────
   MODEL SWITCHER
───────────────────────────── */
function switchModel(newIdx, dir) {
  if (newIdx === currentModel) return;
  const prev  = currentModel;
  currentModel = ((newIdx % MODELS.length) + MODELS.length) % MODELS.length;
  const m = MODELS[currentModel];

  // Animate frame out
  modelFrame.style.transition = 'opacity 0.16s ease, transform 0.16s ease';
  modelFrame.style.opacity    = '0';
  modelFrame.style.transform  = `translateX(${dir > 0 ? -24 : 24}px)`;

  setTimeout(() => {
    // Update text
    modelNameEl.textContent  = m.name;
    modelTagEl.textContent   = m.tag;
    modelCounter.textContent = `0${currentModel + 1} / 03`;
    priceLabel.textContent   = m.price;
    modelPhLabel.textContent = m.label;

    // Update SVG colours
    const c = m.colors;
    svgBody.setAttribute('fill',  c.body);
    svgCabin.setAttribute('fill', c.cabin);
    svgW1a.setAttribute('fill',   c.cabin);
    svgW2a.setAttribute('fill',   c.cabin);
    svgW1b.setAttribute('fill',   c.wheel);
    svgW2b.setAttribute('fill',   c.wheel);
    svgLine.setAttribute('fill',  c.line);

    // Update background tint for RXT (dark)
    const frame = modelFrame.querySelector('.model-placeholder') || modelFrame;
    if (currentModel === 2) {
      modelFrame.style.background = '#0F172A';
    } else if (currentModel === 1) {
      modelFrame.style.background = '#EFF6FF';
    } else {
      modelFrame.style.background = '';
    }

    // Animate frame in
    modelFrame.style.transform  = `translateX(${dir > 0 ? 24 : -24}px)`;
    modelFrame.style.transition = 'opacity 0.24s ease, transform 0.24s ease';
    modelFrame.style.opacity    = '1';
    modelFrame.style.transform  = 'translateX(0)';
  }, 160);

  // Animate specs
  const pv = MODELS[prev];
  animNum(svPower, parseInt(pv.power), m.power);
  animNum(svSpeed, parseInt(pv.speed), m.speed);

  // Dots
  const dots = dotsEl.querySelectorAll('.dot');
  dots.forEach((d, i) => d.classList.toggle('active', i === currentModel));
}

$('prevBtn').addEventListener('click', () => switchModel(currentModel - 1, -1));
$('nextBtn').addEventListener('click', () => switchModel(currentModel + 1,  1));

dotsEl.querySelectorAll('.dot').forEach((d, i) => {
  d.addEventListener('click', () => switchModel(i, i > currentModel ? 1 : -1));
});

// Touch/swipe on model stage
let tx0 = 0;
$('modelStage').addEventListener('touchstart', e => { tx0 = e.touches[0].clientX; }, { passive: true });
$('modelStage').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - tx0;
  if (Math.abs(dx) > 48) switchModel(dx < 0 ? currentModel + 1 : currentModel - 1, dx < 0 ? 1 : -1);
});

/* ─────────────────────────────
   CALENDAR BUILDER
───────────────────────────── */
const DAY_NAMES = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

function buildCal(gridId, year, month, interactive, selDate) {
  const grid  = $(gridId);
  const first = new Date(year, month, 1).getDay();       // 0=Sun
  const days  = new Date(year, month + 1, 0).getDate();
  const off   = first === 0 ? 6 : first - 1;             // Mon-first offset

  let html = DAY_NAMES.map(n => `<div class="cal-dn">${n}</div>`).join('');

  for (let i = 0; i < off; i++) html += `<div class="cal-d cal-d--empty"></div>`;

  for (let d = 1; d <= days; d++) {
    const date = new Date(year, month, d);
    date.setHours(0,0,0,0);
    const isPast   = date < TODAY;
    const isToday  = date.getTime() === TODAY.getTime();
    const isBooked = BOOKED_DAYS.has(d);
    const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSel    = interactive && selDate === dateStr;

    let cls = 'cal-d';
    if (isSel)            cls += ' cal-d--sel';
    else if (isToday)     cls += ' cal-d--today';
    else if (isPast)      cls += ' cal-d--off';
    else if (isBooked)    cls += ' cal-d--booked';

    const data = interactive && !isPast && !isBooked ? `data-date="${dateStr}"` : '';
    html += `<div class="${cls}" ${data}>${d}</div>`;
  }

  grid.innerHTML = html;

  // Attach click listeners for interactive cals
  if (interactive) {
    grid.querySelectorAll(`.cal-d[data-date]`).forEach(el => {
      el.addEventListener('click', () => {
        selectedDate = el.dataset.date;
        buildCal(gridId, year, month, true, selectedDate);
        $('toStep2').disabled = false;
      });
    });
  }
}

/* ─────────────────────────────
   BOOKING MODAL
───────────────────────────── */
const overlay = $('overlay');
const modal   = $('modal');
const steps   = ['step1','step2','step3','step4'].map($);
const psEls   = ['ps1','ps2','ps3'].map($);

function openModal() {
  bookingModel = currentModel;
  $('modalModelName').textContent = MODELS[bookingModel].name;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  calY = TODAY.getFullYear();
  calM = TODAY.getMonth();
  selectedDate = null;
  selectedTime = null;
  $('toStep2').disabled = true;
  $('toStep3').disabled = true;
  document.querySelectorAll('.tslot').forEach(t => t.classList.remove('sel'));
  goStep(1);
  updateCalTitle();
  buildCal('calGrid', calY, calM, true, null);
}

function closeModal() {
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
}

function goStep(n) {
  steps.forEach((s, i) => s.classList.toggle('active', i + 1 === n));
  psEls.forEach((p, i) => {
    p.classList.toggle('active', i + 1 === n);
    p.classList.toggle('done',   i + 1 < n);
  });
}

function updateCalTitle() {
  $('calTitle').textContent = `${MONTHS_FR[calM]} ${calY}`;
}

$('reserveBtn').addEventListener('click', openModal);

// Close
$('modalClose').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Calendar nav
$('calPrev').addEventListener('click', () => {
  calM--;
  if (calM < 0) { calM = 11; calY--; }
  selectedDate = null;
  $('toStep2').disabled = true;
  updateCalTitle();
  buildCal('calGrid', calY, calM, true, null);
});

$('calNext').addEventListener('click', () => {
  calM++;
  if (calM > 11) { calM = 0; calY++; }
  selectedDate = null;
  $('toStep2').disabled = true;
  updateCalTitle();
  buildCal('calGrid', calY, calM, true, null);
});

// Step 1 → 2
$('toStep2').addEventListener('click', () => {
  if (!selectedDate) return;
  const d = new Date(selectedDate + 'T12:00:00');
  $('step2Date').textContent = d.toLocaleDateString('fr-FR', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  }).replace(/^\w/, c => c.toUpperCase());
  goStep(2);
});

// Time slots
document.querySelectorAll('.tslot').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedTime = btn.dataset.t;
    document.querySelectorAll('.tslot').forEach(t => t.classList.remove('sel'));
    btn.classList.add('sel');
    $('toStep3').disabled = false;
  });
});

// Step 2 → 3
$('toStep3').addEventListener('click', () => {
  const m  = MODELS[bookingModel];
  const d  = new Date(selectedDate + 'T12:00:00');
  const ds = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long' });
  $('recap').innerHTML =
    `<strong>${m.name}</strong><br>${ds} à ${selectedTime} — ${m.price}/h`;
  goStep(3);
});

// Back buttons
$('back1').addEventListener('click', () => goStep(1));
$('back2').addEventListener('click', () => goStep(2));

// Submit
$('submitBtn').addEventListener('click', async function () {
  const name  = $('fName').value.trim();
  const email = $('fEmail').value.trim();
  // Simple validation highlight
  [$('fName'), $('fEmail')].forEach(f => {
    f.style.borderColor = f.value.trim() ? '' : '#FF3B30';
  });
  if (!name || !email) return;

  this.disabled = true;
  this.textContent = 'Envoi…';
  await new Promise(r => setTimeout(r, 1400));
  goStep(4);
});

// Done
$('doneBtn').addEventListener('click', () => {
  closeModal();
  // Reset form for next use
  ['fName','fPhone','fEmail','fMsg'].forEach(id => { $(id).value = ''; });
  const sb = $('submitBtn');
  sb.disabled = false;
  sb.textContent = 'Envoyer ma demande';
  ['fName','fEmail'].forEach(id => { $(id).style.borderColor = ''; });
});

/* ─────────────────────────────
   AVAILABILITY CALENDAR
───────────────────────────── */
function updateAvailTitle() {
  $('availTitle').textContent = `${MONTHS_FR[availM]} ${availY}`;
}

function renderAvail() {
  updateAvailTitle();
  buildCal('availGrid', availY, availM, false, null);
}

$('availPrev').addEventListener('click', () => {
  availM--;
  if (availM < 0) { availM = 11; availY--; }
  renderAvail();
});

$('availNext').addEventListener('click', () => {
  availM++;
  if (availM > 11) { availM = 0; availY++; }
  renderAvail();
});

renderAvail();

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
  spans[0].style.transform = menuOpen ? 'rotate(45deg) translate(4.5px, 4.5px)' : '';
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
   INITIAL RENDER
───────────────────────────── */
// Make sure mobile menu is hidden initially
mobMenu.style.display = 'none';

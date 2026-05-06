/* ═══════════════════════════════════════════════════════
   Jetski'n Arcachon — script.js
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────
   DATA
───────────────────────────── */
const MODELS = [
  { name: 'Sea-Doo GTI SE 130', price: '110 €' },
  { name: 'Sea-Doo GTX 230',    price: '125 €' },
  { name: 'Sea-Doo RXT-X 300',  price: '140 €' },
];

const BOOKED_DAYS = new Set([5, 6, 12, 13, 19, 21, 26, 27]);

const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'
];

/* ─────────────────────────────
   STATE
───────────────────────────── */
let currentModel = 0;
let bookingModel = 0;
let calY         = new Date().getFullYear();
let calM         = new Date().getMonth();
let availY       = new Date().getFullYear();
let availM       = new Date().getMonth();
let selectedDate = null;
let selectedTime = null;

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const $ = id => document.getElementById(id);

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
   RESERVE BUTTONS (one per slide)
───────────────────────────── */
document.querySelectorAll('.btn-reserve').forEach(btn => {
  btn.addEventListener('click', () => {
    bookingModel = +(btn.dataset.model ?? currentModel);
    openModal();
  });
});

/* ─────────────────────────────
   CALENDAR BUILDER
───────────────────────────── */
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function buildCal(gridId, year, month, interactive, selDate) {
  const grid  = $(gridId);
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
    const isBooked = BOOKED_DAYS.has(d);
    const dateStr  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isSel    = interactive && selDate === dateStr;

    let cls = 'cal-d';
    if (isSel)         cls += ' cal-d--sel';
    else if (isToday)  cls += ' cal-d--today';
    else if (isPast)   cls += ' cal-d--off';
    else if (isBooked) cls += ' cal-d--booked';

    const data = interactive && !isPast && !isBooked ? `data-date="${dateStr}"` : '';
    html += `<div class="${cls}" ${data}>${d}</div>`;
  }

  grid.innerHTML = html;

  if (interactive) {
    grid.querySelectorAll('.cal-d[data-date]').forEach(el => {
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
const steps   = ['step1', 'step2', 'step3', 'step4'].map($);
const psEls   = ['ps1', 'ps2', 'ps3'].map($);

function openModal() {
  $('modalModelName').textContent = MODELS[bookingModel].name;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
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
  overlay.setAttribute('aria-hidden', 'true');
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
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^\w/, c => c.toUpperCase());
  goStep(2);
});

document.querySelectorAll('.tslot').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedTime = btn.dataset.t;
    document.querySelectorAll('.tslot').forEach(t => t.classList.remove('sel'));
    btn.classList.add('sel');
    $('toStep3').disabled = false;
  });
});

$('toStep3').addEventListener('click', () => {
  const m  = MODELS[bookingModel];
  const d  = new Date(selectedDate + 'T12:00:00');
  const ds = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('recap').innerHTML = `<strong>${m.name}</strong><br>${ds} à ${selectedTime} — ${m.price}/h`;
  goStep(3);
});

$('back1').addEventListener('click', () => goStep(1));
$('back2').addEventListener('click', () => goStep(2));

$('submitBtn').addEventListener('click', async function () {
  const name  = $('fName').value.trim();
  const email = $('fEmail').value.trim();
  [$('fName'), $('fEmail')].forEach(f => { f.style.borderColor = f.value.trim() ? '' : '#FF3B30'; });
  if (!name || !email) return;
  this.disabled = true;
  this.textContent = 'Envoi…';
  await new Promise(r => setTimeout(r, 1400));
  goStep(4);
});

$('doneBtn').addEventListener('click', () => {
  closeModal();
  ['fName', 'fPhone', 'fEmail', 'fMsg'].forEach(id => { $(id).value = ''; });
  const sb = $('submitBtn');
  sb.disabled = false;
  sb.textContent = 'Envoyer ma demande';
  ['fName', 'fEmail'].forEach(id => { $(id).style.borderColor = ''; });
});

/* ─────────────────────────────
   AVAILABILITY CALENDAR
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

/* ══════════════════════════════════════════════════════
   JETSKI'N ARCACHON — script.js
   ══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────
   MODEL DATA
───────────────────────────────────── */
const MODELS = [
  {
    id: 'gti',
    name: 'Sea-Doo GTI SE 130',
    tag: 'Idéal débutants',
    level: 'Débutant',
    levelPct: 33,
    desc: 'Le jet ski d\'initiation par excellence. Stable, maniable, et suffisamment puissant pour explorer le bassin en famille ou en duo. Parfait pour une première expérience.',
    power: '130',
    speed: '75',
    seats: '3',
    cyl: '1 630',
    startPrice: '110 €',
    imgClass: 'gti',
    modelShort: 'GTI SE 130',
  },
  {
    id: 'gtx',
    name: 'Sea-Doo GTX 230',
    tag: 'Le plus polyvalent',
    level: 'Intermédiaire',
    levelPct: 66,
    desc: 'La référence sport-loisir. Plus puissant et agile, il offre des sensations fortes tout en restant accessible. Idéal pour les pilotes ayant déjà quelques heures au guidon.',
    power: '230',
    speed: '95',
    seats: '3',
    cyl: '1 630',
    startPrice: '125 €',
    imgClass: 'gtx',
    modelShort: 'GTX 230',
  },
  {
    id: 'rxt',
    name: 'Sea-Doo RXT-X 300',
    tag: 'Maximum performance',
    level: 'Expert',
    levelPct: 100,
    desc: 'La bête de compétition. 300 chevaux, des reprises foudroyantes, et une tenue de cap chirurgicale. Réservé aux pilotes expérimentés en quête de sensations extrêmes.',
    power: '300',
    speed: '110',
    seats: '3',
    cyl: '1 630',
    startPrice: '140 €',
    imgClass: 'rxt',
    modelShort: 'RXT-X 300',
  },
];

/* ─────────────────────────────────────
   ELEMENTS
───────────────────────────────────── */
const nav           = document.getElementById('nav');
const navBurger     = document.getElementById('navBurger');
const mobileMenu    = document.getElementById('mobileMenu');
const modelTabs     = document.querySelectorAll('.model-tab');
const photoPlc      = document.getElementById('photoPlaceholder');
const modelPill     = document.getElementById('modelPill');
const modelFullname = document.getElementById('modelFullname');
const modelLevelTag = document.getElementById('modelLevelTag');
const modelDesc     = document.getElementById('modelDesc');
const specPower     = document.getElementById('specPower');
const specSpeed     = document.getElementById('specSpeed');
const specSeats     = document.getElementById('specSeats');
const specCyl       = document.getElementById('specCyl');
const levelFill     = document.getElementById('levelFill');
const levelText     = document.getElementById('levelText');
const mpVal         = document.querySelector('.mp-val');
const photoName     = document.getElementById('photoModelName');
const fmodel        = document.getElementById('fmodel');
const contactForm   = document.getElementById('contactForm');
const submitBtn     = document.getElementById('submitBtn');
const submitText    = document.getElementById('submitText');
const angleBtns     = document.querySelectorAll('.angle-btn');

let currentModel = 0;
let isAnimating  = false;

/* ─────────────────────────────────────
   NAV SCROLL
───────────────────────────────────── */
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 50);
}, { passive: true });

/* ─────────────────────────────────────
   MOBILE MENU
───────────────────────────────────── */
navBurger.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  mobileMenu.style.display = open ? 'flex' : 'none';
  // Animate burger
  navBurger.querySelectorAll('span')[0].style.transform = open ? 'rotate(45deg) translate(5px,5px)' : '';
  navBurger.querySelectorAll('span')[1].style.transform = open ? 'rotate(-45deg) translate(5px,-5px)' : '';
});

mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    mobileMenu.style.display = 'none';
    navBurger.querySelectorAll('span')[0].style.transform = '';
    navBurger.querySelectorAll('span')[1].style.transform = '';
  });
});

/* ─────────────────────────────────────
   MODEL SWITCHER
───────────────────────────────────── */
function switchModel(index) {
  if (index === currentModel || isAnimating) return;
  isAnimating = true;
  currentModel = index;

  const m = MODELS[index];

  // Fade out photo
  const photo = document.getElementById('modelPhoto');
  photo.style.opacity = '0';
  photo.style.transform = 'scale(0.97)';

  setTimeout(() => {
    // Update image class
    photoPlc.className = `photo-placeholder ${m.imgClass}`;
    photoName.textContent = m.modelShort;

    // Fade in
    photo.style.opacity = '1';
    photo.style.transform = 'scale(1)';
    photo.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  }, 200);

  // Update pill
  modelPill.textContent = m.tag;

  // Update text (with tiny stagger)
  setTimeout(() => {
    modelFullname.textContent = m.name;
    modelLevelTag.textContent = m.level;
    modelDesc.textContent     = m.desc;
  }, 80);

  // Animate spec numbers
  animateSpec(specPower, m.power);
  animateSpec(specSpeed, m.speed);
  animateSpec(specSeats, m.seats);
  specCyl.textContent = m.cyl;

  // Level bar
  levelFill.style.width = `${m.levelPct}%`;
  levelText.textContent = m.level;
  modelLevelTag.textContent = m.level;

  // Price
  if (mpVal) mpVal.textContent = m.startPrice;

  // Tabs
  modelTabs.forEach((tab, i) => tab.classList.toggle('active', i === index));

  // Pre-select in form
  if (fmodel) fmodel.value = m.id;

  setTimeout(() => { isAnimating = false; }, 500);
}

function animateSpec(el, target) {
  const numTarget = parseInt(target.replace(/\s/g, ''), 10);
  if (isNaN(numTarget)) { el.textContent = target; return; }

  const start = parseInt(el.textContent.replace(/\s/g, ''), 10) || 0;
  const dur   = 500;
  const begin = performance.now();

  function tick(now) {
    const p = Math.min((now - begin) / dur, 1);
    const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const cur   = Math.round(start + (numTarget - start) * eased);
    el.textContent = cur >= 1000 ? cur.toLocaleString('fr-FR') : cur;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

modelTabs.forEach((tab, i) => {
  tab.addEventListener('click', () => switchModel(i));
});

/* View angle buttons (cosmetic — swap for real images if available) */
angleBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    angleBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // For real implementation: update model image src based on btn.dataset.view
    const photo = document.getElementById('modelPhoto');
    photo.style.opacity = '0';
    photo.style.transform = 'scale(0.97)';
    setTimeout(() => {
      photo.style.opacity = '1';
      photo.style.transform = 'scale(1)';
      photo.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    }, 150);
  });
});

/* ─────────────────────────────────────
   "Réserver ce modèle" button pre-selects model in form
───────────────────────────────────── */
document.querySelectorAll('[href="#contact"]').forEach(link => {
  link.addEventListener('click', () => {
    // If click came from model section, pre-select current model
    if (link.id === 'modelReserveBtn' && fmodel) {
      fmodel.value = MODELS[currentModel].id;
    }
  });
});

/* ─────────────────────────────────────
   CONTACT FORM
───────────────────────────────────── */
// Set min date to today
const dateInput = document.getElementById('fdate');
if (dateInput) {
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
}

if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Basic validation
    const required = contactForm.querySelectorAll('[required]');
    let valid = true;
    required.forEach(field => {
      field.style.borderColor = '';
      if (!field.value.trim()) {
        field.style.borderColor = '#F44336';
        valid = false;
      }
    });
    if (!valid) return;

    // Submit state
    submitBtn.disabled = true;
    submitText.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      Envoi en cours…
    `;

    // Simulate send (replace with actual fetch to your backend / Formspree / etc.)
    await new Promise(r => setTimeout(r, 1600));

    submitBtn.style.background = '#10B981';
    submitText.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      Demande envoyée !
    `;

    setTimeout(() => {
      contactForm.reset();
      submitBtn.disabled = false;
      submitBtn.style.background = '';
      submitText.textContent = 'Envoyer ma demande';
    }, 5000);
  });
}

/* ─────────────────────────────────────
   SCROLL REVEAL (Intersection Observer)
───────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      // Stagger siblings
      const siblings = Array.from(entry.target.parentElement.querySelectorAll('.reveal'));
      const idx      = siblings.indexOf(entry.target);
      entry.target.style.transitionDelay = `${idx * 0.06}s`;
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach(el => revealObs.observe(el));

/* ─────────────────────────────────────
   SMOOTH ANCHOR SCROLL
───────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = nav.offsetHeight + 16;
    const top    = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ─────────────────────────────────────
   CSS: spinner keyframe (injected)
───────────────────────────────────── */
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  #modelPhoto {
    transition: opacity 0.35s ease, transform 0.35s ease;
  }
`;
document.head.appendChild(style);

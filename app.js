// ------- Front-only version: verdict + simulated poll with animation -------

const ui = {
  t: {},
  lang: detectLang(['en','fr','es','de','ar']),
  dir: (l) => (l === 'ar' ? 'rtl' : 'ltr'),
};
document.documentElement.lang = ui.lang;
document.body.dir = ui.dir(ui.lang);

// Elements
const q = document.getElementById('q');
const askBtn = document.getElementById('ask');
const resultBox = document.getElementById('result');
const verdictEl = document.getElementById('verdict');
const explEl = document.getElementById('explanation');
const agreeBtn = document.getElementById('agree');
const disagreeBtn = document.getElementById('disagree');
const barFill = document.getElementById('bar-fill');
const statsEl = document.getElementById('stats');
const toast = document.getElementById('toast');

// Init i18n
await loadI18n(ui.lang);
setStaticText();

askBtn.addEventListener('click', submit);
q.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
agreeBtn.addEventListener('click', () => onVote('agree'));
disagreeBtn.addEventListener('click', () => onVote('disagree'));

// State (front-only)
let currentQuestion = '';
let currentVerdict = '';
let currentPct = 0;

// ---------- Actions ----------
async function submit() {
  const raw = (q.value || '').trim();
  if (!raw) { alert(examplePrompt(ui.lang)); return; }
  const question = normalizeQuestion(raw, ui.lang);

  lock(true);
  resultBox.classList.remove('hidden');
  verdictEl.textContent = '…';
  verdictEl.className = 'badge';
  explEl.textContent = '';

  try {
    // Appel IA (vraie API)
    const r = await fetch('/api/ask', {
      method: 'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ question, lang: ui.lang }),
    });
    if (!r.ok) throw new Error('AI error');
    const data = await r.json();

    currentQuestion = question;
    currentVerdict = data.verdict;

    // verdict + couleurs
    verdictEl.textContent = localizeVerdict(data.verdict, ui.lang);
    verdictEl.classList.add(cssClassForVerdict(data.verdict));
    explEl.textContent = data.explanation;

    // Simule % d'accord selon verdict + mots-clés, puis anime
    const pct = simulateAgreePct(question, data.verdict);
    animateBarTo(pct);
    currentPct = pct;
    renderStats(pct);

    // activer votes
    agreeBtn.disabled = false;
    disagreeBtn.disabled = false;

    // stocker localement le % pour cette question (pour cohérence si on reclique)
    localStorage.setItem(cacheKey(question), String(pct));

  } catch (e) {
    verdictEl.textContent = 'Error';
    explEl.textContent = 'Server error. Please try again.';
  } finally {
    lock(false);
  }
}

function onVote(which) {
  if (!currentQuestion) return;

  // petit nudge visuel: +1% si agree, -1% si disagree (dans des bornes)
  let pct = Number(localStorage.getItem(cacheKey(currentQuestion))) || currentPct || 50;
  if (which === 'agree') pct = Math.min(99, pct + randInt(1,2));
  else pct = Math.max(1, pct - randInt(1,2));

  animateBarTo(pct);
  currentPct = pct;
  localStorage.setItem(cacheKey(currentQuestion), String(pct));
  renderStats(pct);

  showToast(tr('vote_recorded', 'Your vote has been counted.'));
}

// ---------- Simulation logic ----------
function simulateAgreePct(question, verdict) {
  const s = (question || '').toLowerCase();

  // mots qui tirent quasi-unanimité "haram"
  const hardHaram = ['pork','ham','alcohol','beer','wine','riba','usury','interest','gambling','porn'];
  // mots halal évidents
  const hardHalal = ['water','dates','honey','zakat','charity','fasting','marriage','prayer','reading quran'];

  // ranges % selon verdict
  let range = [55, 75]; // par défaut "To be nuanced"
  if (verdict === 'Haram') range = [80, 96];
  if (verdict === 'Halal') range = [78, 95];

  // renforce selon mots-clés
  if (verdict === 'Haram' && hardHaram.some(w => s.includes(w))) range = [92, 98];
  if (verdict === 'Halal' && hardHalal.some(w => s.includes(w))) range = [90, 98];

  // petite variabilité
  let pct = randInt(range[0], range[1]);

  // cohérence par langue (rien à faire, juste commentaire)
  return pct;
}

// ---------- UI helpers ----------
function renderStats(pct) {
  // Texte "xx% of users agree with is-it-halal.com"
  const msgByLang = {
    en: `${pct}% of users agree with is-it-halal.com`,
    fr: `${pct}% des utilisateurs sont d'accord avec is-it-halal.com`,
    es: `${pct}% de usuarios están de acuerdo con is-it-halal.com`,
    de: `${pct}% der Nutzer stimmen is-it-halal.com zu`,
    ar: `${pct}% من المستخدمين يوافقون is-it-halal.com`,
  };
  statsEl.textContent = msgByLang[ui.lang] || msgByLang.en;
}

function animateBarTo(target) {
  const start = parseInt(barFill.style.width || '0', 10);
  const end = Number(target);
  const dur = 600; // ms
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    const curr = Math.round(start + (end - start) * easeOutCubic(p));
    barFill.style.width = curr + '%';
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }

function localizeVerdict(v, lang) {
  if (v === 'Halal' || v === 'Haram') return v;
  const byLang = { fr:'À nuancer', es:'A matizar', de:'Nuanciert zu betrachten', ar:'بحاجة إلى تفصيل', en:'To be nuanced' };
  return byLang[lang] || byLang.en;
}
function cssClassForVerdict(v) {
  switch ((v||'').toLowerCase()) {
    case 'halal': return 'badge--halal';
    case 'haram': return 'badge--haram';
    default: return 'badge--nuanced';
  }
}

function lock(on){ askBtn.disabled = on; agreeBtn.disabled = on; disagreeBtn.disabled = on; }

function detectLang(supported){ const cand=(navigator.language||'en').slice(0,2).toLowerCase(); return supported.includes(cand)?cand:'en'; }

async function loadI18n(lang) {
  try {
    const resp = await fetch(`/i18n/${lang}.json`, { cache:'no-store' });
    if (!resp.ok) throw 0;
    ui.t = await resp.json();
  } catch {
    const resp = await fetch(`/i18n/en.json`, { cache:'no-store' });
    ui.t = await resp.json();
  }
}
function setStaticText() {
  document.getElementById('ask').textContent = tr('ask','Ask');
  document.getElementById('agree').textContent = tr('agree','Agree');
  document.getElementById('disagree').textContent = tr('disagree','Disagree');
  q.placeholder = tr('placeholder','Is eating pork halal?');

  document.getElementById('disclaimer').innerHTML = tr(
    'disclaimer_html',
    'This tool offers a simplified classification and is <strong>not</strong> a fatwa. Rulings may vary by school, context and scholar. Always consult qualified scholars for religious guidance.'
  );
}
function tr(key, fallback){ return ui.t[key] || fallback; }

function examplePrompt(lang) {
  const ex = {
    en:"Please type a full question, e.g. 'Is reading the Bible halal?'",
    fr:"Merci d’écrire une question complète, ex. « Lire la Bible est-il halal ? »",
    es:"Escribe una pregunta completa, p. ej. «¿Leer la Biblia es halal?»",
    de:"Bitte eine vollständige Frage eingeben, z. B. „Ist das Lesen der Bibel halal?“",
    ar:"يرجى كتابة سؤال كامل، مثل: «هل قراءة الإنجيل حلال؟»",
  };
  return ex[lang] || ex.en;
}
function normalizeQuestion(input, lang) {
  const s = input.trim().replace(/\s+/g,' ');
  const hasQM = /\?/.test(s);
  const hasVerbLike = /\b(is|are|est|est-ce|es|ist|هل)\b/i.test(s);
  if (hasQM && hasVerbLike) return s;

  const T = {
    en:(x)=> (/\?$/.test(x) ? x : `Is ${x} halal?`),
    fr:(x)=> (/\?$/.test(x) ? x : `Est-ce que ${x} est halal ?`),
    es:(x)=> (/\?$/.test(x) ? x : `¿Es ${x} halal?`),
    de:(x)=> (/\?$/.test(x) ? x : `Ist ${x} halal?`),
    ar:(x)=> (/\?$/.test(x) ? x : `هل ${x} حلال؟`),
  };
  const fn = T[ui.lang] || T.en;
  return fn(s.replace(/\?+$/,''));
}

// utils
function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function cacheKey(q){ return 'simvote:'+q.toLowerCase(); }

// toast
function showToast(text){
  toast.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), 1400);
}

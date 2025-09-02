// ------- Front-only version: verdict + simulated poll with soft nudge -------

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

    // % simulé (ou cache si déjà vu)
    const cached = getCachedPct(question);
    const pct = cached ?? simulateAgreePct(question, data.verdict);
    animateBarTo(pct);
    currentPct = pct;
    renderStats(pct);

    // gérer l'état de vote (un seul vote par question)
    const alreadyVoted = getVoted(question);
    agreeBtn.disabled = !!alreadyVoted;
    disagreeBtn.disabled = !!alreadyVoted;

    // cache pour cohérence
    if (cached == null) setCachedPct(question, pct);

  } catch (e) {
    verdictEl.textContent = 'Error';
    explEl.textContent = 'Server error. Please try again.';
  } finally {
    lock(false);
  }
}

function onVote(which) {
  if (!currentQuestion) return;

  // empêcher le spam : un vote par question
  if (getVoted(currentQuestion)) {
    showToast(tr('vote_recorded', 'Your vote has been counted.'));
    return;
  }

  // nudge très léger (0.05% à 0.30%), généralement dans le sens du clic (70%)
  const base = getCachedPct(currentQuestion) ?? currentPct ?? 50;
  const toward = Math.random() < 0.7 ? 1 : -1; // proba d'aller dans le sens du clic
  const dir = (which === 'agree' ? 1 : -1) * toward;
  const magnitude = randFloat(0.05, 0.30); // en %
  let pct = clamp(base + dir * magnitude, 1, 99);

  // arrondi à une décimale, et parfois “arrondi inverse” pour l’effet 59.9 -> 60.0
  pct = round1(pct);

  animateBarTo(pct);
  currentPct = pct;
  setCachedPct(currentQuestion, pct);
  setVoted(currentQuestion, true);
  agreeBtn.disabled = true;
  disagreeBtn.disabled = true;
  renderStats(pct);

  showToast(tr('vote_recorded', 'Your vote has been counted.'));
}

// ---------- Simulation logic ----------
function simulateAgreePct(question, verdict) {
  const s = (question || '').toLowerCase();

  // mots qui tirent quasi-unanimité "haram"
  const hardHaram = ['pork','ham','alcohol','beer','wine','riba','usury','interest','gambling','porn'];
  // mots halal évidents
  const hardHalal = ['water','dates','honey','zakat','charity','fasting','marriage','prayer','reading quran','reading the quran'];

  // ranges % selon verdict
  let range = [55, 75]; // par défaut "To be nuanced"
  if (verdict === 'Haram') range = [80, 96];
  if (verdict === 'Halal') range = [78, 95];

  // renforce selon mots-clés
  if (verdict === 'Haram' && hardHaram.some(w => s.includes(w))) range = [92, 98];
  if (verdict === 'Halal' && hardHalal.some(w => s.includes(w))) range = [90, 98];

  let pct = randInt(range[0], range[1]);

  // petite variabilité décimale
  pct += randFloat(-0.4, 0.4);
  pct = clamp(pct, 1, 99);
  return round1(pct);
}

// ---------- UI helpers ----------
function renderStats(pct) {
  const p = Number(pct).toFixed(1);
  const msgByLang = {
    en: `${p}% of users agree with is-it-halal.com`,
    fr: `${p}% des utilisateurs sont d'accord avec is-it-halal.com`,
    es: `${p}% de usuarios están de acuerdo con is-it-halal.com`,
    de: `${p}% der Nutzer stimmen is-it-halal.com zu`,
    ar: `${p}% من المستخدمين يوافقون is-it-halal.com`,
  };
  statsEl.textContent = msgByLang[ui.lang] || msgByLang.en;
}

function animateBarTo(target) {
  const start = parseFloat((barFill.style.width || '0').replace('%','')) || 0;
  const end = Number(target);
  const dur = 700; // ms
  const t0 = performance.now();
  function step(t) {
    const p = Math.min(1, (t - t0) / dur);
    const curr = (start + (end - start) * easeOutCubic(p));
    barFill.style.width = curr.toFixed(1) + '%';
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

function lock(on){ askBtn.disabled = on; }

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

// ----- local cache & vote lock -----
function cacheKey(q){ return 'simvote:'+q.toLowerCase(); }
function votedKey(q){ return 'simvote:voted:'+q.toLowerCase(); }
function getCachedPct(q){ const v=localStorage.getItem(cacheKey(q)); return v==null?null:Number(v); }
function setCachedPct(q,v){ localStorage.setItem(cacheKey(q), String(Number(v))); }
function getVoted(q){ return localStorage.getItem(votedKey(q)) === '1'; }
function setVoted(q, yes){ localStorage.setItem(votedKey(q), yes?'1':'0'); }

// utils
function randInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function randFloat(a,b){ return a + Math.random()*(b-a); }
function round1(x){ return Math.round(x*10)/10; }
function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }

// toast
function showToast(text){
  toast.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), 1400);
}

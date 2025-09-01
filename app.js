// -------- is-it-halal.com — UI (Ask + Verdict color + Votes + i18n + localized disclaimer) --------

const ui = {
  t: {},
  lang: detectLang(['en', 'fr', 'es', 'de', 'ar']),
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

// Init
await loadI18n(ui.lang);
setStaticText();
askBtn.addEventListener('click', submit);
q.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
agreeBtn.addEventListener('click', () => vote('agree'));
disagreeBtn.addEventListener('click', () => vote('disagree'));

// ----- Actions -----

async function submit() {
  let raw = (q.value || '').trim();
  if (!raw) {
    alert(examplePrompt(ui.lang));
    return;
  }

  // ex. "reading bible" -> "Is reading bible halal?" (selon la langue)
  const question = normalizeQuestion(raw, ui.lang);

  lock(true);
  resultBox.classList.remove('hidden');
  verdictEl.textContent = '…';
  verdictEl.className = 'badge'; // reset couleurs
  explEl.textContent = '';

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, lang: ui.lang }),
    });

    if (!res.ok) {
      verdictEl.textContent = 'Error';
      explEl.textContent = 'Server error. Check API key or try again.';
      return;
    }

    const data = await res.json();
    if (!data?.verdict || !data?.explanation) {
      verdictEl.textContent = 'Error';
      explEl.textContent = 'Bad response from server.';
      return;
    }

    // Affiche le verdict + couleurs
    verdictEl.textContent = localizeVerdict(data.verdict, ui.lang);
    verdictEl.classList.add(cssClassForVerdict(data.verdict));

    explEl.textContent = data.explanation;

    // Stats initiales + activer votes
    await refreshStats(question);
    agreeBtn.disabled = false;
    disagreeBtn.disabled = false;
    agreeBtn.dataset.q = question;
    disagreeBtn.dataset.q = question;

  } catch (e) {
    verdictEl.textContent = 'Error';
    explEl.textContent = 'Network error. Please try again.';
  } finally {
    lock(false);
  }
}

async function vote(which) {
  const question = (which === 'agree' ? agreeBtn.dataset.q : disagreeBtn.dataset.q) || (q.value || '').trim();
  if (!question) return;

  lock(true);
  try {
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, vote: which }),
    });
    await refreshStats(question);
  } catch {} finally {
    lock(false);
  }
}

async function refreshStats(question) {
  const res = await fetch('/api/stats?q=' + encodeURIComponent(question));
  if (!res.ok) {
    statsEl.textContent = 'No stats available';
    barFill.style.width = '0%';
    return;
  }
  const { agree = 0, disagree = 0 } = await res.json();
  const total = agree + disagree;
  const pct = total ? Math.round((agree / total) * 100) : 0;

  barFill.style.width = pct + '%';
  statsEl.textContent = total
    ? `${pct}% of users agree with is-it-halal.com • ${agree} agree • ${disagree} disagree`
    : `Be the first to vote`;
}

// ----- Helpers -----

function localizeVerdict(v, lang) {
  if (v === 'Halal' || v === 'Haram') return v;
  const byLang = { fr: 'À nuancer', es: 'A matizar', de: 'Nuanciert zu betrachten', ar: 'بحاجة إلى تفصيل', en: 'To be nuanced' };
  return byLang[lang] || byLang.en;
}
function cssClassForVerdict(v) {
  switch ((v || '').toLowerCase()) {
    case 'halal': return 'badge--halal';
    case 'haram': return 'badge--haram';
    default:      return 'badge--nuanced';
  }
}

function lock(on) { askBtn.disabled = on; agreeBtn.disabled = on; disagreeBtn.disabled = on; }

function detectLang(supported) {
  const cand = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return supported.includes(cand) ? cand : 'en';
}

async function loadI18n(lang) {
  try {
    const resp = await fetch(`/i18n/${lang}.json`, { cache: 'no-store' });
    if (!resp.ok) throw new Error('missing lang');
    ui.t = await resp.json();
  } catch {
    const resp = await fetch(`/i18n/en.json`, { cache: 'no-store' });
    ui.t = await resp.json();
  }
}

function setStaticText() {
  document.getElementById('ask').textContent = tr('ask', 'Ask');
  document.getElementById('agree').textContent = tr('agree', 'Agree');
  document.getElementById('disagree').textContent = tr('disagree', 'Disagree');
  q.placeholder = tr('placeholder', 'Is eating pork halal?');

  // Disclaimer localisé (HTML autorisé)
  const d = document.getElementById('disclaimer');
  d.innerHTML

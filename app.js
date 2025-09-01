// -------- is-it-halal.com — UI finale (Ask + Verdict + Votes) --------

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

  // transforme "reading bible" -> "Is reading bible halal?" selon la langue
  const question = normalizeQuestion(raw, ui.lang);

  lock(true);
  resultBox.classList.remove('hidden');
  verdictEl.textContent = '…';
  explEl.textContent = '';

  try {
    // Appel IA
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

    // Affiche le verdict final
    verdictEl.textContent = data.verdict;                  // "Halal" | "Haram" | "To be nuanced"
    explEl.textContent = data.explanation;                 // explication courte

    // Stats initiales pour cette question
    await refreshStats(question);

    // Active les votes maintenant que la question est définie
    agreeBtn.disabled = false;
    disagreeBtn.disabled = false;

    // Mémorise la question sur l'élément pour réutiliser lors du vote
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
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, vote: which }),
    });
    // Même si KV n'est pas branché, on ne bloque pas l'UI
    await refreshStats(question);
  } catch (e) {
    // ignore pour l'utilisateur; la barre restera inchangée
  } finally {
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

function lock(on) {
  askBtn.disabled = on;
  agreeBtn.disabled = on;
  disagreeBtn.disabled = on;
}

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
}

function tr(key, fallback) { return ui.t[key] || fallback; }

function examplePrompt(lang) {
  const ex = {
    en: "Please type a full question, e.g. 'Is reading the Bible halal?'",
  };
  return ex[lang] || ex.en;
}

function normalizeQuestion(input, lang) {
  const s = input.trim().replace(/\s+/g, ' ');
  const hasQM = /\?/.test(s);
  const hasVerbLike = /\b(is|are|est|est-ce|es|ist|هل)\b/i.test(s);

  if (hasQM && hasVerbLike) return s;

  const T = {
    en: (x) => (x.toLowerCase().startsWith('is ') ? cap(x) : `Is ${x} halal?`),
    fr: (x) => (/\?$/.test(x) ? x : `Est-ce que ${x} est halal ?`),
    es: (x) => (/\?$/.test(x) ? x : `¿Es ${x} halal?`),
    de: (x) => (/\?$/.test(x) ? x : `Ist ${x} halal?`),
    ar: (x) => (/\?$/.test(x) ? x : `هل ${x} حلال؟`),
  };

  if (/^\s*is\s.+halal/i.test(s)) return s.endsWith('?') ? s : s + '?';
  const fn = T[lang] || T.en;
  return fn(stripTrailingQM(s));
}

function stripTrailingQM(s) { return s.replace(/\?+$/, '').trim(); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

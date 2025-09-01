// ---------- Minimal UI + robust ask() with auto-question builder + clear errors ----------

const ui = {
  t: {},
  lang: detectLang(['en', 'fr', 'es', 'de', 'ar']),
  dir: (l) => (l === 'ar' ? 'rtl' : 'ltr'),
};

document.documentElement.lang = ui.lang;
document.body.dir = ui.dir(ui.lang);

await loadI18n(ui.lang);

const q = document.getElementById('q');
const askBtn = document.getElementById('ask');
const resultBox = document.getElementById('result');
const verdictEl = document.getElementById('verdict');
const explEl = document.getElementById('explanation');
const agreeBtn = document.getElementById('agree');
const disagreeBtn = document.getElementById('disagree');
const barFill = document.getElementById('bar-fill');
const statsEl = document.getElementById('stats');

setStaticText();

askBtn.addEventListener('click', submit);
q.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
agreeBtn.addEventListener('click', () => vote('agree'));
disagreeBtn.addEventListener('click', () => vote('disagree'));

function log(...args) {
  // Simple console tag to help you debug in DevTools
  console.log('[IS-IT-HALAL]', ...args);
}

async function submit() {
  // 1) Prepare question
  let raw = (q.value || '').trim();
  log('RAW INPUT:', raw);

  if (!raw) {
    alert(examplePrompt(ui.lang));
    return;
  }

  const question = normalizeQuestion(raw, ui.lang);
  log('NORMALIZED QUESTION:', question);

  // 2) UI lock + show result box early
  lock(true);
  resultBox.classList.remove('hidden');
  verdictEl.textContent = '…';
  explEl.textContent = '';

  try {
    // 3) Call API
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, lang: ui.lang }),
    });

    if (!res.ok) {
      const txt = await safeText(res);
      log('ASK_ERROR_STATUS', res.status, txt);
      verdictEl.textContent = 'Error';
      explEl.textContent = 'Server error. Check API key or try again.';
      return;
    }

    const data = await res.json();
    log('ASK_RESPONSE', data);

    if (!data || !data.verdict || !data.explanation) {
      verdictEl.textContent = 'Error';
      explEl.textContent = 'Bad response from server.';
      return;
    }

    verdictEl.textContent = data.verdict;
    explEl.textContent = data.explanation;

    // 4) Load current stats for this exact question (raw text used for keying votes)
    await refreshStats(question);
  } catch (e) {
    log('ASK_EXCEPTION', e);
    verdictEl.textContent = 'Error';
    explEl.textContent = 'Network error. Please try again.';
  } finally {
    lock(false);
  }
}

async function vote(which) {
  const raw = (q.value || '').trim();
  if (!raw) return;

  const question = normalizeQuestion(raw, ui.lang);
  lock(true);
  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, vote: which }),
    });
    if (!res.ok) {
      log('VOTE_ERROR_STATUS', res.status, await safeText(res));
      return;
    }
    await refreshStats(question);
  } catch (e) {
    log('VOTE_EXCEPTION', e);
  } finally {
    lock(false);
  }
}

async function refreshStats(question) {
  const res = await fetch('/api/stats?q=' + encodeURIComponent(question));
  if (!res.ok) {
    log('STATS_ERROR_STATUS', res.status, await safeText(res));
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

function tr(key, fallback) {
  return ui.t[key] || fallback;
}

function examplePrompt(lang) {
  const ex = {
    en: "Please type a full question, e.g. 'Is reading the Bible halal?'",
    fr: "Merci d’écrire une question complète, ex. « Lire la Bible est-il halal ? »",
    es: "Escribe una pregunta completa, p. ej. «¿Leer la Biblia es halal?»",
    de: "Bitte eine vollständige Frage eingeben, z. B. „Ist das Lesen der Bibel halal?“",
    ar: "يرجى كتابة سؤال كامل، مثل: «هل قراءة الإنجيل حلال؟»",
  };
  return ex[lang] || ex.en;
}

// Build a proper question from fragments like "Reading the Bible"
function normalizeQuestion(input, lang) {
  const s = input.trim().replace(/\s+/g, ' ');
  const hasQM = /\?/.test(s);
  const hasVerbLike = /\b(is|are|est|est-ce|es|ist|هل)\b/i.test(s);

  if (hasQM && hasVerbLike) return s;

  // Simple language templates
  const T = {
    en: (x) => (x.toLowerCase().startsWith('is ') ? cap(x) : `Is ${x} halal?`),
    fr: (x) => (/\?$/.test(x) ? x : `Est-ce que ${x} est halal ?`),
    es: (x) => (/\?$/.test(x) ? x : `¿Es ${x} halal?`),
    de: (x) => (/\?$/.test(x) ? x : `Ist ${x} halal?`),
    ar: (x) => (/\?$/.test(x) ? x : `هل ${x} حلال؟`),
  };

  // If the user typed already something like "Is X halal"
  if (/^\s*is\s.+halal/i.test(s)) return s.endsWith('?') ? s : s + '?';

  const fn = T[lang] || T.en;
  return fn(stripTrailingQM(s));
}

function stripTrailingQM(s) {
  return s.replace(/\?+$/,'').trim();
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function safeText(res) {
  try { return await res.text(); } catch { return ''; }
}

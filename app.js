// Minimal i18n loader + UI actions
const ui = {
  t: {},
  lang: detectLang(['en','fr','es','de','ar']),
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

async function submit() {
  const question = (q.value || '').trim();
  if (!question) return;

  lock(true);
  verdictEl.textContent = '…';
  explEl.textContent = '';
  resultBox.classList.remove('hidden');

  try {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ question, lang: ui.lang })
    });
    const data = await res.json();

    verdictEl.textContent = data.verdict;
    explEl.textContent = data.explanation;

    // Load current stats
    await refreshStats(question);
    lock(false);
  } catch (e) {
    verdictEl.textContent = 'Error';
    explEl.textContent = 'Try again later.';
    lock(false);
  }
}

async function vote(which) {
  const question = (q.value || '').trim();
  if (!question) return;
  lock(true);
  try {
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ question, vote: which })
    });
    await refreshStats(question);
  } finally {
    lock(false);
  }
}

async function refreshStats(question) {
  const res = await fetch('/api/stats?q=' + encodeURIComponent(question));
  const { agree=0, disagree=0 } = await res.json();
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
  const cand = (navigator.language || 'en').slice(0,2).toLowerCase();
  return supported.includes(cand) ? cand : 'en';
}

async function loadI18n(lang) {
  try {
    const resp = await fetch(`/i18n/${lang}.json`);
    if (!resp.ok) throw new Error('missing lang');
    ui.t = await resp.json();
  } catch (_) {
    const resp = await fetch(`/i18n/en.json`);
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

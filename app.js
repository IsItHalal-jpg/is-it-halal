// VERSION DIAGNOSTIC — vérifie que le clic marche et que /api/stats répond

const q = document.getElementById('q');
const askBtn = document.getElementById('ask');
const resultBox = document.getElementById('result');
const verdictEl = document.getElementById('verdict');
const explEl = document.getElementById('explanation');
const statsEl = document.getElementById('stats');
const barFill = document.getElementById('bar-fill');
const agreeBtn = document.getElementById('agree');
const disagreeBtn = document.getElementById('disagree');

console.log('[BOOT] app.js loaded');

askBtn.addEventListener('click', async () => {
  console.log('[CLICK] Ask clicked');
  resultBox.classList.remove('hidden');
  verdictEl.textContent = 'Clicked!';
  explEl.textContent = 'Trying /api/stats…';
  askBtn.disabled = true;

  try {
    const question = (q.value || 'ping').trim() || 'ping';
    const url = '/api/stats?q=' + encodeURIComponent(question);
    const res = await fetch(url);
    const txt = await res.text();
    if (res.ok) {
      verdictEl.textContent = 'Stats OK';
      explEl.textContent = txt;
    } else {
      verdictEl.textContent = 'Stats ERROR ' + res.status;
      explEl.textContent = txt;
    }
  } catch (e) {
    verdictEl.textContent = 'Network ERROR';
    explEl.textContent = String(e);
  } finally {
    askBtn.disabled = false;
  }
});

// On désactive les votes dans cette version test
agreeBtn.disabled = true;
disagreeBtn.disabled = true;
barFill.style.width = '0%';
statsEl.textContent = '';

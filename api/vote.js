// /api/vote.js — Upstash Redis (REST)
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    if (!URL || !TOKEN) throw new Error('Missing Upstash env');

    const body = await readJson(req);
    const question = (body?.question || '').trim();
    const vote = body?.vote === 'agree' ? 'agree'
               : body?.vote === 'disagree' ? 'disagree' : null;

    if (!question || !vote) return res.status(400).json({ error: 'Bad input' });

    const key = 'votes:' + slugify(question);

    // HINCRBY key field 1
    await fetch(`${URL}/hincrby/${encodeURIComponent(key)}/${vote}/1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    // Retourne les compteurs à jour
    const r = await fetch(`${URL}/hgetall/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await r.json();
    const obj = arrayToHash(data?.result);

    res.status(200).json({
      agree: Number(obj.agree ?? 0),
      disagree: Number(obj.disagree ?? 0),
    });
  } catch (e) {
    res.status(503).json({ error: 'Upstash not configured' });
  }
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
  });
}

function arrayToHash(arr) {
  if (!Array.isArray(arr)) return {};
  const out = {};
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

function slugify(s) {
  return s.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 160);
}

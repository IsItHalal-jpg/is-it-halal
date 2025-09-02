// /api/stats.js — Upstash Redis (REST)
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const q = (req.query?.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing q' });

  const key = 'votes:' + slugify(q);

  try {
    if (!URL || !TOKEN) throw new Error('Missing Upstash env');

    // HGETALL key
    const r = await fetch(`${URL}/hgetall/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await r.json();
    // data.result = ["agree","1","disagree","2"] ou null
    const obj = arrayToHash(data?.result);

    res.status(200).json({
      agree: Number(obj.agree ?? 0),
      disagree: Number(obj.disagree ?? 0),
    });
  } catch {
    // En cas d’erreur, ne casse pas l’UI
    res.status(200).json({ agree: 0, disagree: 0 });
  }
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

// /api/stats.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const q = (req.query?.q || '').toString().trim();
  if (!q) return res.status(400).json({ error: 'Missing q' });

  const key = 'votes:' + slugify(q);
  try {
    const data = await kv.hgetall(key);
    res.status(200).json({
      agree: Number(data?.agree ?? 0),
      disagree: Number(data?.disagree ?? 0),
    });
  } catch {
    // Si KV n'est pas encore connecté, on renvoie 0/0 pour éviter l'erreur
    res.status(200).json({ agree: 0, disagree: 0 });
  }
}

function slugify(s) {
  return s.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 160);
}

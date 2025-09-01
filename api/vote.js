// /api/vote.js
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = await readJson(req);
  const question = (body?.question || '').trim();
  const vote = body?.vote === 'agree' ? 'agree'
             : body?.vote === 'disagree' ? 'disagree' : null;

  if (!question || !vote) return res.status(400).json({ error: 'Bad input' });

  const key = 'votes:' + slugify(question);
  try {
    await kv.hincrby(key, vote, 1);
    const tallies = await kv.hgetall(key);
    res.status(200).json({
      agree: Number(tallies?.agree ?? 0),
      disagree: Number(tallies?.disagree ?? 0),
    });
  } catch {
    res.status(503).json({ error: 'KV not configured' });
  }
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
  });
}
function slugify(s) {
  return s.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 160);
}

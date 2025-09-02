// /api/kv-debug.js — test Upstash: env + ping + set/get
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(req, res) {
  try {
    if (!URL || !TOKEN) {
      return res.status(200).json({ ok: false, step: "env", URL: !!URL, TOKEN: !!TOKEN });
    }
    // PING
    let ping;
    try {
      const r = await fetch(`${URL}/ping`, { headers: { Authorization: `Bearer ${TOKEN}` } });
      ping = await r.json(); // { result: "PONG" }
    } catch (e) {
      return res.status(200).json({ ok: false, step: "ping", error: String(e) });
    }
    // SET + GET
    const key = "kv-debug:test";
    const val = String(Date.now());
    try {
      const r1 = await fetch(`${URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const s1 = await r1.json();
      const r2 = await fetch(`${URL}/get/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const s2 = await r2.json();
      return res.status(200).json({ ok: true, step: "done", ping, set: s1, get: s2 });
    } catch (e) {
      return res.status(200).json({ ok: false, step: "set/get", error: String(e) });
    }
  } catch (e) {
    return res.status(200).json({ ok: false, step: "fatal", error: String(e) });
  }
}

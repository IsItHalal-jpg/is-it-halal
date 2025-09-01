// /api/debug.js — renvoie l'état de l'API OpenAI (clé, quota, etc.)
import OpenAI from "openai";

export default async function handler(req, res) {
  const hasKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!hasKey) {
    return res.status(200).json({ ok: false, reason: "NO_ENV_OPENAI_API_KEY" });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL });
    // Appel très simple pour tester la clé/billing
    const list = await client.models.list();
    return res.status(200).json({ ok: true, model, baseURL, models: (list?.data?.length ?? 0) });
  } catch (e) {
    const status = e?.status || e?.response?.status;
    const code = e?.code || e?.response?.data?.error?.code;
    const message = e?.message || e?.response?.data?.error?.message;
    return res.status(200).json({ ok: false, status, code, message });
  }
}

// /api/ask.js — version stable (Chat Completions JSON) + logs clairs
import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const body = await readJson(req);
  const question = (body?.question || "").trim();
  const lang = (body?.lang || "en").slice(0, 2);

  if (!process.env.OPENAI_API_KEY) {
    console.error("[ASK] Missing OPENAI_API_KEY");
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }
  if (!question) return res.status(400).json({ error: "Missing question" });

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: BASE_URL });

  try {
    const chat = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: "json_object" }, // force JSON
      messages: [
        {
          role: "system",
          content:
            "You are a concise halal/haram classifier. Output only valid JSON with keys verdict and explanation. " +
            'verdict ∈ {"Halal","Haram","To be nuanced"}. ' +
            "If opinions differ or context matters, choose 'To be nuanced'. " +
            "Keep explanation under 20 words, neutral, in the user's language."
        },
        { role: "user", content: `Question: ${question}\nLanguage code: ${lang}` }
      ]
    });

    const txt = chat.choices?.[0]?.message?.content || "";
    const json = safeParseJson(txt);
    if (!json?.verdict || !json?.explanation) throw new Error("Bad model output");

    return res.status(200).json(json);
  } catch (e) {
    const status = e?.status || e?.response?.status;
    const code = e?.code || e?.response?.data?.error?.code;
    const message = e?.message || e?.response?.data?.error?.message;
    console.error("[ASK] OpenAI error", { status, code, message });
    return res.status(500).json({ error: "AI error", status, code, message });
  }
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
  });
}

function safeParseJson(s) {
  try { return JSON.parse(s); } catch {
    const m = s?.match(/\{[\s\S]*\}$/);
    try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
  }
}

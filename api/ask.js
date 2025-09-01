// /api/ask.js
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = await readJson(req);
  const question = (body?.question || '').trim();
  const lang = (body?.lang || 'en').slice(0,2);
  if (!question) return res.status(400).json({ error: 'Missing question' });

  try {
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'HalalVerdict',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              verdict: { type: 'string', enum: ['Halal','Haram','To be nuanced'] },
              explanation: { type: 'string', maxLength: 200 }
            },
            required: ['verdict','explanation']
          }
        }
      },
      input: [
        {
          role: 'system',
          content:
            `You are a concise halal/haram classifier. Return ONLY JSON. ` +
            `If opinions differ or context matters: "To be nuanced". ` +
            `Else: "Halal" or "Haram". Explanation under 20 words, neutral, in user's language.`
        },
        {
          role: 'user',
          content:
            `Question: ${question}\n` +
            `Language code: ${lang}\n` +
            `Schema: { "verdict": "Halal|Haram|To be nuanced", "explanation": "string" }`
        }
      ]
    });

    const text = response.output_text ||
                 (response.output?.[0]?.content?.[0]?.text ?? '') ||
                 (response.content?.[0]?.text ?? '');
    const json = safeParseJson(text);
    if (!json?.verdict || !json?.explanation) throw new Error('Bad model output');

    res.status(200).json({ verdict: json.verdict, explanation: json.explanation });
  } catch {
    res.status(500).json({ error: 'AI error' });
  }
}

function readJson(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
  });
}
function safeParseJson(s) {
  try { return JSON.parse(s); } catch {
    const m = s?.match(/\{[\s\S]*\}$/);
    try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
  }
}

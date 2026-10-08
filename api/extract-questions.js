import { createClient } from '@supabase/supabase-js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function sendJson(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json').json(body);
}

function cleanJsonText(text) {
  let value = String(text || '').trim();
  value = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = value.indexOf('[');
  const end = value.lastIndexOf(']');
  if (start >= 0 && end > start) value = value.slice(start, end + 1);
  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return sendJson(res, 500, { error: 'GEMINI_API_KEY is not configured in Vercel.' });

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return sendJson(res, 401, { error: 'Login required.' });
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return sendJson(res, 500, { error: 'Supabase server configuration missing.' });
    const sb = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userError } = await sb.auth.getUser(token);
    if (userError || !user) return sendJson(res, 401, { error: 'Session expired. আবার login করুন।' });
    const { data: profile, error: profileError } = await sb.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || profile?.role !== 'admin') return sendJson(res, 403, { error: 'শুধু Admin এই feature ব্যবহার করতে পারবেন।' });

    let body = req.body || {};
    if (typeof body === 'string') body = JSON.parse(body);
    const { image, language = 'bn' } = body;
    if (!image?.data || !image?.mimeType) return sendJson(res, 400, { error: 'একটি image আবশ্যক।' });
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.mimeType)) {
      return sendJson(res, 400, { error: 'শুধু JPG, PNG অথবা WEBP image ব্যবহার করুন।' });
    }

    const prompt = `You are an expert Bengali government-job exam question digitizer. Analyze this photographed book page and extract ONLY clearly visible exam questions.

Return ONLY a valid JSON array. No markdown, no code fences, no commentary.
For every MCQ return exactly this shape:
{"question_type":"mcq","question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"a|b|c|d|null","explanation":""}
For a non-MCQ question return:
{"question_type":"short","question_text":"...","short_answer":"...","explanation":""}

Rules:
- Preserve the original Bengali wording as closely as possible; do not invent missing text.
- Include ALL four options for an MCQ when visible.
- Determine correct_option ONLY when the answer is explicitly marked on the page, an answer key is visible, or the correct answer is unambiguous from the supplied page context. Otherwise use null.
- If an answer key is visible elsewhere on the same image, use it to map question numbers to answers.
- Do not treat page numbers, headings, explanations, advertisements, or answer choices without a question as questions.
- Keep question order exactly as on the page.
- If text is too blurry/uncertain, omit that question rather than hallucinating it.
- ` + (language === 'bn' ? 'Output Bengali text where the source is Bengali.' : 'Preserve the source language.') + `
`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: image.mimeType, data: image.data } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      const msg = data?.error?.message || 'Gemini API error';
      return sendJson(res, 502, { error: msg });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    const parsed = JSON.parse(cleanJsonText(text));
    if (!Array.isArray(parsed)) throw new Error('AI response array নয়।');

    const normalized = parsed.map((q) => {
      const type = q.question_type === 'short' ? 'short' : 'mcq';
      const correct = ['a', 'b', 'c', 'd'].includes(String(q.correct_option || '').toLowerCase())
        ? String(q.correct_option).toLowerCase()
        : null;
      return {
        question_type: type,
        question_text: String(q.question_text || '').trim(),
        option_a: type === 'mcq' ? String(q.option_a || '').trim() : '',
        option_b: type === 'mcq' ? String(q.option_b || '').trim() : '',
        option_c: type === 'mcq' ? String(q.option_c || '').trim() : '',
        option_d: type === 'mcq' ? String(q.option_d || '').trim() : '',
        correct_option: correct,
        short_answer: type === 'short' ? String(q.short_answer || '').trim() : '',
        explanation: String(q.explanation || '').trim()
      };
    }).filter((q) => q.question_text && (q.question_type === 'short' ? q.short_answer : q.option_a && q.option_b && q.option_c && q.option_d));

    return sendJson(res, 200, { questions: normalized, model: MODEL });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'প্রশ্ন extract করতে সমস্যা হয়েছে।' });
  }
};
